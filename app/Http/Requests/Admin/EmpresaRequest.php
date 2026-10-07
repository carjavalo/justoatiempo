<?php

namespace App\Http\Requests\Admin;

use App\Models\Cliente;
use App\Support\Nit;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EmpresaRequest extends FormRequest
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
            'nit' => $this->texto('nit') ?: null,
            'contacto_email' => is_string($e = $this->texto('contacto_email')) ? (mb_strtolower($e) ?: null) : $e,
        ]);
    }

    public function rules(): array
    {
        /** @var Cliente|null $empresa */
        $empresa = $this->route('empresa');

        return [
            'nombre' => ['required', 'string', 'max:120', Rule::unique('clientes', 'nombre')->ignore($empresa?->id)],
            'nit' => ['nullable', 'string', 'max:25', function (string $atributo, mixed $valor, Closure $falla) use ($empresa) {
                $partes = Nit::partes((string) $valor);
                if (! $partes) {
                    $falla('Escribe el NIT solo con números y, si quieres, el dígito de verificación después de un guion (900123456-8).');

                    return;
                }
                [$numero, $dv] = $partes;
                $esperado = Nit::digitoVerificacion($numero);
                if ($dv !== null && $dv !== $esperado) {
                    $falla("El dígito de verificación no corresponde: para {$numero} es {$esperado}.");

                    return;
                }
                $existe = Cliente::withTrashed()
                    ->where('nit', $numero.'-'.$esperado)
                    ->when($empresa, fn ($q) => $q->whereKeyNot($empresa->id))
                    ->exists();
                if ($existe) {
                    $falla('Ya hay una empresa registrada con este NIT.');
                }
            }],
            'contacto_nombre' => ['nullable', 'string', 'max:120'],
            'contacto_email' => ['nullable', 'email', 'max:150'],
            'contacto_telefono' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{7,30}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.unique' => 'Ya hay una empresa con esta razón social.',
            'contacto_telefono.regex' => 'Escribe un teléfono válido (solo números, espacios y +).',
        ];
    }

    public function attributes(): array
    {
        return [
            'nombre' => 'la razón social',
            'nit' => 'el NIT',
            'contacto_nombre' => 'el nombre del contacto',
            'contacto_email' => 'el correo del contacto',
            'contacto_telefono' => 'el teléfono del contacto',
        ];
    }

    /** @return array<string, mixed> Datos listos para guardar, con el NIT normalizado. */
    public function datos(): array
    {
        $datos = $this->validated();
        $datos['nit'] = filled($datos['nit'] ?? null) ? Nit::normalizar($datos['nit']) : null;

        return $datos;
    }
}
