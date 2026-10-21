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
 * Crear o editar a una persona del personal: sus datos, su rol, su cargo, su foto y su ARL, y si entra a la plataforma
 * (con correo y contraseña) o no (auxiliares y operarios que solo necesitan su carnet). Dónde presta el servicio
 * (empresas, sedes, sucursales y líneas) va aparte, en Asignaciones.
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
            'email' => is_string($e = $this->texto('email')) ? (mb_strtolower($e) ?: null) : $e,
            'password' => $this->input('password') ?: null,
            // Sin decirlo, como siempre: entra a la plataforma
            'acceso' => $this->has('acceso') ? $this->input('acceso') : true,
            'restablecer' => $this->boolean('restablecer'),
            'telefono' => $this->texto('telefono') ?: null,
            'ciudad' => $this->texto('ciudad') ?: null,
            'fecha_nacimiento' => $this->input('fecha_nacimiento') ?: null,
            'fecha_ingreso' => $this->input('fecha_ingreso') ?: null,
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
            // Sin acceso a la plataforma, la cédula es la que la identifica (en su carnet y en las entregas de Drivin)
            'cedula' => ['nullable', 'required_unless:acceso,true', 'string', 'regex:/^\d{5,12}$/', Rule::unique('users', 'cedula')->ignore($usuario?->id)],
            // Sin rol y cargo no se crea el usuario: el cargo va en su carnet
            'cargo' => ['required', 'string', 'max:60'],
            'acceso' => ['required', 'boolean'],
            // Ingresa con su correo o con su cédula: con acceso, al menos uno de los dos
            'email' => ['nullable', Rule::requiredIf(fn () => $this->boolean('acceso') && blank($this->input('cedula'))), 'string', 'email', 'max:150', Rule::unique('users', 'email')->ignore($usuario?->id)],
            'rol_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            // Con acceso y sin contraseña aún: la que se escriba o, en blanco, su cédula (la inicial, que cambia al entrar).
            // Al editar, en blanco conserva la actual. Sin acceso no se usa.
            'password' => [Rule::requiredIf(fn () => $this->boolean('acceso') && blank($usuario?->password) && blank($this->input('cedula'))), 'nullable', 'string', 'max:255', Password::defaults()],
            // Volver a la contraseña inicial (su cédula), p. ej. si la olvidó y no tiene correo para restablecerla
            'restablecer' => ['boolean'],
            'telefono' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{7,30}$/'],
            'ciudad' => ['nullable', 'string', 'max:80'],
            'fecha_nacimiento' => ['nullable', 'date', 'before:-14 years'],
            'fecha_ingreso' => ['nullable', 'date', 'before_or_equal:+1 month'],
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

            // Siempre queda al menos una persona activa, con acceso, con el rol Administrador (la que puede corregir todo)
            $administrador = RolUsuario::administrador();
            $otroAdministrador = fn () => User::where('rol_id', $administrador->id)->where('activo', true)->where('acceso', true)->whereKeyNot($usuario->id)->exists();
            if ($usuario && $administrador && $usuario->rol_id === $administrador->id && $rol->id !== $administrador->id && ! $otroAdministrador()) {
                $validator->errors()->add('rol_id', "Es la única persona con el rol {$administrador->nombre} que puede entrar a la plataforma: dáselo antes a otra persona.");
            }

            // Nadie se quita a sí mismo la entrada a la plataforma
            if ($usuario?->is($this->user()) && ! $this->boolean('acceso')) {
                $validator->errors()->add('acceso', 'No puedes quitarte tu propio acceso: pídeselo a otra persona.');
            }

            if ($usuario && $administrador && $usuario->rol_id === $administrador->id && $usuario->acceso && ! $this->boolean('acceso') && ! $otroAdministrador()) {
                $validator->errors()->add('acceso', "Es la única persona con el rol {$administrador->nombre} que puede entrar a la plataforma: dale acceso antes a otra.");
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
            'email.required' => 'Escribe el correo o la cédula: con uno de los dos entra a la plataforma.',
            'email.unique' => 'Ya hay un usuario con este correo.',
            'cedula.required_unless' => 'Escribe la cédula: sin acceso a la plataforma, es la que identifica a la persona.',
            'password.required' => 'Escribe la contraseña con la que entrará (o su cédula, que sería la inicial).',
            'telefono.regex' => 'Escribe un teléfono válido (solo números, espacios y +).',
            'fecha_nacimiento.before' => 'Revisa la fecha de nacimiento: debe tener al menos 14 años.',
            'fecha_ingreso.before_or_equal' => 'La fecha de ingreso no puede ser tan adelante.',
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
        return ['nombres' => 'los nombres', 'primer_apellido' => 'el primer apellido', 'segundo_apellido' => 'el segundo apellido', 'email' => 'el correo', 'rol_id' => 'el rol', 'password' => 'la contraseña', 'cedula' => 'la cédula', 'cargo' => 'el cargo', 'foto' => 'la foto', 'arl' => 'la ARL', 'acceso' => 'el acceso', 'telefono' => 'el teléfono', 'ciudad' => 'la ciudad', 'fecha_nacimiento' => 'la fecha de nacimiento', 'fecha_ingreso' => 'la fecha de ingreso'];
    }

    /**
     * @return array<string, mixed> Datos listos para guardar; sin contraseña si se dejó en blanco al editar. Sin acceso,
     *                              la contraseña se borra: si después se le da acceso, se le asigna una nueva.
     */
    public function datos(): array
    {
        $datos = $this->validated();
        $acceso = (bool) $datos['acceso'];

        $guardar = [
            'nombres' => $datos['nombres'],
            'primer_apellido' => $datos['primer_apellido'],
            'segundo_apellido' => $datos['segundo_apellido'] ?? null,
            'cedula' => $datos['cedula'] ?? null,
            'cargo' => $datos['cargo'],
            'acceso' => $acceso,
            'email' => $datos['email'] ?? null,
            'telefono' => $datos['telefono'] ?? null,
            'ciudad' => $datos['ciudad'] ?? null,
            'fecha_nacimiento' => $datos['fecha_nacimiento'] ?? null,
            'fecha_ingreso' => $datos['fecha_ingreso'] ?? null,
            // El nivel de acceso sale del rol (lo pone el modelo al guardar)
            'rol_id' => (int) $datos['rol_id'],
        ];

        /** @var User|null $usuario */
        $usuario = $this->route('usuario');
        if (! $acceso) {
            $guardar['password'] = null;
            $guardar['debe_cambiar_contrasena'] = false;
        } elseif (filled($datos['password'] ?? null)) {
            $guardar['password'] = $datos['password'];
            $guardar['debe_cambiar_contrasena'] = false;
        } elseif (filled($datos['cedula'] ?? null) && (($datos['restablecer'] ?? false) || blank($usuario?->password))) {
            // Contraseña inicial: su cédula, que cambia en su primer ingreso
            $guardar['password'] = $datos['cedula'];
            $guardar['debe_cambiar_contrasena'] = true;
        }

        return $guardar;
    }
}
