<?php

namespace App\Http\Middleware;

use App\Enums\Rol;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Los módulos de la operación (Drivin, auditoría, indicadores) muestran datos de todas las empresas:
 * solo los usa el personal de Justo a Tiempo. Quien está asignado a una empresa cliente no entra
 * (el auxiliar sí, porque esos módulos ya le muestran solo lo suyo).
 */
class SoloPersonalPropio
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->cliente_id !== null && $user->rol !== Rol::Auxiliar) {
            abort(403, 'Esta sección es solo para el personal de Justo a Tiempo.');
        }

        return $next($request);
    }
}
