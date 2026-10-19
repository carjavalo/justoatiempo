<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\ContrasenaCambiada;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewPasswordController extends Controller
{
    /**
     * Página para crear la nueva contraseña (a la que lleva el enlace del correo).
     */
    public function create(Request $request): Response
    {
        $correo = is_string($request->query('email')) ? $request->query('email') : '';
        $token = (string) $request->route('token');
        $usuario = $correo !== '' ? Password::getUser(['email' => $correo, 'activo' => true]) : null;

        return Inertia::render('auth/reset-password', [
            'email' => $correo,
            'token' => $token,
            // Vencido, ya usado o incompleto: se avisa de entrada, antes de que escriba la nueva contraseña
            'vigente' => $usuario !== null && Password::tokenExists($usuario, $token),
            'minutos' => (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire'),
        ]);
    }

    /**
     * Guarda la nueva contraseña.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        // Solo cuentas activas: a quien desactivaron después de pedir el enlace no le sirve
        $status = Password::reset(
            [...$request->only('email', 'password', 'password_confirmation', 'token'), 'activo' => true],
            function (User $usuario) use ($request) {
                $usuario->forceFill([
                    'password' => Hash::make($request->password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Quien siguiera dentro con la contraseña anterior (en otro equipo) queda por fuera
                if (config('session.driver') === 'database') {
                    DB::connection(config('session.connection'))->table(config('session.table'))->where('user_id', $usuario->id)->delete();
                }

                $usuario->avisarDespues(new ContrasenaCambiada(now()));

                event(new PasswordReset($usuario));
            }
        );

        if ($status === Password::PasswordReset) {
            return to_route('login')
                ->with('status', 'Listo, tu contraseña se cambió. Ya puedes iniciar sesión con la nueva.')
                ->with('correo', $request->email);
        }

        // Correo desconocido o enlace vencido reciben la misma respuesta: no delata qué correos existen
        throw ValidationException::withMessages([
            'email' => [__(Password::InvalidToken)],
        ]);
    }
}
