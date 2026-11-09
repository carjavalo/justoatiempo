<?php

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\User;
use App\Support\DiaLinea;
use App\Support\DiaLogistica;
use App\Support\OperacionLinea;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio después de ingresar: el resumen del día. Cada línea que ve con su día en orden (logística: la última jornada de
 * Drivin, sus cargas e informes; las demás: programación, asistencia y novedades), cada cosa con su enlace; y aparte, lo
 * general que pide atención (personas sin asignación, asignaciones que terminan…). Los módulos están en el menú lateral
 * (las solicitudes, con su contador allí). Quien no administra nada y trabaja en una sola línea entra directo a ella.
 */
class PanelController extends Controller
{
    /** @var array<int, OperacionLinea> Lo que ve de cada línea (se arma una vez por línea). */
    private array $operaciones = [];

    private ?DiaLogistica $logistica = null;

    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $lineas = $user->lineasVisibles();

        // Solo su carnet (como el auxiliar operativo): ese es su inicio
        if ($user->soloSuCarnet($lineas)) {
            return redirect()->route('mi-carnet');
        }

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

        $tarjetas = $lineas->map(fn (LineaServicio $l) => $this->tarjetaLinea($l, $user))->values();
        // Las que aún no se prestan en ninguna empresa no tienen día que mostrar: van en un solo aviso, para quien las configura
        $sinEmpresa = $tarjetas->filter(fn (array $t) => $t['empresas'] === 0 && ! $t['jornada'] && ! ($t['hoy']['lugares'] ?? 0))->pluck('nombre');

        return Inertia::render('panel', [
            'pendientes' => $this->pendientes($user, $sinEmpresa),
            'lineas' => $tarjetas,
        ]);
    }

    /** Lo que ve de una línea: sus lugares dentro de su alcance (las líneas del inicio son las que su rol abre). */
    private function operacion(User $user, LineaServicio $linea): OperacionLinea
    {
        return $this->operaciones[$linea->id] ??= OperacionLinea::para($user, $linea, 'tablero.ver');
    }

    /**
     * Una línea con su día, en lo que quien mira ve de ella. Cada parte trae su enlace a la vista concreta (la línea ya
     * está en el menú): logística, el informe de su última jornada, sus cargas e informes sin cerrar; las demás, la
     * programación de hoy (con su asistencia) y sus novedades.
     */
    private function tarjetaLinea(LineaServicio $linea, User $user): array
    {
        $op = $this->operacion($user, $linea);
        $logistica = $linea->esLogistica();
        // Las demás: el mismo día que muestra el tablero de la línea, arriba
        $dia = $logistica ? null : new DiaLinea($user, $op);

        return [
            'slug' => $linea->slug,
            'nombre' => $linea->nombre,
            'icono' => $linea->icono,
            'logistica' => $logistica,
            'empresas' => $linea->empresas()->where('activo', true)->when(! $op->alcance->todo, fn ($q) => $q->whereIn('empresas.id', $op->alcance->empresas()))->count(),
            'personas' => $op->alcance->filtrarAsignaciones(Asignacion::vigentes()->whereHas('lineas', fn ($q) => $q->whereKey($linea->id)))
                ->whereHas('usuario', fn ($q) => $q->where('activo', true))
                ->distinct()->count('user_id'),
            // El mismo día que muestra el tablero de la línea, arriba
            'jornada' => $logistica ? $this->diaLogistica($user)->jornada() : null,
            'cargas' => $logistica ? $this->diaLogistica($user)->cargas() : null,
            'informes' => $logistica ? $this->diaLogistica($user)->informes() : null,
            'hoy' => $dia?->hoy(),
            'novedades' => $dia?->novedades(),
        ];
    }

    /** El día de logística de quien mira (se arma una vez). */
    private function diaLogistica(User $user): DiaLogistica
    {
        return $this->logistica ??= new DiaLogistica($user);
    }

    /**
     * Lo general que pide atención (lo de cada línea va en su tarjeta), solo de lo que su rol ve y hace: cada aviso con su
     * cantidad y a dónde ir a resolverlo, lo crítico primero. Las solicitudes de cotización no van aquí: su contador está
     * en el menú, en "Solicitudes".
     *
     * @param  Collection<int, string>  $sinEmpresa  nombres de las líneas que aún no se prestan en ninguna empresa
     * @return list<array{clave: string, texto: string, detalle: string, href: string|null, nivel: string}>
     */
    private function pendientes(User $user, Collection $sinEmpresa): array
    {
        $avisos = [];
        $plural = fn (int $n, string $uno, string $varios) => number_format($n, 0, ',', '.').' '.($n === 1 ? $uno : $varios);
        $agregar = function (string $clave, int $n, string $texto, string $detalle, string $href, string $nivel = 'warning') use (&$avisos) {
            if ($n > 0) {
                $avisos[] = compact('clave', 'texto', 'detalle', 'href', 'nivel');
            }
        };

        if ($user->puede('empresas.crear') && Empresa::doesntExist()) {
            $avisos[] = ['clave' => 'empezar', 'texto' => 'Registra la primera empresa', 'detalle' => 'Luego sus sedes y sucursales, y por último asigna a cada persona dónde trabaja.', 'href' => route('empresas.index', [], false), 'nivel' => 'info'];
        }

        // Sin enlace: "Empresas" ya está en el menú; el aviso dice dónde se marcan
        if ($user->puede('empresas.editar') && $sinEmpresa->isNotEmpty() && Empresa::exists()) {
            $n = $sinEmpresa->count();
            $avisos[] = ['clave' => 'sin-empresa', 'nivel' => 'info', 'href' => null,
                'texto' => $n === 1 ? '1 línea aún no se presta en ninguna empresa' : "{$n} líneas aún no se prestan en ninguna empresa",
                'detalle' => $sinEmpresa->join(', ', ' y ').'. Se marcan en cada empresa, en «Líneas de servicio que recibe».'];
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

        // Lo crítico primero, luego lo que conviene revisar y al final lo informativo (el orden de llegada dentro de cada nivel)
        $orden = ['critical' => 0, 'warning' => 1, 'info' => 2];
        usort($avisos, fn (array $a, array $b) => $orden[$a['nivel']] <=> $orden[$b['nivel']]);

        return $avisos;
    }
}
