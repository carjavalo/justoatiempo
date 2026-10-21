<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /** Solicitudes permitidas por equipo (dirección IP) cada 15 minutos. */
    private const SOLICITUDES = 5;

    /** Momento (marca de tiempo) del último enlace pedido desde este navegador. */
    private const ULTIMO_ENVIO = 'restablecer_enviado_en';

    /**
     * Show the password reset link request page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
            // Contador para volver a pedir el enlace; sigue corriendo aunque se recargue la página
            'espera' => $this->espera($request),
            'enviadoEn' => $request->session()->get(self::ULTIMO_ENVIO),
        ]);
    }

    /**
     * Envía el enlace para crear una nueva contraseña.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        // El mismo plazo del contador de la pantalla (p. ej. si se envía desde otra pestaña)
        $espera = $this->espera($request);
        if ($espera > 0) {
            throw ValidationException::withMessages([
                'email' => 'Espera '.($espera === 1 ? 'un segundo' : "{$espera} segundos").' para pedir otro enlace.',
            ]);
        }

        // Freno por equipo: este formulario no sirve para llenar buzones ajenos ni para probar correo tras correo
        $clave = 'restablecer|'.$request->ip();
        if (RateLimiter::tooManyAttempts($clave, self::SOLICITUDES)) {
            $minutos = (int) ceil(RateLimiter::availableIn($clave) / 60);

            throw ValidationException::withMessages([
                'email' => 'Hiciste muchas solicitudes seguidas. Espera '.($minutos === 1 ? 'un minuto' : "{$minutos} minutos").' y vuelve a intentarlo.',
            ]);
        }
        RateLimiter::hit($clave, 15 * 60);

        // Solo las cuentas activas y con acceso a la plataforma reciben el enlace (a quien no tiene acceso, una
        // contraseña nueva se lo daría). La respuesta es la misma exista o no la cuenta, y el correo sale después de
        // responder (User::avisarDespues): ni el mensaje ni la espera delatan qué correos existen.
        Password::sendResetLink([...$request->only('email'), 'activo' => true, 'acceso' => true]);
        $request->session()->put(self::ULTIMO_ENVIO, now()->getTimestamp());

        return back()->with('status', "Si {$request->email} tiene una cuenta activa en la plataforma, en unos minutos te llegará un correo con el enlace para crear una nueva contraseña. Revisa también la carpeta de correo no deseado.");
    }

    /**
     * Segundos que faltan para poder pedir otro enlace. Es el mismo plazo con el que la plataforma deja de enviar
     * correos repetidos a una misma cuenta (auth.passwords.*.throttle).
     */
    private function espera(Request $request): int
    {
        $enviado = $request->session()->get(self::ULTIMO_ENVIO);
        $plazo = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.throttle');

        return $enviado ? max(0, (int) $enviado + $plazo - now()->getTimestamp()) : 0;
    }
}
