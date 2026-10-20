<?php

namespace App\Http\Requests\Admin;

use App\Models\RolUsuario;
use App\Support\Permisos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Crear o editar un rol de la empresa (auxiliar, conductor, supervisor…) con sus permisos: qué módulos ve, qué
 * puede hacer en cada uno y el alcance de lo que ve de la operación.
 */
class RolRequest extends FormRequest
{
    use LimpiaTexto;

    /** Crear o editar, según el permiso de su rol (la ruta ya lo pide; aquí se confirma). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->puede($this->route('rol') ? 'roles.editar' : 'roles.crear');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nombre' => $this->texto('nombre'),
            'descripcion' => $this->texto('descripcion') ?: null,
            'permisos' => $this->input('permisos') ?? [],
        ]);
    }

    public function rules(): array
    {
        /** @var RolUsuario|null $rol */
        $rol = $this->route('rol');

        return [
            'nombre' => ['required', 'string', 'max:60', Rule::unique('roles', 'nombre')->ignore($rol?->id)],
            'descripcion' => ['nullable', 'string', 'max:200'],
            // Sin permisos es válido: quien tenga el rol solo verá su carnet
            'permisos' => ['present', 'array'],
            'permisos.*' => ['string', Rule::in(Permisos::todos())],
            'alcance' => ['required', Rule::in(array_keys(Permisos::alcances()))],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var RolUsuario|null $rol */
            $rol = $this->route('rol');
            $miRol = $this->user()->rolUsuario;

            // Nadie cambia un rol con más acceso que el suyo (tampoco el nombre: el del Administrador, solo quien lo tiene todo)
            if ($rol && ! $miRol?->cubre($rol)) {
                $validator->errors()->add('permisos', 'Este rol tiene permisos que el tuyo no tiene: no puedes cambiarlo.');

                return;
            }

            // El Administrador de la plataforma siempre lo puede todo: de él solo cambian el nombre y la descripción
            if ($rol?->esAdministradorBase()) {
                return;
            }

            $nuevos = $this->permisos();
            $faltan = array_values(array_diff($nuevos, $miRol?->permisos ?? []));
            if ($faltan !== []) {
                $validator->errors()->add('permisos', 'Solo puedes dar permisos que tu propio rol tiene. Quita: '.$this->nombres($faltan).'.');
            }
            if (! Permisos::alcanceCubre($miRol?->alcance ?? Permisos::ALCANCE_PROPIO, $this->input('alcance'))) {
                $validator->errors()->add('alcance', 'Tu propio rol no ve tanto de la operación: elige un alcance igual o más limitado que el tuyo.');
            }

            // Sin estos permisos en su propio rol, nadie podría volver a corregirlo
            if ($rol && $miRol?->is($rol)) {
                $quitados = array_values(array_diff(array_intersect(Permisos::IMPRESCINDIBLES, $rol->permisos ?? []), $nuevos));
                if ($quitados !== []) {
                    $validator->errors()->add('permisos', 'No puedes quitarle a tu propio rol '.$this->nombres($quitados).': pídeselo a otra persona con ese permiso.');
                }
            }
        }];
    }

    /** @return list<string> Los permisos elegidos, con lo que cada uno necesita (y solo los que el alcance permite). */
    public function permisos(): array
    {
        return Permisos::normalizar((array) $this->input('permisos', []), $this->input('alcance'));
    }

    /** ["usuarios.editar", "roles.editar"] → "«Usuarios: Editar» y «Roles: Editar»" */
    private function nombres(array $permisos): string
    {
        $textos = array_map(function (string $permiso) {
            if ($permiso === Permisos::TODAS_LAS_LINEAS) {
                return '«Todas las líneas de servicio»';
            }
            [$modulo, $accion] = explode('.', $permiso);
            foreach (Permisos::CATALOGO as $grupo) {
                if (isset($grupo['modulos'][$modulo]['acciones'][$accion])) {
                    return "«{$grupo['modulos'][$modulo]['titulo']}: {$grupo['modulos'][$modulo]['acciones'][$accion]}»";
                }
            }

            return "«{$permiso}»";
        }, $permisos);

        return count($textos) > 1 ? implode(', ', array_slice($textos, 0, -1)).' y '.end($textos) : ($textos[0] ?? '');
    }

    /** @return array<string, mixed> Datos listos para guardar. */
    public function datos(): array
    {
        return [
            'nombre' => $this->validated('nombre'),
            'descripcion' => $this->validated('descripcion'),
            'permisos' => $this->permisos(),
            'alcance' => $this->validated('alcance'),
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'Escribe el nombre del rol.',
            'nombre.unique' => 'Ya hay un rol con este nombre.',
            'permisos.*.in' => 'Hay un permiso que no existe: recarga la página e inténtalo de nuevo.',
            'alcance.required' => 'Elige qué ve de la operación.',
        ];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'descripcion' => 'la descripción', 'permisos' => 'los permisos', 'alcance' => 'el alcance'];
    }
}
