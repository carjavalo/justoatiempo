<?php

namespace App\Http\Requests\Admin;

use App\Enums\Rol;
use App\Models\RolUsuario;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Crear o editar un rol de la empresa (auxiliar, conductor, supervisor…) con su nivel de acceso. */
class RolRequest extends FormRequest
{
    use LimpiaTexto;

    public function authorize(): bool
    {
        return (bool) $this->user()?->esAdmin();
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nombre' => $this->texto('nombre'),
            'descripcion' => $this->texto('descripcion') ?: null,
        ]);
    }

    public function rules(): array
    {
        /** @var RolUsuario|null $rol */
        $rol = $this->route('rol');

        return [
            'nombre' => ['required', 'string', 'max:60', Rule::unique('roles', 'nombre')->ignore($rol?->id)],
            'descripcion' => ['nullable', 'string', 'max:200'],
            'nivel' => ['required', Rule::enum(Rol::class)],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var RolUsuario|null $rol */
            $rol = $this->route('rol');
            if (! $rol || $validator->errors()->isNotEmpty() || $this->input('nivel') === $rol->nivel->value) {
                return;
            }

            // Cambiar el nivel cambiaría de golpe lo que pueden hacer sus usuarios: se crea otro rol en su lugar
            if ($rol->base) {
                $validator->errors()->add('nivel', 'Es un rol base de la plataforma: su acceso no se cambia.');
            } elseif ($rol->usuarios()->exists()) {
                $validator->errors()->add('nivel', 'Este rol ya tiene usuarios: para darles otro acceso, crea un rol nuevo y asígnaselo.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'Escribe el nombre del rol.',
            'nombre.unique' => 'Ya hay un rol con este nombre.',
            'nivel.required' => 'Elige qué puede hacer en la plataforma.',
        ];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'descripcion' => 'la descripción', 'nivel' => 'el acceso'];
    }
}
