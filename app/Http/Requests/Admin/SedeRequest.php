<?php

namespace App\Http\Requests\Admin;

use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SedeRequest extends FormRequest
{
    use LimpiaTexto;

    /** Crear o editar, según el permiso de su rol (la ruta ya lo pide; aquí se confirma). */
    public function authorize(): bool
    {
        return (bool) $this->user()?->puede($this->route('sede') ? 'sedes.editar' : 'sedes.crear');
    }

    protected function prepareForValidation(): void
    {
        $meta = $this->texto('meta_efectividad');
        $codigo = $this->texto('codigo');
        $this->merge([
            'nombre' => $this->texto('nombre'),
            'empresa_id' => $this->input('empresa_id') ?: null,
            // Drivin lo escribe en mayúsculas; se guarda igual para reconocerlo
            'codigo' => is_string($codigo) ? (mb_strtoupper($codigo) ?: null) : $codigo,
            // Se acepta la coma decimal ("92,5")
            'meta_efectividad' => is_string($meta) ? str_replace(',', '.', $meta) : $meta,
        ]);
    }

    public function rules(): array
    {
        /** @var Sede|null $sede */
        $sede = $this->route('sede');

        return [
            // Drivin la reconoce por su nombre o su código: ninguno de los dos se repite entre sedes
            'nombre' => ['required', 'string', 'max:120', Rule::unique('sedes', 'nombre')->ignore($sede?->id)],
            'codigo' => ['nullable', 'string', 'max:30', Rule::unique('sedes', 'codigo')->ignore($sede?->id)],
            'empresa_id' => ['required', 'integer', Rule::exists('empresas', 'id')->whereNull('deleted_at')],
            'meta_efectividad' => ['required', 'numeric', 'min:1', 'max:100'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Sede|null $sede */
            $sede = $this->route('sede');
            $empresaId = $this->integer('empresa_id');
            if ($empresaId === $sede?->empresa_id) {
                return;
            }

            // Una empresa inactiva no recibe sedes nuevas (sí conserva las que ya tenía)
            if (! Empresa::whereKey($empresaId)->value('activo')) {
                $validator->errors()->add('empresa_id', 'Esta empresa está inactiva: actívala antes de asignarle sedes.');

                return;
            }

            // Al trasladar una sede, su personal pasa con ella: la empresa nueva debe recibir sus líneas
            if ($sede) {
                $recibe = Empresa::find($empresaId)->lineas()->pluck('lineas_servicio.id');
                $faltan = LineaServicio::whereIn('id', $sede->usuarios()->whereNotNull('linea_servicio_id')->distinct()->pluck('linea_servicio_id'))
                    ->whereNotIn('id', $recibe)
                    ->pluck('nombre');
                if ($faltan->isNotEmpty()) {
                    $validator->errors()->add('empresa_id', 'El personal de esta sede trabaja en «'.$faltan->implode('», «').'», que esa empresa no recibe: márcala primero en la empresa.');
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'nombre.unique' => 'Ya hay una sede con ese nombre.',
            'codigo.unique' => 'Ya hay una sede con ese código.',
            'meta_efectividad.min' => 'La meta de efectividad va de 1 % a 100 %.',
            'meta_efectividad.max' => 'La meta de efectividad va de 1 % a 100 %.',
        ];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'codigo' => 'el código en Drivin', 'empresa_id' => 'la empresa', 'meta_efectividad' => 'la meta de efectividad'];
    }

    /** @return array<string, mixed> Datos de la sede; la empresa se cambia aparte, con su personal (Sede::trasladarA). */
    public function datos(): array
    {
        $datos = $this->validated();

        return [
            'nombre' => $datos['nombre'],
            'codigo' => $datos['codigo'] ?? null,
            'meta_efectividad' => round((float) $datos['meta_efectividad'], 2),
        ];
    }

    public function empresa(): Empresa
    {
        return Empresa::findOrFail($this->integer('empresa_id'));
    }
}
