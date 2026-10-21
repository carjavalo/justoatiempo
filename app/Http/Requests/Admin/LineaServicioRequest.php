<?php

namespace App\Http\Requests\Admin;

use App\Models\LineaServicio;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Crear o editar una línea de servicio: su nombre, qué hace y su ícono. */
class LineaServicioRequest extends FormRequest
{
    use LimpiaTexto;

    public function authorize(): bool
    {
        return (bool) $this->user()?->puede($this->route('servicio') ? 'servicios.editar' : 'servicios.crear');
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
        /** @var LineaServicio|null $linea */
        $linea = $this->route('servicio');

        return [
            'nombre' => ['required', 'string', 'max:120', Rule::unique('lineas_servicio', 'nombre')->ignore($linea?->id)],
            'descripcion' => ['nullable', 'string', 'max:300'],
            'icono' => ['required', Rule::in(LineaServicio::ICONOS)],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.unique' => 'Ya hay una línea de servicio con este nombre.',
            'icono.required' => 'Elige un ícono para la línea.',
            'icono.in' => 'Elige uno de los íconos de la lista.',
        ];
    }

    public function attributes(): array
    {
        return ['nombre' => 'el nombre', 'descripcion' => 'la descripción', 'icono' => 'el ícono'];
    }
}
