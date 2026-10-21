<?php

namespace App\Http\Controllers;

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Models\Asignacion;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Orden;
use App\Models\Parametro;
use App\Models\SolicitudContacto;
use App\Models\User;
use App\Services\InformeLinea\JornadaLinea;
use App\Support\OperacionLinea;
use App\Support\OperacionLogistica;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio después de ingresar: el resumen del día. Lo que pide atención (solicitudes sin atender, cargas por confirmar,
 * informes y novedades sin cerrar, personas sin asignación…) y cómo va cada línea que ve. Los módulos están en el
 * menú lateral. Quien no administra nada y trabaja en una sola línea entra directo a ella.
 */
class PanelController extends Controller
{
    /** @var array<int, OperacionLinea> Lo que ve de cada línea (se arma una vez por línea). */
    private array $operaciones = [];

    private ?OperacionLogistica $logistica = null;

    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $lineas = $user->lineasVisibles();

        if (! $user->administraAlgo() && ! ($user->puede(Permisos::TODAS_LAS_LINEAS) && $user->puede('tablero.ver'))) {
            // Trabaja en una sola línea: entra directo a ella
            if ($lineas->count() === 1) {
                return redirect()->route('lineas.show', $lineas->first());
            }
            // En ninguna: dónde está asignado (o que su rol no abre el tablero de su línea)
            if ($lineas->isEmpty()) {
                return Inertia::render('panel', ['asignacion' => [
                    'lugares' => $user->vigentes()->map(fn (Asignacion $a) => ['lugar' => $a->lugar(), 'lineas' => $a->lineas->pluck('nombre')]),
                    'sinTablero' => ! $user->puede('tablero.ver'),
                ]]);
            }
        }

        return Inertia::render('panel', [
            'pendientes' => $this->pendientes($user, $lineas),
            'lineas' => $lineas->map(fn (LineaServicio $l) => $this->tarjetaLinea($l, $user))->values(),
        ]);
    }

    /** Lo que ve de una línea: sus lugares dentro de su alcance (las líneas del inicio son las que su rol abre). */
    private function operacion(User $user, LineaServicio $linea): OperacionLinea
    {
        return $this->operaciones[$linea->id] ??= OperacionLinea::para($user, $linea, 'tablero.ver');
    }

    /**
     * Una línea con lo que quien mira ve en ella: sus empresas, su personal y cómo va. Su enlace lleva a una vista más
     * concreta que la del menú: el informe de la última jornada (logística) o la programación de hoy.
     */
    private function tarjetaLinea(LineaServicio $linea, User $user): array
    {
        $alcance = $this->operacion($user, $linea)->alcance;
        $jornada = $linea->esLogistica() ? $this->ultimaJornada($user) : null;
        $hoy = ! $linea->esLogistica() && $user->puedeEnLinea('programacion.ver', $linea)
            ? app(JornadaLinea::class)->resumenDia($this->operacion($user, $linea), today())
            : null;

        return [
            'slug' => $linea->slug,
            'nombre' => $linea->nombre,
            'icono' => $linea->icono,
            'empresas' => $linea->empresas()->where('activo', true)->when(! $alcance->todo, fn ($q) => $q->whereIn('empresas.id', $alcance->empresas()))->count(),
            'personas' => $alcance->filtrarAsignaciones(Asignacion::vigentes()->whereHas('lineas', fn ($q) => $q->whereKey($linea->id)))
                ->whereHas('usuario', fn ($q) => $q->where('activo', true))
                ->distinct()->count('user_id'),
            'jornada' => $jornada,
            'hoy' => $hoy,
            'enlace' => match (true) {
                $jornada !== null && $jornada['propia'] => ['href' => route('mis-entregas', ['fecha' => $jornada['fecha']], false), 'texto' => 'Ver mis entregas de esa jornada'],
                $jornada !== null && $user->puede('informes.ver') => ['href' => route('informes.index', ['fecha' => $jornada['fecha']], false), 'texto' => 'Ver el informe de esa jornada'],
                $hoy !== null => ['href' => route('programacion.index', $linea, false), 'texto' => 'Ver la programación de hoy'],
                default => null,
            },
        ];
    }

    /**
     * La última jornada de logística que ve, con la meta ponderada por las entregas de cada sede (la meta de quien
     * entregó más pesa más). Quien ve solo lo suyo ve su propia jornada (sus órdenes), como en su tablero.
     */
    private function ultimaJornada(User $user): ?array
    {
        if (! $user->puede('tablero.ver') || ! $user->trabajaEn(LineaServicio::logistica())) {
            return null;
        }

        if ($user->soloLoSuyo()) {
            $suyas = Orden::where('auxiliar_id', $user->id);
            $fecha = $suyas->clone()->max('fecha_operacion');
            if (! $fecha) {
                return null;
            }
            $t = $suyas->clone()->whereDate('fecha_operacion', $fecha)
                ->selectRaw("count(*) as asignadas, sum(estado = 'aprobada') as aprobadas")->toBase()->first();
            $meta = (float) Parametro::valor('meta_efectividad_global', 95);
        } else {
            $op = $this->logistica ??= OperacionLogistica::para($user);
            $fecha = $op->ubicacion(InformeDiario::query())->max('fecha_operacion');
            if (! $fecha) {
                return null;
            }
            $t = $op->ubicacion(InformeDiario::query(), 'informes_diarios')
                ->join('sedes', 'sedes.id', '=', 'informes_diarios.sede_id')
                ->whereDate('informes_diarios.fecha_operacion', $fecha)
                ->selectRaw('sum(informes_diarios.total_asignadas) as asignadas, sum(informes_diarios.total_aprobadas) as aprobadas, sum(informes_diarios.total_asignadas * sedes.meta_efectividad) as ponderada')
                ->toBase()->first();
            $meta = (int) $t->asignadas ? (float) $t->ponderada / (int) $t->asignadas : null;
        }
        $asignadas = (int) $t->asignadas;

        return [
            'fecha' => substr((string) $fecha, 0, 10),
            'propia' => $user->soloLoSuyo(),
            'asignadas' => $asignadas,
            'efectividad' => $asignadas ? round((int) $t->aprobadas / $asignadas * 100, 2) : null,
            'meta' => $meta ? round($meta, 2) : null,
        ];
    }

    /**
     * Lo que pide atención, solo de lo que su rol ve y hace: cada aviso con su cantidad y a dónde ir a resolverlo.
     *
     * @param  Collection<int, LineaServicio>  $lineas
     * @return list<array{clave: string, texto: string, detalle: string, href: string, nivel: string}>
     */
    private function pendientes(User $user, Collection $lineas): array
    {
        $avisos = [];
        $plural = fn (int $n, string $uno, string $varios) => $n.' '.($n === 1 ? $uno : $varios);
        $agregar = function (string $clave, int $n, string $texto, string $detalle, string $href, string $nivel = 'warning') use (&$avisos) {
            if ($n > 0) {
                $avisos[] = compact('clave', 'texto', 'detalle', 'href', 'nivel');
            }
        };

        if ($user->puede('empresas.crear') && Empresa::doesntExist()) {
            $avisos[] = ['clave' => 'empezar', 'texto' => 'Registra la primera empresa', 'detalle' => 'Luego sus sedes y sucursales, y por último asigna a cada persona dónde trabaja.', 'href' => route('empresas.index', [], false), 'nivel' => 'info'];
        }

        if ($user->puede('solicitudes.ver')) {
            $n = SolicitudContacto::where('atendida', false)->count();
            $agregar('solicitudes', $n, $plural($n, 'solicitud de cotización sin atender', 'solicitudes de cotización sin atender'), 'Llegaron desde el sitio web.', route('solicitudes.index', [], false));
        }

        if ($user->puede('cargas.ver')) {
            $n = Carga::where('estado', EstadoCarga::EnRevision)->count();
            $agregar('cargas', $n, $plural($n, 'carga de Drivin por confirmar', 'cargas de Drivin por confirmar'), 'Están en revisión: sus órdenes aún no cuentan en el informe.', route('cargas.index', [], false));
        }

        if ($user->puede('informes.ver') && $user->trabajaEn(LineaServicio::logistica())) {
            $this->logistica ??= OperacionLogistica::para($user);
            $n = $this->logistica->ubicacion(InformeDiario::query())
                ->where('estado', '!=', EstadoInforme::Cerrado)->whereDate('fecha_operacion', '<', today())->count();
            $agregar('informes', $n, $plural($n, 'informe diario de logística sin cerrar', 'informes diarios de logística sin cerrar'), 'De jornadas anteriores: revisa sus novedades y ciérralos.', route('informes.index', [], false));
        }

        foreach ($lineas as $linea) {
            if ($linea->esLogistica() || ! $user->puedeEnLinea('novedades.ver', $linea)) {
                continue;
            }
            $sinCerrar = $this->operacion($user, $linea)->filtrar(NovedadLinea::query(), 'novedades_linea')
                ->where('linea_servicio_id', $linea->id)->where('estado', '!=', 'cerrada')
                ->selectRaw("count(*) as total, sum(gravedad = 'grave') as graves")->toBase()->first();
            $n = (int) $sinCerrar->total;
            $graves = (int) $sinCerrar->graves;
            $agregar("novedades-{$linea->slug}", $n, "{$linea->nombre}: ".$plural($n, 'novedad sin cerrar', 'novedades sin cerrar'),
                $graves ? $plural($graves, 'es grave', 'son graves').'.' : 'Ninguna es grave.', route('novedades.index', $linea, false), $graves ? 'critical' : 'warning');
        }

        if ($user->puede('asignaciones.ver')) {
            // Los mismos criterios de la lista de Asignaciones a la que llevan (estado=sin y estado=terminan)
            $n = User::query()->alcanceDe($user)->sinAsignacion()->count();
            $agregar('sin-asignacion', $n, $plural($n, 'persona activa sin asignación', 'personas activas sin asignación'), 'No aparecen en la programación ni en su carnet dice dónde trabajan.', route('asignaciones.index', ['estado' => 'sin'], false));

            $n = Asignacion::terminanPronto()->whereIn('user_id', User::query()->alcanceDe($user)->select('users.id'))
                ->with('lineas:id')->get()
                ->filter(fn (Asignacion $a) => $user->sinLimites() || $user->veAsignacion($a))->count();
            $agregar('terminan', $n, $plural($n, 'asignación termina esta semana', 'asignaciones terminan esta semana'), 'Renuévalas si la persona sigue en el mismo lugar.', route('asignaciones.index', ['estado' => 'terminan'], false), 'info');
        }

        return $avisos;
    }
}
