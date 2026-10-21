<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Quien entra con la contraseña inicial (su cédula) la cambia antes de usar la plataforma: cualquier página lo lleva a
 * "Cambiar contraseña" hasta que lo haga. Puede salir sin cambiarla.
 */
class ExigirCambioContrasena
{
    /** Lo único que se puede hacer mientras tanto. */
    private const PERMITIDAS = ['password.edit', 'password.update', 'logout'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->debe_cambiar_contrasena && ! $request->routeIs(...self::PERMITIDAS)) {
            return redirect()->route('password.edit');
        }

        return $next($request);
    }
}
