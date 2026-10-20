<?php

namespace App\Http\Controllers;

use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\SolicitudContacto;
use App\Models\Sucursal;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio después de ingresar: los módulos de la administración que su rol le deja ver y las líneas de servicio
 * (todas, si su rol las ve todas). Quien no administra nada y trabaja en una línea entra directo a ella.
 */
class PanelController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $verTodasLasLineas = $user->puede(Permisos::TODAS_LAS_LINEAS);

        if (! $user->administraAlgo() && ! $verTodasLasLineas) {
            if ($user->linea && $user->puedeVerLinea($user->linea)) {
                return redirect()->route('lineas.show', $user->linea);
            }

            return Inertia::render('panel', [
                'asignacion' => [
                    'empresa' => $user->empresa?->nombre,
                    'sede' => $user->sede?->nombre,
                    'sucursal' => $user->sucursal?->nombre,
                    // Tiene línea, pero su rol no abre su tablero
                    'sinTablero' => $user->linea !== null,
                ],
            ]);
        }

        // Solo se cuenta lo que se muestra
        $resumen = array_filter([
            'usuarios' => $user->puede('usuarios.ver') ? (function () {
                $u = User::selectRaw('count(*) as total, sum(activo) as activos')->first();

                return ['total' => (int) $u->total, 'activos' => (int) $u->activos];
            })() : null,
            'roles' => $user->puede('roles.ver') ? ['total' => RolUsuario::count(), 'activos' => RolUsuario::where('activo', true)->count()] : null,
            'empresas' => $user->puede('empresas.ver') ? (function () {
                $e = Empresa::selectRaw('count(*) as total, sum(activo) as activas')->first();

                return ['total' => (int) $e->total, 'activas' => (int) $e->activas];
            })() : null,
            'sedes' => $user->puede('sedes.ver') ? (function () {
                $s = Sede::selectRaw('count(*) as total, sum(activo) as activas')->first();

                return ['total' => (int) $s->total, 'activas' => (int) $s->activas];
            })() : null,
            'sucursales' => $user->puede('sucursales.ver') ? (function () {
                $s = Sucursal::selectRaw('count(*) as total, sum(activo) as activas, sum(activo = 1 and sede_id is null) as propias')->first();

                return ['total' => (int) $s->total, 'activas' => (int) $s->activas, 'propias' => (int) $s->propias];
            })() : null,
            'solicitudes' => $user->puede('solicitudes.ver')
                ? ['total' => SolicitudContacto::count(), 'pendientes' => SolicitudContacto::where('atendida', false)->count()]
                : null,
        ], fn ($dato) => $dato !== null);

        // Las líneas que ve: todas o solo la suya (si su rol abre su tablero)
        $lineas = $verTodasLasLineas || ($user->linea && $user->puedeVerLinea($user->linea))
            ? LineaServicio::ordenadas()
                ->when(! $verTodasLasLineas, fn ($q) => $q->whereKey($user->linea_servicio_id))
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
                ])
            : [];

        return Inertia::render('panel', [
            'resumen' => (object) $resumen,
            'lineas' => $lineas,
        ]);
    }
}
