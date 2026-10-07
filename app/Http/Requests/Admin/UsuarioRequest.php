<?php

namespace App\Http\Requests\Admin;

use App\Enums\Rol;
use App\Models\Cliente;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class UsuarioRequest extends FormRequest
{
    use LimpiaTexto;

    public function authorize(): bool
    {
        return (bool) $this->user()?->esAdmin();
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nombres' => $this->texto('nombres'),
            'primer_apellido' => $this->texto('primer_apellido'),
            'segundo_apellido' => $this->texto('segundo_apellido') ?: null,
            'email' => is_string($e = $this->texto('email')) ? mb_strtolower($e) : $e,
            'empresa_id' => $this->input('empresa_id') ?: null,
            'sede_id' => $this->input('sede_id') ?: null,
            'password' => $this->input('password') ?: null,
        ]);
    }

    public function rules(): array
    {
        /** @var User|null $usuario */
        $usuario = $this->route('usuario');

        return [
            'nombres' => ['required', 'string', 'max:80'],
            'primer_apellido' => ['required', 'string', 'max:80'],
            'segundo_apellido' => ['nullable', 'string', 'max:80'],
            'email' => ['required', 'string', 'email', 'max:150', Rule::unique('users', 'email')->ignore($usuario?->id)],
            'rol' => ['required', Rule::enum(Rol::class)],
            'empresa_id' => ['nullable', 'integer', Rule::exists('clientes', 'id')->whereNull('deleted_at')],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->whereNull('deleted_at')],
            // Al crear es obligatoria; al editar, vacía significa "conservar la actual"
            'password' => [$usuario ? 'nullable' : 'required', 'string', 'max:255', Password::defaults()],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var User|null $usuario */
            $usuario = $this->route('usuario');
            $empresaId = $this->integer('empresa_id') ?: null;
            $sedeId = $this->integer('sede_id') ?: null;

            // Nadie se quita a sí mismo el rol de administrador: la plataforma podría quedar sin quien la gestione
            if ($usuario?->is($this->user()) && $this->input('rol') !== Rol::Admin->value) {
                $validator->errors()->add('rol', 'No puedes quitarte el rol de administrador. Pídeselo a otro administrador.');
            }

            if ($empresaId && $empresaId !== $usuario?->cliente_id && ! Cliente::whereKey($empresaId)->value('activo')) {
                $validator->errors()->add('empresa_id', 'Esta empresa está inactiva: actívala antes de asignarle usuarios.');
            }

            if ($sedeId) {
                $sede = Sede::find($sedeId, ['id', 'cliente_id', 'activo']);
                if ($sede->cliente_id !== $empresaId) {
                    $validator->errors()->add('sede_id', $empresaId
                        ? 'Esta sede no pertenece a la empresa elegida.'
                        : 'Esta sede es de una empresa cliente: elige primero esa empresa.');
                } elseif (! $sede->activo && $sedeId !== $usuario?->sede_id) {
                    $validator->errors()->add('sede_id', 'Esta sede está inactiva: actívala antes de asignarle usuarios.');
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Ya hay un usuario con este correo.',
        ];
    }

    public function attributes(): array
    {
        return ['nombres' => 'los nombres', 'primer_apellido' => 'el primer apellido', 'segundo_apellido' => 'el segundo apellido', 'email' => 'el correo', 'rol' => 'el rol', 'empresa_id' => 'la empresa', 'sede_id' => 'la sede', 'password' => 'la contraseña'];
    }

    /** @return array<string, mixed> Datos listos para guardar; sin contraseña si se dejó en blanco al editar. */
    public function datos(): array
    {
        $datos = $this->validated();

        $guardar = [
            'nombres' => $datos['nombres'],
            'primer_apellido' => $datos['primer_apellido'],
            'segundo_apellido' => $datos['segundo_apellido'] ?? null,
            'email' => $datos['email'],
            'rol' => $datos['rol'],
            'cliente_id' => $datos['empresa_id'] ?? null,
            'sede_id' => $datos['sede_id'] ?? null,
        ];

        if (filled($datos['password'] ?? null)) {
            $guardar['password'] = $datos['password'];
        }

        return $guardar;
    }
}
