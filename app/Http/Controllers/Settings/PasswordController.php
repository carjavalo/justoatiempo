<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordController extends Controller
{
    /**
     * Show the user's password settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/password', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            // Entró con la contraseña inicial (su cédula): debe cambiarla para seguir
            'obligatorio' => $request->user()->debe_cambiar_contrasena,
        ]);
    }

    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed', 'different:current_password',
                // La cédula está en el carnet: no sirve como contraseña
                fn ($atributo, $valor, $falla) => $user->cedula && preg_replace('/\D/', '', (string) $valor) === $user->cedula && $falla('No uses tu cédula como contraseña: está en tu carnet.')],
        ], ['password.different' => 'La nueva contraseña debe ser distinta de la actual.']);

        $eraLaInicial = $user->debe_cambiar_contrasena;
        $user->update([
            'password' => Hash::make($validated['password']),
            'debe_cambiar_contrasena' => false,
        ]);

        // Con la inicial ya cambiada, sigue a su inicio
        return $eraLaInicial
            ? redirect($user->inicio()['url'])->with('success', 'Listo: ya tienes tu propia contraseña. Úsala desde tu próximo ingreso.')
            : back();
    }
}
