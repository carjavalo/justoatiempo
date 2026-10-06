<?php

namespace App\Http\Middleware;

use App\Enums\Rol;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Uso en rutas: ->middleware('rol:admin,coordinador') */
class EnsureRol
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->activo) {
            abort(403, 'Tu usuario está inactivo.');
        }

        $permitidos = array_map(fn (string $r) => Rol::from($r), $roles);

        if (! $user->tieneRol(...$permitidos)) {
            abort(403, 'No tienes permiso para acceder a esta sección.');
        }

        return $next($request);
    }
}
