<?php

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\LineaServicio;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Entrada a una línea de servicio: su tablero (si ya tiene uno) o su resumen de empresas y personal. */
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
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre],
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
        ]);
    }
}
