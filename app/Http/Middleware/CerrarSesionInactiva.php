<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Si el administrador desactiva a alguien con la sesión abierta, su siguiente clic lo saca de la plataforma. */
class CerrarSesionInactiva
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->activo) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // 303: tras un PUT/PATCH/DELETE el navegador sigue con GET (con 302 repetiría el método)
            return redirect()->route('login', [], 303)->with('status', 'Tu usuario fue desactivado. Si crees que es un error, habla con el administrador.');
        }

        return $next($request);
    }
}
