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
    /** Intentos fallidos con una misma cuenta (desde un mismo equipo) antes de un bloqueo, contados en 15 minutos. */
    private const INTENTOS = 5;

    private const VENTANA = 900;

    /** Esperas de los bloqueos seguidos: 1, 5 y 15 minutos (de ahí en adelante, 15). Se olvidan al entrar bien o al día. */
    private const ESPERAS = [60, 300, 900];

    /** Fallos por equipo (con cualquier cuenta) en un minuto: frena a quien prueba muchas cédulas desde un mismo lugar. */
    private const POR_EQUIPO = 20;

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
            // Sin @ tiene que ser una cédula (solo números): "ana.ruiz2" es un correo a medias, no la cédula "2"
            'email' => ['required', 'string', 'max:255', function (string $atributo, mixed $valor, \Closure $fallar) {
                if (is_string($valor) && ! str_contains($valor, '@') && ! self::esCedula($valor)) {
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

    /** Una cédula como se la escriba: solo números, con puntos, espacios o guiones. */
    private static function esCedula(string $valor): bool
    {
        return preg_match('/^[\d\s.\-]+$/', trim($valor)) === 1 && preg_match('/\d/', $valor) === 1;
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
        // Mantener la sesión solo con correo: quien entra con cédula puede estar en un teléfono compartido de la cuadrilla
        $recordar = $this->boolean('remember') && ! isset($identificacion['cedula']);
        $entro = Auth::attempt([...$identificacion, 'password' => $clave], $recordar)
            // El código inicial se entrega en dos grupos ("4831 2290"): vale escrito con o sin el espacio
            || (preg_match('/^\d{4}[\s.-]\d{4}$/', trim($clave)) && Auth::attempt([...$identificacion, 'password' => preg_replace('/\D/', '', $clave)], $recordar));

        if (! $entro) {
            RateLimiter::hit($this->throttleKey(), self::VENTANA);
            RateLimiter::hit($this->claveEquipo());
            // El fallo que agota los intentos ya trae el bloqueo (no el intento siguiente): lo que el aviso anterior prometió
            if (RateLimiter::tooManyAttempts($this->throttleKey(), self::INTENTOS)) {
                $this->bloquear();
            }
            $this->ensureIsNotRateLimited();

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

        // Entró: se olvidan sus fallos y sus bloqueos
        RateLimiter::clear($this->throttleKey());
        RateLimiter::clear($this->claveBloqueos());
    }

    /** Un bloqueo más largo cada vez que se repite (1, 5, 15 minutos); al terminar, los intentos vuelven a empezar. */
    private function bloquear(): void
    {
        $seguidos = RateLimiter::hit($this->claveBloqueos(), 86400);
        $espera = self::ESPERAS[min($seguidos, count(self::ESPERAS)) - 1];

        RateLimiter::clear($this->claveBloqueo());
        RateLimiter::hit($this->claveBloqueo(), $espera);
        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        // Lo que falta de verdad: el bloqueo de esta cuenta o el del equipo, el que termine después
        $segundos = max(
            RateLimiter::tooManyAttempts($this->claveBloqueo(), 1) ? RateLimiter::availableIn($this->claveBloqueo()) : 0,
            RateLimiter::tooManyAttempts($this->claveEquipo(), self::POR_EQUIPO) ? RateLimiter::availableIn($this->claveEquipo()) : 0,
        );
        if ($segundos <= 0) {
            return;
        }

        event(new Lockout($this));

        throw ValidationException::withMessages([
            'ingreso' => __('auth.throttle', ['espera' => $segundos < 60
                ? trans_choice('auth.segundos', $segundos, ['n' => $segundos])
                : trans_choice('auth.minutos', $minutos = (int) ceil($segundos / 60), ['n' => $minutos])]),
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

    private function claveBloqueo(): string
    {
        return 'ingreso-bloqueado|'.$this->throttleKey();
    }

    /** Cuántos bloqueos seguidos lleva la cuenta en este equipo (para alargar el siguiente). */
    private function claveBloqueos(): string
    {
        return 'ingreso-bloqueos|'.$this->throttleKey();
    }

    private function claveEquipo(): string
    {
        return 'ingreso-equipo|'.$this->ip();
    }
}
