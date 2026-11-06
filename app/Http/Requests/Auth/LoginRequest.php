<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /** Intentos fallidos seguidos antes de tener que esperar (el contador se reinicia al minuto del primero). */
    private const INTENTOS = 5;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // El correo o la cédula (la mayoría de auxiliares no tiene correo)
            'email' => ['required', 'string', 'max:255', function (string $atributo, mixed $valor, \Closure $fallar) {
                if (is_string($valor) && ! str_contains($valor, '@') && preg_replace('/\D/', '', $valor) === '') {
                    $fallar('Escribe tu correo completo (con @) o tu número de cédula.');
                }
            }],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Escribe tu correo o tu cédula.',
            'password.required' => 'Escribe tu contraseña.',
        ];
    }

    /** Con qué se identifica: el correo (si trae @) en minúsculas o la cédula con solo sus números. */
    private function identificacion(): array
    {
        $usuario = trim((string) $this->input('email'));

        return str_contains($usuario, '@') ? ['email' => mb_strtolower($usuario)] : ['cedula' => preg_replace('/\D/', '', $usuario)];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        // Los fallos del ingreso (datos que no coinciden, bloqueo, cuenta) son del formulario, no de un campo: van en
        // "ingreso" y la pantalla los muestra arriba, con el foco en la contraseña
        $identificacion = $this->identificacion();
        $clave = (string) $this->input('password');
        $recordar = $this->boolean('remember');
        $entro = Auth::attempt([...$identificacion, 'password' => $clave], $recordar)
            // El código inicial se entrega en dos grupos ("4831 2290"): vale escrito con o sin el espacio
            || (preg_match('/^\d{4}[\s.-]\d{4}$/', trim($clave)) && Auth::attempt([...$identificacion, 'password' => preg_replace('/\D/', '', $clave)], $recordar));

        if (! $entro) {
            RateLimiter::hit($this->throttleKey());

            $mensaje = __(isset($identificacion['cedula']) ? 'auth.failed_cedula' : 'auth.failed');
            // Antes del bloqueo, un aviso: el siguiente fallo obliga a esperar
            if (RateLimiter::remaining($this->throttleKey(), self::INTENTOS) === 1) {
                $mensaje .= ' '.__('auth.ultimo_intento');
            }

            throw ValidationException::withMessages(['ingreso' => $mensaje]);
        }

        if (! Auth::user()->activo) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'ingreso' => 'Tu usuario está desactivado. Habla con el administrador para recuperar el acceso.',
            ]);
        }

        // Sigue siendo parte del personal (con su carnet), pero ya no entra a la plataforma
        if (! Auth::user()->acceso) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'ingreso' => 'Tu usuario no tiene acceso a la plataforma. Si lo necesitas, habla con el administrador.',
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), self::INTENTOS)) {
            return;
        }

        event(new Lockout($this));

        $segundos = RateLimiter::availableIn($this->throttleKey());
        $minutos = max(1, (int) ceil($segundos / 60));

        throw ValidationException::withMessages([
            'ingreso' => trans_choice('auth.throttle', $minutos, ['minutes' => $minutos]),
            // Para la cuenta regresiva de la pantalla
            'bloqueo' => (string) $segundos,
        ]);
    }

    /**
     * Los intentos se cuentan por persona y equipo, con lo que se escribió ya normalizado: "1.234.567" y "1234567"
     * son la misma cédula, como "Ana@Correo.com" y "ana@correo.com" el mismo correo.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(implode('|', [...$this->identificacion(), $this->ip()]));
    }
}
