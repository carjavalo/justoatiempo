<?php

namespace App\Http\Controllers;

use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\SolicitudContacto;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio después de ingresar. El administrador ve la administración y las líneas de servicio;
 * los demás trabajan en una sola línea y entran directo a ella.
 */
class PanelController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user->esAdmin() && $user->linea) {
            return redirect()->route('lineas.show', $user->linea);
        }

        if (! $user->esAdmin()) {
            return Inertia::render('panel', [
                'asignacion' => [
                    'empresa' => $user->empresa?->nombre,
                    'sede' => $user->sede?->nombre,
                    'sucursal' => $user->sucursal?->nombre,
                ],
            ]);
        }

        $usuarios = User::selectRaw('count(*) as total, sum(activo) as activos')->first();
        $empresas = Empresa::selectRaw('count(*) as total, sum(activo) as activas')->first();
        $sedes = Sede::selectRaw('count(*) as total, sum(activo) as activas')->first();
        $sucursales = Sucursal::selectRaw('count(*) as total, sum(activo) as activas, sum(activo = 1 and sede_id is null) as propias')->first();

        return Inertia::render('panel', [
            'resumen' => [
                'usuarios' => ['total' => (int) $usuarios->total, 'activos' => (int) $usuarios->activos],
                'empresas' => ['total' => (int) $empresas->total, 'activas' => (int) $empresas->activas],
                'sedes' => ['total' => (int) $sedes->total, 'activas' => (int) $sedes->activas],
                'sucursales' => ['total' => (int) $sucursales->total, 'activas' => (int) $sucursales->activas, 'propias' => (int) $sucursales->propias],
                'solicitudes' => ['total' => SolicitudContacto::count(), 'pendientes' => SolicitudContacto::where('atendida', false)->count()],
                'roles' => ['total' => RolUsuario::count(), 'activos' => RolUsuario::where('activo', true)->count()],
            ],
            'lineas' => LineaServicio::ordenadas()
                ->withCount([
                    'empresas' => fn ($q) => $q->where('activo', true),
                    'usuarios' => fn ($q) => $q->where('activo', true),
                ])
                ->get()
                ->map(fn (LineaServicio $l) => [
                    'slug' => $l->slug,
                    'nombre' => $l->nombre,
                    'empresas' => $l->empresas_count,
                    'personas' => $l->usuarios_count,
                    'tablero' => $l->modulo !== null,
                ]),
        ]);
    }
}
