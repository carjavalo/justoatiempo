<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vista previa por un enlace temporal (túnel de Cloudflare): quien entra desde afuera solo ve el sitio público y
 * el diseño del ingreso, sin poder ingresar a la plataforma. Se activa con VISTA_PREVIA=true mientras se comparte
 * el enlace; en la red local todo sigue igual.
 */
class VistaPreviaPublica
{
    /** Páginas que se pueden ver por el enlace. */
    private const VISIBLES = ['home', 'login', 'password.request'];

    public function handle(Request $request, Closure $next): Response
    {
        // Las peticiones del túnel llegan con la marca de Cloudflare; las de la red local, no
        if (! config('app.vista_previa') || ! $request->hasHeader('Cf-Ray')) {
            return $next($request);
        }

        $ruta = $request->route()?->getName();

        if (($request->isMethod('GET') && in_array($ruta, self::VISIBLES, true)) || $ruta === 'contacto.store') {
            return $next($request);
        }

        // El formulario de ingreso se ve, pero no deja entrar
        if ($request->isMethod('POST') && $request->is('login')) {
            return back(303)->withErrors(['email' => 'Esta es una vista previa: el ingreso a la plataforma está deshabilitado.']);
        }

        abort(404);
    }
}
