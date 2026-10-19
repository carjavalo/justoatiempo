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

    /**
     * Show the password reset link request page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
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

        // Freno por equipo: este formulario no sirve para llenar buzones ajenos ni para probar correo tras correo
        $clave = 'restablecer|'.$request->ip();
        if (RateLimiter::tooManyAttempts($clave, self::SOLICITUDES)) {
            $minutos = (int) ceil(RateLimiter::availableIn($clave) / 60);

            throw ValidationException::withMessages([
                'email' => 'Hiciste muchas solicitudes seguidas. Espera '.($minutos === 1 ? 'un minuto' : "{$minutos} minutos").' y vuelve a intentarlo.',
            ]);
        }
        RateLimiter::hit($clave, 15 * 60);

        // Solo las cuentas activas reciben el enlace. La respuesta es la misma exista o no la cuenta, y el correo
        // sale después de responder (User::avisarDespues): ni el mensaje ni la espera delatan qué correos existen.
        // Pedirlo de nuevo antes de un minuto no envía otro correo (auth.passwords.users.throttle).
        Password::sendResetLink([...$request->only('email'), 'activo' => true]);

        return back()->with('status', "Si {$request->email} tiene una cuenta activa en la plataforma, en unos minutos te llegará un correo con el enlace para crear una nueva contraseña. Revisa también la carpeta de correo no deseado.");
    }
}
