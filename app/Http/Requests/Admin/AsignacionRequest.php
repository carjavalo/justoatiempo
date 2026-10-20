<?php

namespace App\Http\Requests\Admin;

use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Crear o editar una asignación: a qué empresa (o a toda la línea), sede y sucursal va la persona, qué líneas hace
 * allí y por cuánto tiempo. Solo dentro de lo que ve quien asigna, y nunca a sí mismo (salvo quien lo ve todo).
 */
class AsignacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $yo = $this->user();
        /** @var Asignacion|null $asignacion */
        $asignacion = $this->route('asignacion');
        if (! $yo?->puede($asignacion ? 'asignaciones.editar' : 'asignaciones.crear')) {
            return false;
        }

        // Al editar, la asignación de hoy también debe estar dentro de lo que ve
        return ! $asignacion || ($yo->cubreA($asignacion->usuario) && $yo->veAsignacion($asignacion->loadMissing('lineas')));
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'empresa_id' => $this->input('empresa_id') ?: null,
            'sede_id' => $this->input('sede_id') ?: null,
            'sucursal_id' => $this->input('sucursal_id') ?: null,
            'duracion_cantidad' => $this->input('duracion_cantidad') ?: null,
            'fecha_fin' => $this->input('fecha_fin') ?: null,
            'lineas' => $this->input('lineas') ?? [],
        ]);
    }

    public function rules(): array
    {
        return [
            'usuario_id' => [$this->route('asignacion') ? 'prohibited' : 'required', 'integer', Rule::exists('users', 'id')],
            'empresa_id' => ['nullable', 'integer', Rule::exists('empresas', 'id')->whereNull('deleted_at')],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->whereNull('deleted_at')],
            'sucursal_id' => ['nullable', 'integer', Rule::exists('sucursales', 'id')->whereNull('deleted_at')],
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*' => ['integer', 'distinct', Rule::exists('lineas_servicio', 'id')],
            'fecha_inicio' => ['required', 'date'],
            'duracion' => ['required', Rule::in(array_keys(Asignacion::DURACIONES))],
            'duracion_cantidad' => ['nullable', 'required_if:duracion,dias,semanas,meses', 'integer', 'min:1', 'max:999'],
            'fecha_fin' => ['nullable', 'required_if:duracion,fechas', 'date', 'after_or_equal:fecha_inicio'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $yo = $this->user();
            /** @var Asignacion|null $actual */
            $actual = $this->route('asignacion');
            $persona = $actual?->usuario ?? User::find($this->integer('usuario_id'));
            $empresaId = $this->integer('empresa_id') ?: null;
            $sedeId = $this->integer('sede_id') ?: null;
            $sucursalId = $this->integer('sucursal_id') ?: null;
            $lineas = $this->lineas();

            if (! $actual && ! $persona->activo) {
                $validator->errors()->add('usuario_id', 'Esta persona está inactiva: actívala antes de asignarla.');
            }
            // Nadie se asigna a sí mismo (podría darse más de lo que su rol le deja ver), salvo quien ya lo ve todo
            if ($persona->is($yo) && ! $yo->sinLimites()) {
                $validator->errors()->add('usuario_id', 'No puedes cambiar tus propias asignaciones: pídeselo a otra persona.');
            } elseif (! $yo->cubreA($persona)) {
                $validator->errors()->add('usuario_id', 'Esta persona tiene más acceso que tu rol o está fuera de lo que ves: no puedes asignarla.');
            }

            // Empresa, sede y sucursal en cascada; una empresa, sede o sucursal inactiva no recibe asignaciones nuevas
            $empresa = $empresaId ? Empresa::with('lineas:id,nombre')->find($empresaId) : null;
            if ($empresa && ! $empresa->activo && $empresaId !== $actual?->empresa_id) {
                $validator->errors()->add('empresa_id', 'Esta empresa está inactiva: actívala antes de asignarle personas.');
            }
            if ($sedeId) {
                $sede = Sede::find($sedeId, ['id', 'empresa_id', 'activo']);
                if ($sede->empresa_id !== $empresaId) {
                    $validator->errors()->add('sede_id', 'Esta sede no pertenece a la empresa elegida.');
                } elseif (! $sede->activo && $sedeId !== $actual?->sede_id) {
                    $validator->errors()->add('sede_id', 'Esta sede está inactiva: actívala antes de asignarle personas.');
                }
            }
            if ($sucursalId) {
                $sucursal = Sucursal::find($sucursalId, ['id', 'sede_id', 'activo']);
                if ($sucursal->sede_id !== $sedeId) {
                    $validator->errors()->add('sucursal_id', match (true) {
                        $sedeId !== null => 'Esta sucursal no pertenece a la sede elegida.',
                        $sucursal->sede_id !== null => 'Elige primero la sede de esta sucursal.',
                        default => 'Esta sucursal es propia de Justo a Tiempo: solo se asigna sin empresa.',
                    });
                } elseif ($sucursal->sede_id === null && $empresaId) {
                    $validator->errors()->add('sucursal_id', 'Esta sucursal es propia de Justo a Tiempo: solo se asigna sin empresa.');
                } elseif (! $sucursal->activo && $sucursalId !== $actual?->sucursal_id) {
                    $validator->errors()->add('sucursal_id', 'Esta sucursal está inactiva: actívala antes de asignarle personas.');
                }
            }

            // La empresa debe recibir cada línea que hará la persona en ella
            if ($empresa) {
                $faltan = LineaServicio::whereIn('id', array_diff($lineas, $empresa->lineas->pluck('id')->all()))->pluck('nombre');
                if ($faltan->isNotEmpty()) {
                    $validator->errors()->add('lineas', "{$empresa->nombre} no recibe «".$faltan->implode('», «').'».');
                }
            }

            // Solo dentro de lo que ve quien asigna
            if ($validator->errors()->isEmpty() && ($fuera = $yo->motivoFueraDeAlcance($empresaId, $sedeId, $sucursalId, $lineas))) {
                $validator->errors()->add(...$fuera);
            }

            // Sin dos asignaciones al mismo lugar y la misma línea en fechas que se cruzan
            if ($validator->errors()->isEmpty()) {
                [$inicio, $fin] = [$this->inicio(), $this->fin()];
                $cruzada = Asignacion::query()
                    ->with('lineas:id,nombre')
                    ->where('user_id', $persona->id)
                    ->when($actual, fn ($q) => $q->whereKeyNot($actual->id))
                    ->where(fn ($q) => $empresaId ? $q->where('empresa_id', $empresaId) : $q->whereNull('empresa_id'))
                    ->where(fn ($q) => $sedeId ? $q->where('sede_id', $sedeId) : $q->whereNull('sede_id'))
                    ->where(fn ($q) => $sucursalId ? $q->where('sucursal_id', $sucursalId) : $q->whereNull('sucursal_id'))
                    ->whereHas('lineas', fn ($q) => $q->whereIn('lineas_servicio.id', $lineas))
                    ->whereDate('fecha_inicio', '<=', ($fin ?? Carbon::create(9999))->toDateString())
                    ->where(fn ($q) => $q->whereNull('fecha_fin')->orWhereDate('fecha_fin', '>=', $inicio->toDateString()))
                    ->first();
                if ($cruzada) {
                    $linea = $cruzada->lineas->firstWhere(fn ($l) => in_array($l->id, $lineas, true))?->nombre;
                    $validator->errors()->add('lineas', "{$persona->name} ya tiene una asignación en {$cruzada->lugar()} para «{$linea}» en esas fechas: edítala en vez de crear otra.");
                }
            }
        }];
    }

    /** @return list<int> */
    public function lineas(): array
    {
        return array_values(array_unique(array_map('intval', (array) $this->input('lineas', []))));
    }

    public function inicio(): Carbon
    {
        return Carbon::parse($this->input('fecha_inicio'))->startOfDay();
    }

    /** La fecha de fin según la duración elegida (null: indefinida). */
    public function fin(): ?Carbon
    {
        $duracion = (string) $this->input('duracion');

        return Asignacion::calcularFin(
            $this->inicio(),
            $duracion,
            $this->integer('duracion_cantidad') ?: null,
            $this->input('fecha_fin') ? Carbon::parse($this->input('fecha_fin'))->startOfDay() : null,
        );
    }

    /** @return array<string, mixed> */
    public function datos(): array
    {
        $duracion = (string) $this->input('duracion');

        return [
            'empresa_id' => $this->integer('empresa_id') ?: null,
            'sede_id' => $this->integer('sede_id') ?: null,
            'sucursal_id' => $this->integer('sucursal_id') ?: null,
            'fecha_inicio' => $this->inicio()->toDateString(),
            'fecha_fin' => $this->fin()?->toDateString(),
            'duracion' => $duracion,
            'duracion_cantidad' => in_array($duracion, ['dias', 'semanas', 'meses'], true) ? $this->integer('duracion_cantidad') : null,
        ];
    }

    public function messages(): array
    {
        return [
            'usuario_id.required' => 'Elige a la persona.',
            'lineas.required' => 'Elige al menos una línea de servicio: lo que hará allí.',
            'lineas.min' => 'Elige al menos una línea de servicio: lo que hará allí.',
            'fecha_inicio.required' => 'Elige desde cuándo.',
            'duracion_cantidad.required_if' => 'Escribe cuántos.',
            'duracion_cantidad.min' => 'Debe ser al menos 1.',
            'duracion_cantidad.max' => 'Como máximo 999.',
            'fecha_fin.required_if' => 'Elige hasta cuándo.',
            'fecha_fin.after_or_equal' => 'La fecha de fin no puede ser antes de la de inicio.',
            'empresa_id.exists' => 'Elige una empresa de la lista.',
        ];
    }

    public function attributes(): array
    {
        return ['usuario_id' => 'la persona', 'empresa_id' => 'la empresa', 'sede_id' => 'la sede', 'sucursal_id' => 'la sucursal', 'lineas' => 'las líneas', 'fecha_inicio' => 'la fecha de inicio', 'fecha_fin' => 'la fecha de fin', 'duracion' => 'la duración', 'duracion_cantidad' => 'la cantidad'];
    }
}
