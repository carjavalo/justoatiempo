<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Herramientas de una línea (p. ej. Drivin para logística): solo el administrador y el personal de esa línea. Uso: ->middleware('linea:logistica') */
class EnsureLinea
{
    public function handle(Request $request, Closure $next, string $modulo): Response
    {
        $user = $request->user();

        if (! $user->esAdmin() && $user->linea?->modulo !== $modulo) {
            abort(403, 'Esta herramienta es de otra línea de servicio.');
        }

        return $next($request);
    }
}
