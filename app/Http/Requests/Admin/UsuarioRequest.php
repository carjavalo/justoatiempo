<?php

namespace App\Http\Requests\Admin;

use App\Enums\Rol;
use App\Models\Empresa;
use App\Models\Sede;
use App\Models\Sucursal;
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
            // La cédula se guarda solo con sus números ("1.144.123.456" → "1144123456")
            'cedula' => is_string($c = $this->input('cedula')) ? (preg_replace('/[\s.,-]/', '', $c) ?: null) : $c,
            'cargo' => $this->texto('cargo') ?: null,
            'email' => is_string($e = $this->texto('email')) ? mb_strtolower($e) : $e,
            'empresa_id' => $this->input('empresa_id') ?: null,
            'sede_id' => $this->input('sede_id') ?: null,
            'sucursal_id' => $this->input('sucursal_id') ?: null,
            'linea_id' => $this->input('linea_id') ?: null,
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
            'cedula' => ['nullable', 'string', 'regex:/^\d{5,12}$/', Rule::unique('users', 'cedula')->ignore($usuario?->id)],
            'cargo' => ['nullable', 'string', 'max:60'],
            'email' => ['required', 'string', 'email', 'max:150', Rule::unique('users', 'email')->ignore($usuario?->id)],
            'rol' => ['required', Rule::enum(Rol::class)],
            'empresa_id' => ['nullable', 'integer', Rule::exists('empresas', 'id')->whereNull('deleted_at')],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->whereNull('deleted_at')],
            'sucursal_id' => ['nullable', 'integer', Rule::exists('sucursales', 'id')->whereNull('deleted_at')],
            'linea_id' => ['nullable', 'integer', Rule::exists('lineas_servicio', 'id')],
            // Al crear es obligatoria; al editar, vacía significa "conservar la actual"
            'password' => [$usuario ? 'nullable' : 'required', 'string', 'max:255', Password::defaults()],
            // Foto para el carnet: opcional (el navegador ya la reduce; el tope cubre fotos sin reducir)
            'foto' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'quitar_foto' => ['nullable', 'boolean'],
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
            $sucursalId = $this->integer('sucursal_id') ?: null;
            $lineaId = $this->integer('linea_id') ?: null;
            $esAdmin = $this->input('rol') === Rol::Admin->value;

            // Cada coordinador o auxiliar trabaja en una sola línea (el administrador ve todas)
            if (! $esAdmin && ! $lineaId) {
                $validator->errors()->add('linea_id', 'Elige la línea de servicio en la que trabaja.');
            }
            if (! $esAdmin && $lineaId && $empresaId && ! Empresa::whereKey($empresaId)->whereHas('lineas', fn ($q) => $q->whereKey($lineaId))->exists()) {
                $validator->errors()->add('empresa_id', 'Esta empresa no recibe la línea de servicio elegida.');
            }

            // Nadie se quita a sí mismo el rol de administrador: la plataforma podría quedar sin quien la gestione
            if ($usuario?->is($this->user()) && $this->input('rol') !== Rol::Admin->value) {
                $validator->errors()->add('rol', 'No puedes quitarte el rol de administrador. Pídeselo a otro administrador.');
            }

            // El administrador no lleva lugar de trabajo (se guarda vacío): lo que sigue no aplica
            if ($esAdmin) {
                return;
            }

            if ($empresaId && $empresaId !== $usuario?->empresa_id && ! Empresa::whereKey($empresaId)->value('activo')) {
                $validator->errors()->add('empresa_id', 'Esta empresa está inactiva: actívala antes de asignarle usuarios.');
            }

            // Cascada: la sede debe ser de la empresa elegida y la sucursal, de la sede elegida
            if ($sedeId) {
                $sede = Sede::find($sedeId, ['id', 'empresa_id', 'activo']);
                if ($sede->empresa_id !== $empresaId) {
                    $validator->errors()->add('sede_id', $empresaId
                        ? 'Esta sede no pertenece a la empresa elegida.'
                        : 'Esta sede es de una empresa: elige primero esa empresa.');
                } elseif (! $sede->activo && $sedeId !== $usuario?->sede_id) {
                    $validator->errors()->add('sede_id', 'Esta sede está inactiva: actívala antes de asignarle usuarios.');
                }
            }

            if ($sucursalId) {
                $sucursal = Sucursal::find($sucursalId, ['id', 'sede_id', 'activo']);
                if ($sucursal->sede_id !== $sedeId) {
                    $validator->errors()->add('sucursal_id', match (true) {
                        $sedeId !== null => 'Esta sucursal no pertenece a la sede elegida.',
                        $sucursal->sede_id !== null => 'Esta sucursal es de una sede: elige primero esa sede.',
                        default => 'Esta sucursal es propia de Justo a Tiempo: quita la sede para asignarla.',
                    });
                } elseif ($sucursal->sede_id === null && $empresaId) {
                    $validator->errors()->add('sucursal_id', 'Esta sucursal es propia de Justo a Tiempo: no se asigna a personal de una empresa.');
                } elseif (! $sucursal->activo && $sucursalId !== $usuario?->sucursal_id) {
                    $validator->errors()->add('sucursal_id', 'Esta sucursal está inactiva: actívala antes de asignarle usuarios.');
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Ya hay un usuario con este correo.',
            'cedula.regex' => 'Escribe solo los números de la cédula (entre 5 y 12).',
            'cedula.unique' => 'Ya hay un usuario con esta cédula.',
            'foto.image' => 'La foto debe ser una imagen JPG, PNG o WebP.',
            'foto.mimes' => 'La foto debe ser una imagen JPG, PNG o WebP.',
            'foto.max' => 'La foto no puede pesar más de 8 MB.',
            'foto.uploaded' => 'No se pudo subir la foto. Intenta con una más liviana.',
        ];
    }

    public function attributes(): array
    {
        return ['linea_id' => 'la línea de servicio', 'nombres' => 'los nombres', 'primer_apellido' => 'el primer apellido', 'segundo_apellido' => 'el segundo apellido', 'email' => 'el correo', 'rol' => 'el rol', 'empresa_id' => 'la empresa', 'sede_id' => 'la sede', 'sucursal_id' => 'la sucursal', 'password' => 'la contraseña', 'cedula' => 'la cédula', 'cargo' => 'el cargo', 'foto' => 'la foto'];
    }

    /** @return array<string, mixed> Datos listos para guardar; sin contraseña si se dejó en blanco al editar. */
    public function datos(): array
    {
        $datos = $this->validated();
        $esAdmin = $datos['rol'] === Rol::Admin->value;

        $guardar = [
            'nombres' => $datos['nombres'],
            'primer_apellido' => $datos['primer_apellido'],
            'segundo_apellido' => $datos['segundo_apellido'] ?? null,
            'cedula' => $datos['cedula'] ?? null,
            'cargo' => $datos['cargo'] ?? null,
            'email' => $datos['email'],
            'rol' => $datos['rol'],
            // El administrador ve todo: no se le asigna línea ni lugar de trabajo
            'empresa_id' => $esAdmin ? null : ($datos['empresa_id'] ?? null),
            'sede_id' => $esAdmin ? null : ($datos['sede_id'] ?? null),
            'sucursal_id' => $esAdmin ? null : ($datos['sucursal_id'] ?? null),
            'linea_servicio_id' => $esAdmin ? null : ($datos['linea_id'] ?? null),
        ];

        if (filled($datos['password'] ?? null)) {
            $guardar['password'] = $datos['password'];
        }

        return $guardar;
    }
}
