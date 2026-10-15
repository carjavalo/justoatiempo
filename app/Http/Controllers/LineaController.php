<?php

namespace App\Http\Controllers;

use App\Enums\Rol;
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
        abort_unless($user->puedeVerLinea($linea), 403, 'No trabajas en esta línea de servicio.');

        if ($linea->esLogistica()) {
            return app(DashboardController::class)->mostrar($request, $linea);
        }

        $empresaFija = $user->empresaFija();
        $empresas = $linea->empresas()
            ->when($empresaFija, fn ($q) => $q->whereKey($empresaFija))
            ->withCount([
                'sedes' => fn ($q) => $q->where('activo', true),
                'sucursales' => fn ($q) => $q->where('sucursales.activo', true),
            ])
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->get(['empresas.id', 'nombre', 'activo']);

        $activos = fn () => $linea->usuarios()->where('activo', true)
            ->when($empresaFija, fn ($q) => $q->where('empresa_id', $empresaFija));
        $personal = $activos()->selectRaw('rol, count(*) as total')->groupBy('rol')->pluck('total', 'rol');
        $porEmpresa = $activos()->whereNotNull('empresa_id')->selectRaw('empresa_id, count(*) as total')->groupBy('empresa_id')->pluck('total', 'empresa_id');

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
            'personal' => array_map(fn (Rol $r) => ['rol' => $r->label(), 'total' => (int) ($personal[$r->value] ?? 0)], [Rol::Coordinador, Rol::Auxiliar]),
            'esAdmin' => $user->esAdmin(),
        ]);
    }
}
