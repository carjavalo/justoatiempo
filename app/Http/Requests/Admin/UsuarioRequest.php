<?php

namespace App\Http\Requests\Admin;

use App\Models\RolUsuario;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

/**
 * Crear o editar a una persona: sus datos, su rol, su cargo, su foto y su ARL. Dónde presta el servicio (empresas,
 * sedes, sucursales y líneas) va aparte, en Asignaciones.
 */
class UsuarioRequest extends FormRequest
{
    use LimpiaTexto;

    /** Crear o editar, según el permiso de su rol (la ruta ya lo pide; aquí se confirma). */
    public function authorize(): bool
    {
        $usuario = $this->route('usuario');

        // Nadie edita a alguien con más acceso que el suyo (podría tomar su cuenta cambiándole la contraseña)
        return (bool) $this->user()?->puede($usuario ? 'usuarios.editar' : 'usuarios.crear')
            && (! $usuario || $this->user()->cubreA($usuario));
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
            // Sin rol y cargo no se crea el usuario: el cargo va en su carnet
            'cargo' => ['required', 'string', 'max:60'],
            'email' => ['required', 'string', 'email', 'max:150', Rule::unique('users', 'email')->ignore($usuario?->id)],
            'rol_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            // Al crear es obligatoria; al editar, vacía significa "conservar la actual"
            'password' => [$usuario ? 'nullable' : 'required', 'string', 'max:255', Password::defaults()],
            // Foto para el carnet: opcional (el navegador ya la reduce; el tope cubre fotos sin reducir)
            'foto' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'quitar_foto' => ['nullable', 'boolean'],
            // Certificado de ARL: imagen (las fotos se reducen en el navegador) o PDF
            'arl' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'quitar_arl' => ['nullable', 'boolean'],
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
            $rol = RolUsuario::find($this->integer('rol_id'));
            $miRol = $this->user()->rolUsuario;

            if (! $rol->activo && $rol->id !== $usuario?->rol_id) {
                $validator->errors()->add('rol_id', 'Este rol está inactivo: actívalo en Roles antes de asignarlo.');
            }

            // Solo se asignan roles con, como mucho, los permisos del propio (nadie da más acceso del que tiene)
            if ($rol->id !== $usuario?->rol_id && ! $miRol?->cubre($rol)) {
                $validator->errors()->add('rol_id', 'Este rol tiene permisos que el tuyo no tiene: no puedes asignarlo.');
            }

            // Siempre queda al menos una persona activa con el rol Administrador (la que puede corregir todo)
            $administrador = RolUsuario::administrador();
            if ($usuario && $administrador && $usuario->rol_id === $administrador->id && $rol->id !== $administrador->id
                && ! User::where('rol_id', $administrador->id)->where('activo', true)->whereKeyNot($usuario->id)->exists()) {
                $validator->errors()->add('rol_id', "Es la única persona activa con el rol {$administrador->nombre}: dáselo antes a otra persona.");
            }

            // Nadie se quita a sí mismo lo que necesita para corregir usuarios y roles
            if ($usuario?->is($this->user())) {
                $quitados = array_diff(array_intersect(Permisos::IMPRESCINDIBLES, $miRol?->permisos ?? []), $rol->permisos ?? []);
                if ($quitados !== []) {
                    $validator->errors()->add('rol_id', 'No puedes cambiarte a un rol sin los permisos para editar usuarios y roles. Pídeselo a otra persona.');
                }
            }

        }];
    }

    public function messages(): array
    {
        return [
            'rol_id.required' => 'Elige el rol.',
            'cargo.required' => 'Escribe el cargo: va en el carnet.',
            'email.unique' => 'Ya hay un usuario con este correo.',
            'cedula.regex' => 'Escribe solo los números de la cédula (entre 5 y 12).',
            'cedula.unique' => 'Ya hay un usuario con esta cédula.',
            'foto.image' => 'La foto debe ser una imagen JPG, PNG o WebP.',
            'foto.mimes' => 'La foto debe ser una imagen JPG, PNG o WebP.',
            'foto.max' => 'La foto no puede pesar más de 8 MB.',
            'foto.uploaded' => 'No se pudo subir la foto. Intenta con una más liviana.',
            'arl.mimes' => 'La ARL debe ser un PDF o una imagen JPG, PNG o WebP.',
            'arl.max' => 'El archivo de la ARL no puede pesar más de 10 MB.',
            'arl.uploaded' => 'No se pudo subir la ARL. Intenta con un archivo más liviano.',
        ];
    }

    public function attributes(): array
    {
        return ['nombres' => 'los nombres', 'primer_apellido' => 'el primer apellido', 'segundo_apellido' => 'el segundo apellido', 'email' => 'el correo', 'rol_id' => 'el rol', 'password' => 'la contraseña', 'cedula' => 'la cédula', 'cargo' => 'el cargo', 'foto' => 'la foto', 'arl' => 'la ARL'];
    }

    /** @return array<string, mixed> Datos listos para guardar; sin contraseña si se dejó en blanco al editar. */
    public function datos(): array
    {
        $datos = $this->validated();

        $guardar = [
            'nombres' => $datos['nombres'],
            'primer_apellido' => $datos['primer_apellido'],
            'segundo_apellido' => $datos['segundo_apellido'] ?? null,
            'cedula' => $datos['cedula'] ?? null,
            'cargo' => $datos['cargo'],
            'email' => $datos['email'],
            // El nivel de acceso sale del rol (lo pone el modelo al guardar)
            'rol_id' => (int) $datos['rol_id'],
        ];

        if (filled($datos['password'] ?? null)) {
            $guardar['password'] = $datos['password'];
        }

        return $guardar;
    }
}
