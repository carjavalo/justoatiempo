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
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return ['email.required' => 'Escribe tu correo o tu cédula.'];
    }

    /** Con qué se identifica: el correo (si trae @) o la cédula (solo sus números). */
    private function credenciales(): array
    {
        $usuario = trim((string) $this->input('email'));
        $campo = str_contains($usuario, '@') ? ['email' => mb_strtolower($usuario)] : ['cedula' => preg_replace('/\D/', '', $usuario)];

        return [...$campo, 'password' => (string) $this->input('password')];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credenciales = $this->credenciales();
        if (in_array('', [$credenciales['email'] ?? null, $credenciales['cedula'] ?? null], true) || ! Auth::attempt($credenciales, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        if (! Auth::user()->activo) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => 'Tu usuario está desactivado. Habla con el administrador para recuperar el acceso.',
            ]);
        }

        // Sigue siendo parte del personal (con su carnet), pero ya no entra a la plataforma
        if (! Auth::user()->acceso) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => 'Tu usuario no tiene acceso a la plataforma. Si lo necesitas, habla con el administrador.',
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
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
