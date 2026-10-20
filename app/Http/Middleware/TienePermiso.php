<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Deja pasar a quien tiene al menos uno de los permisos (los de su rol que le aplican: App\Models\User::permisos).
 * Uso en rutas: ->middleware('permiso:usuarios.ver') o ->middleware('permiso:cargas.subir,cargas.confirmar').
 */
class TienePermiso
{
    public function handle(Request $request, Closure $next, string ...$permisos): Response
    {
        $user = $request->user();

        if (! $user || ! $user->activo) {
            abort(403, 'Tu usuario está inactivo.');
        }

        if (! $user->puedeAlguno(...$permisos)) {
            // El aviso dice la causa: su rol no lo tiene, ve solo su empresa o la herramienta es de otra línea
            abort(403, $user->motivoSinPermiso($permisos[0]) ?? 'Tu rol no tiene permiso para entrar a esta sección.');
        }

        return $next($request);
    }
}
