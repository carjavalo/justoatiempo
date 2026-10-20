<?php

namespace App\Http\Requests\Admin;

use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Programacion;
use App\Models\Sede;
use App\Models\Sucursal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SucursalRequest extends FormRequest
{
    use LimpiaTexto;

    /** Crear o editar, según el permiso de su rol (la ruta ya lo pide; aquí se confirma). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->puede($this->route('sucursal') ? 'sucursales.editar' : 'sucursales.crear');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'nombre' => $this->texto('nombre'),
            'ciudad' => $this->texto('ciudad'),
            'direccion' => $this->texto('direccion') ?: null,
            'sede_id' => $this->input('sede_id') ?: null,
            // Drivin escribe el plan en mayúsculas ("CALI SUR CROSS"); se guarda igual
            'alias_drivin' => is_string($a = $this->texto('alias_drivin')) ? (mb_strtoupper($a) ?: null) : $a,
        ]);
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:120'],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->whereNull('deleted_at')],
            'ciudad' => ['required', 'string', 'max:80'],
            'direccion' => ['nullable', 'string', 'max:255'],
            // Con dos sucursales con el mismo alias, Drivin no sabría a cuál asignar las órdenes
            'alias_drivin' => ['nullable', 'string', 'max:120', Rule::unique('sucursales', 'alias_drivin')->ignore($this->route('sucursal')?->id)->whereNull('deleted_at')],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Sucursal|null $sucursal */
            $sucursal = $this->route('sucursal');
            $sedeId = $this->integer('sede_id') ?: null;

            // Con usuarios u operación registrada, cambiarla de sede dejaría datos de una sede en otra
            if ($sucursal && $sedeId !== $sucursal->sede_id && (
                $sucursal->asignaciones()->exists()
                || Orden::where('sucursal_id', $sucursal->id)->exists()
                || InformeDiario::where('sucursal_id', $sucursal->id)->exists()
                || Programacion::where('sucursal_id', $sucursal->id)->exists()
            )) {
                $validator->errors()->add('sede_id', 'Esta sucursal ya tiene usuarios u operación registrada: no puede cambiar de sede. Si hace falta, crea una sucursal nueva.');

                return;
            }

            // Una sede inactiva no recibe sucursales nuevas (sí conserva las que ya tenía)
            if ($sedeId && $sedeId !== $sucursal?->sede_id && ! Sede::whereKey($sedeId)->value('activo')) {
                $validator->errors()->add('sede_id', 'Esta sede está inactiva: actívala antes de asignarle sucursales.');

                return;
            }

            // El nombre no se repite dentro de la misma sede ni entre las sucursales propias
            $repetida = Sucursal::withTrashed()
                ->where('nombre', $this->input('nombre'))
                ->when($sedeId, fn ($q) => $q->where('sede_id', $sedeId), fn ($q) => $q->whereNull('sede_id'))
                ->when($sucursal, fn ($q) => $q->whereKeyNot($sucursal->id))
                ->exists();

            if ($repetida) {
                $validator->errors()->add('nombre', $sedeId
                    ? 'Esta sede ya tiene una sucursal con ese nombre.'
                    : 'Ya hay una sucursal propia con ese nombre.');
            }
        }];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'sede_id' => 'la sede', 'ciudad' => 'la ciudad', 'direccion' => 'la dirección', 'alias_drivin' => 'el nombre del plan en Drivin'];
    }

    public function messages(): array
    {
        return ['alias_drivin.unique' => 'Otra sucursal ya usa ese nombre de plan en Drivin.'];
    }

    /** @return array<string, mixed> */
    public function datos(): array
    {
        $datos = $this->validated();

        return [
            'nombre' => $datos['nombre'],
            'sede_id' => $datos['sede_id'] ?? null,
            'ciudad' => $datos['ciudad'],
            'direccion' => $datos['direccion'] ?? null,
            'alias_drivin' => $datos['alias_drivin'] ?? null,
        ];
    }
}
