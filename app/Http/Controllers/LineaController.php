<?php

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\ProgramacionAsignacion;
use App\Models\User;
use App\Services\InformeLinea\JornadaLinea;
use App\Support\OperacionLinea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Entrada a una línea de servicio: el tablero de Drivin (logística) o el de las demás líneas: la operación de hoy
 * (programación y asistencia), sus novedades pendientes, sus empresas y su personal.
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
        $alcance = $user->alcanceEn($linea);
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

        return Inertia::render('lineas/linea', [
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre, 'descripcion' => $linea->descripcion, 'icono' => $linea->icono],
            'empresas' => $empresas->map(fn ($e) => [
                'id' => $e->id,
                'nombre' => $e->nombre,
                'activo' => (bool) $e->activo,
                'sedes' => $e->sedes_count,
                'sucursales' => $e->sucursales_count,
                'personas' => (int) ($porEmpresa[$e->id] ?? 0),
            ]),
            'personal' => $personal->map(fn ($p) => ['rol' => $p->rol, 'total' => (int) $p->total]),
            // Enlaces a la administración, si su rol la abre
            'puedeEmpresas' => $user->puede('empresas.editar'),
            'puedeUsuarios' => $user->puede('usuarios.ver'),
            'hoy' => $user->puedeEnLinea('programacion.ver', $linea) ? $this->hoy(OperacionLinea::para($user, $linea, 'programacion.ver')) : null,
            'novedades' => $user->puedeEnLinea('novedades.ver', $linea) ? $this->novedades(OperacionLinea::para($user, $linea, 'novedades.ver')) : null,
            'misTurnos' => $this->misTurnos($user, $linea),
        ]);
    }

    /** La operación de hoy y la cobertura de los últimos 14 días. */
    private function hoy(OperacionLinea $op): array
    {
        $jornada = app(JornadaLinea::class);
        $desde = today()->subDays(13);
        $dias = $jornada->lugares($op, $desde, today())->whereNotNull('programacion')->groupBy('fecha');
        $deHoy = $dias[today()->toDateString()] ?? collect();

        return [
            'fecha' => today()->toDateString(),
            'lugares' => $deHoy->count(),
            'requeridas' => $deHoy->sum('requeridas'),
            'programadas' => $deHoy->sum('programadas'),
            'presentes' => $deHoy->sum('presentes'),
            'faltas' => $deHoy->sum('faltas'),
            'sinRegistrar' => $deHoy->sum('sinRegistrar'),
            'cobertura' => JornadaLinea::cobertura($deHoy),
            'tendencia' => collect(range(13, 0))->map(function (int $atras) use ($dias) {
                $fecha = today()->subDays($atras)->toDateString();

                return ['fecha' => $fecha, 'cobertura' => isset($dias[$fecha]) ? JornadaLinea::cobertura($dias[$fecha]) : null];
            })->values(),
        ];
    }

    /** Las novedades sin cerrar: cuántas y las más recientes. */
    private function novedades(OperacionLinea $op): array
    {
        $pendientes = fn () => $op->filtrar(NovedadLinea::query(), 'novedades_linea')->where('linea_servicio_id', $op->linea->id)->where('estado', '!=', 'cerrada');

        return [
            'abiertas' => $pendientes()->where('estado', 'abierta')->count(),
            'enSeguimiento' => $pendientes()->where('estado', 'en_seguimiento')->count(),
            'graves' => $pendientes()->where('gravedad', 'grave')->count(),
            'recientes' => $pendientes()->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'persona:id,name'])
                ->orderByRaw("case gravedad when 'grave' then 0 when 'leve' then 1 else 2 end")->latest('fecha')->latest('id')->limit(5)->get()
                ->map(fn (NovedadLinea $n) => ['id' => $n->id, 'fecha' => $n->fecha->toDateString(), 'tipo' => $n->tipo, 'gravedad' => $n->gravedad, 'lugar' => $n->lugar(), 'persona' => $n->persona?->name, 'estado' => $n->estado]),
        ];
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
