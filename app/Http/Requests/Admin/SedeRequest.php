<?php

namespace App\Http\Requests\Admin;

use App\Models\Cliente;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Programacion;
use App\Models\Sede;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SedeRequest extends FormRequest
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
            'ciudad' => $this->texto('ciudad'),
            'direccion' => $this->texto('direccion') ?: null,
            'empresa_id' => $this->input('empresa_id') ?: null,
        ]);
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:120'],
            'empresa_id' => ['nullable', 'integer', Rule::exists('clientes', 'id')->whereNull('deleted_at')],
            'ciudad' => ['required', 'string', 'max:80'],
            'direccion' => ['nullable', 'string', 'max:255'],
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
            $empresaId = $this->integer('empresa_id') ?: null;

            // Con usuarios u operación registrada, cambiarla de empresa dejaría datos de una empresa en otra
            if ($sede && $empresaId !== $sede->cliente_id && (
                $sede->usuarios()->exists()
                || Orden::where('sede_id', $sede->id)->exists()
                || InformeDiario::where('sede_id', $sede->id)->exists()
                || Programacion::where('sede_id', $sede->id)->exists()
            )) {
                $validator->errors()->add('empresa_id', 'Esta sede ya tiene usuarios u operación registrada: no puede cambiar de empresa. Si hace falta, crea una sede nueva.');

                return;
            }

            // Una empresa inactiva no recibe sedes nuevas (sí conserva las que ya tenía)
            if ($empresaId && $empresaId !== $sede?->cliente_id && ! Cliente::whereKey($empresaId)->value('activo')) {
                $validator->errors()->add('empresa_id', 'Esta empresa está inactiva: actívala antes de asignarle sedes.');

                return;
            }

            // El nombre no se repite dentro de la misma empresa ni entre las sedes propias
            $repetida = Sede::withTrashed()
                ->where('nombre', $this->input('nombre'))
                ->when($empresaId, fn ($q) => $q->where('cliente_id', $empresaId), fn ($q) => $q->whereNull('cliente_id'))
                ->when($sede, fn ($q) => $q->whereKeyNot($sede->id))
                ->exists();

            if ($repetida) {
                $validator->errors()->add('nombre', $empresaId
                    ? 'Esta empresa ya tiene una sede con ese nombre.'
                    : 'Ya hay una sede propia con ese nombre.');
            }
        }];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'empresa_id' => 'la empresa', 'ciudad' => 'la ciudad', 'direccion' => 'la dirección'];
    }

    /** @return array<string, mixed> */
    public function datos(): array
    {
        $datos = $this->validated();

        return [
            'nombre' => $datos['nombre'],
            'cliente_id' => $datos['empresa_id'] ?? null,
            'ciudad' => $datos['ciudad'],
            'direccion' => $datos['direccion'] ?? null,
        ];
    }
}
