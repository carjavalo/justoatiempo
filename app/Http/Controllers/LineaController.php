<?php

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Models\User;
use App\Services\InformeLinea\JornadaLinea;
use App\Support\DiaLinea;
use App\Support\OperacionLinea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Entrada a una línea de servicio: el tablero de Drivin (logística) o el de las demás líneas: el día (programación,
 * asistencia y novedades, lo mismo que su tarjeta en el inicio), las novedades por resolver, la cobertura de los días
 * anteriores y, al final, sus empresas y su personal. Mientras la línea no se ha programado nunca, lo que falta para
 * operarla.
 */
class LineaController extends Controller
{
    public function show(Request $request, LineaServicio $linea): Response
    {
        $user = $request->user();
        abort_unless($user->puedeVerLinea($linea), 403, $user->puede('tablero.ver')
            ? 'No trabajas en esta línea de servicio.'
            : 'Tu rol no tiene permiso para ver el tablero de la línea.');

        if ($linea->esLogistica()) {
            return app(DashboardController::class)->mostrar($request, $linea);
        }

        // Lo que ve en esta línea: todas sus empresas o las de sus asignaciones
        $op = OperacionLinea::para($user, $linea, 'tablero.ver');
        $alcance = $op->alcance;
        $empresas = $linea->empresas()
            ->when(! $alcance->todo, fn ($q) => $q->whereIn('empresas.id', $alcance->empresas()))
            ->withCount([
                'sedes' => fn ($q) => $q->where('activo', true),
                'sucursales' => fn ($q) => $q->where('sucursales.activo', true),
            ])
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->get(['empresas.id', 'nombre', 'activo']);

        // Su personal: quienes tienen hoy una asignación en esta línea (dentro de lo que ve)
        $asignaciones = fn () => $alcance->filtrarAsignaciones(Asignacion::vigentes()->whereHas('lineas', fn ($q) => $q->whereKey($linea->id)))
            ->join('users', 'users.id', '=', 'asignaciones.user_id')
            ->where('users.activo', true);
        // El personal por rol de la empresa ("Conductor", "Auxiliar operativo"…), de más a menos personas
        $personal = $asignaciones()->join('roles', 'roles.id', '=', 'users.rol_id')
            ->selectRaw('roles.nombre as rol, count(distinct users.id) as total')->groupBy('roles.nombre')
            ->orderByDesc('total')->orderBy('roles.nombre')->toBase()->get();
        $porEmpresa = $asignaciones()->whereNotNull('asignaciones.empresa_id')
            ->selectRaw('asignaciones.empresa_id, count(distinct users.id) as total')->groupBy('asignaciones.empresa_id')
            ->toBase()->pluck('total', 'empresa_id');

        $dia = new DiaLinea($user, $op);
        $novedades = $dia->novedades();
        $primerosPasos = $this->primerosPasos($user, $op, $empresas->where('activo', true)->count(), (int) $personal->sum('total'));

        return Inertia::render('lineas/linea', [
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre, 'icono' => $linea->icono],
            'empresas' => $empresas->map(fn ($e) => [
                'id' => $e->id,
                'nombre' => $e->nombre,
                'activo' => (bool) $e->activo,
                'sedes' => $e->sedes_count,
                'sucursales' => $e->sucursales_count,
                'personas' => (int) ($porEmpresa[$e->id] ?? 0),
            ]),
            'personal' => $personal->map(fn ($p) => ['rol' => $p->rol, 'total' => (int) $p->total]),
            // La lista de personas de la línea, si su rol abre los usuarios
            'puedeUsuarios' => $user->puede('usuarios.ver'),
            'primerosPasos' => $primerosPasos,
            'hoy' => $dia->hoy(),
            // Sin programación nunca no hay días que mostrar
            'cobertura' => ! $primerosPasos && $user->puedeEnLinea('programacion.ver', $linea) ? $this->cobertura($op) : [],
            'novedades' => $novedades === null ? null : [...$novedades, 'recientes' => $novedades['sinCerrar'] ? $this->recientes($dia) : []],
            'misTurnos' => $this->misTurnos($user, $linea),
        ]);
    }

    /**
     * Mientras la línea nunca se ha programado en las empresas que ve: lo que falta para operarla, en orden (una empresa
     * que la recibe, personas asignadas y la primera programación), con quién da cada paso. Null cuando ya opera. Se
     * mira por empresa y no por lugar: a quien trabaja en una sede también lo programan en "toda la empresa".
     */
    private function primerosPasos(User $user, OperacionLinea $op, int $empresas, int $personas): ?array
    {
        $programada = Programacion::where('linea_servicio_id', $op->linea->id)
            ->when(! $op->alcance->todo, fn ($q) => $q->whereIn('empresa_id', $op->alcance->empresas()))
            ->exists();
        if ($programada) {
            return null;
        }

        return [
            'empresas' => $empresas,
            'personas' => $personas,
            // La línea se marca en el formulario de cada empresa
            'marcaEmpresas' => $user->puede('empresas.editar'),
            // Las asignaciones de esta línea (ahí se crean) y su programación, si su rol las hace
            'asignaciones' => $user->puede('asignaciones.ver') && $user->puede('asignaciones.crear')
                ? route('asignaciones.index', ['linea' => $op->linea->id], false)
                : null,
            'programacion' => $user->puedeEnLinea('programacion.ver', $op->linea) && $user->puedeEnLinea('programacion.editar', $op->linea)
                ? route('programacion.index', $op->linea, false)
                : null,
        ];
    }

    /**
     * La cobertura de cada uno de los 14 días anteriores (la de hoy va arriba, en "Hoy"). Sin cobertura (null) si ese día
     * no hubo programación o si no se registró la asistencia de nadie: como en el informe, eso no se califica.
     */
    private function cobertura(OperacionLinea $op): array
    {
        $dias = app(JornadaLinea::class)->lugares($op, today()->subDays(14), today()->subDay())->whereNotNull('programacion')->groupBy('fecha');

        return collect(range(14, 1))->map(function (int $atras) use ($dias) {
            $fecha = today()->subDays($atras)->toDateString();
            $lugares = $dias[$fecha] ?? collect();
            $registrada = $lugares->sum('programadas') > $lugares->sum('sinRegistrar');

            return ['fecha' => $fecha, 'programado' => $lugares->isNotEmpty(), 'cobertura' => $registrada ? JornadaLinea::cobertura($lugares) : null];
        })->values()->all();
    }

    /** Las novedades sin cerrar más urgentes: las graves primero, luego las más recientes. */
    private function recientes(DiaLinea $dia): array
    {
        return $dia->pendientes()->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'persona:id,name'])
            ->orderByRaw("case gravedad when 'grave' then 0 when 'leve' then 1 else 2 end")->latest('fecha')->latest('id')->limit(5)->get()
            ->map(fn (NovedadLinea $n) => ['id' => $n->id, 'fecha' => $n->fecha->toDateString(), 'tipo' => $n->tipo, 'gravedad' => $n->gravedad, 'lugar' => $n->lugar(), 'persona' => $n->persona?->name, 'estado' => $n->estado])
            ->all();
    }

    /** Sus turnos en la línea: la última semana y las dos que vienen. */
    private function misTurnos(User $user, LineaServicio $linea): array
    {
        return ProgramacionAsignacion::where('user_id', $user->id)
            ->whereHas('programacion', fn ($q) => $q->where('linea_servicio_id', $linea->id)->whereBetween('fecha', [today()->subDays(7)->toDateString(), today()->addDays(14)->toDateString()]))
            ->with('programacion.empresa:id,nombre', 'programacion.sede:id,nombre', 'programacion.sucursal:id,nombre')
            ->get()
            ->sortBy(fn (ProgramacionAsignacion $a) => $a->programacion->fecha->toDateString().($a->hora_entrada ?? ''))
            ->map(fn (ProgramacionAsignacion $a) => [
                'id' => $a->id,
                'fecha' => $a->programacion->fecha->toDateString(),
                'lugar' => $a->programacion->lugar(),
                'turno' => $a->hora_entrada ? substr($a->hora_entrada, 0, 5).($a->hora_salida ? ' a '.substr($a->hora_salida, 0, 5) : '') : null,
                'asistencia' => $a->asistencia?->label(),
            ])->values()->all();
    }
}
