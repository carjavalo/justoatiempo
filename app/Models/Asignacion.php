<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Dónde presta el servicio una persona y qué hace allí: una empresa (sin empresa, toda la línea), su sede y su
 * sucursal (opcionales), las líneas de servicio que hace y el periodo. Una persona puede tener varias a la vez.
 */
class Asignacion extends Model
{
    protected $table = 'asignaciones';

    /** Cómo se elige el periodo. */
    public const DURACIONES = [
        'indefinida' => 'Indefinida',
        'dias' => 'Por días',
        'semanas' => 'Por semanas',
        'meses' => 'Por meses',
        'fechas' => 'Entre dos fechas',
    ];

    protected $fillable = ['user_id', 'empresa_id', 'sede_id', 'sucursal_id', 'fecha_inicio', 'fecha_fin', 'duracion', 'duracion_cantidad', 'creada_por'];

    protected function casts(): array
    {
        return ['fecha_inicio' => 'date', 'fecha_fin' => 'date', 'duracion_cantidad' => 'integer'];
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class)->withTrashed();
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class)->withTrashed();
    }

    public function lineas(): BelongsToMany
    {
        return $this->belongsToMany(LineaServicio::class, 'asignacion_linea')->orderBy('orden');
    }

    public function creadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creada_por');
    }

    /** Las que están en curso hoy: ya empezaron y no han terminado. */
    public function scopeVigentes(Builder $q, ?Carbon $dia = null): Builder
    {
        $fecha = ($dia ?? today())->toDateString();

        return $q->whereDate('asignaciones.fecha_inicio', '<=', $fecha)
            ->where(fn (Builder $w) => $w->whereNull('asignaciones.fecha_fin')->orWhereDate('asignaciones.fecha_fin', '>=', $fecha));
    }

    /** Las actuales: las que no han terminado (vigentes y programadas). */
    public function scopeActuales(Builder $q): Builder
    {
        return $q->where(fn (Builder $w) => $w->whereNull('asignaciones.fecha_fin')->orWhereDate('asignaciones.fecha_fin', '>=', today()->toDateString()));
    }

    /** Las vigentes que terminan en los próximos 7 días. */
    public function scopeTerminanPronto(Builder $q): Builder
    {
        return $q->vigentes()->whereNotNull('asignaciones.fecha_fin')->whereDate('asignaciones.fecha_fin', '<=', today()->addDays(7)->toDateString());
    }

    public function scopeProgramadas(Builder $q): Builder
    {
        return $q->whereDate('asignaciones.fecha_inicio', '>', today()->toDateString());
    }

    public function scopeTerminadas(Builder $q): Builder
    {
        return $q->whereNotNull('asignaciones.fecha_fin')->whereDate('asignaciones.fecha_fin', '<', today()->toDateString());
    }

    /** vigente, programada o terminada (según la fecha de hoy). */
    public function estado(): string
    {
        return match (true) {
            $this->fecha_inicio->isFuture() => 'programada',
            $this->fecha_fin !== null && $this->fecha_fin->lt(today()) => 'terminada',
            default => 'vigente',
        };
    }

    /**
     * Fecha de fin según cómo se eligió el periodo: indefinida (sin fin), por días, semanas o meses (contando el
     * día de inicio) o entre dos fechas (la elegida).
     */
    public static function calcularFin(Carbon $inicio, string $duracion, ?int $cantidad, ?Carbon $finElegido): ?Carbon
    {
        return match ($duracion) {
            'dias' => $inicio->copy()->addDays(max(1, (int) $cantidad) - 1),
            'semanas' => $inicio->copy()->addWeeks(max(1, (int) $cantidad))->subDay(),
            'meses' => $inicio->copy()->addMonthsNoOverflow(max(1, (int) $cantidad))->subDay(),
            'fechas' => $finElegido,
            default => null,
        };
    }

    /** "Indefinida", "Por 15 días", "Por 3 meses" o "Hasta el 30 de nov. de 2026". */
    public function textoDuracion(): string
    {
        $n = $this->duracion_cantidad ?? 1;

        return match ($this->duracion) {
            'dias' => 'Por '.$n.' '.($n === 1 ? 'día' : 'días'),
            'semanas' => 'Por '.$n.' '.($n === 1 ? 'semana' : 'semanas'),
            'meses' => 'Por '.$n.' '.($n === 1 ? 'mes' : 'meses'),
            'fechas' => 'Entre dos fechas',
            default => 'Indefinida',
        };
    }

    /** "Ditranza · TuGo · Cali Sur" (sin empresa: "Toda la línea"). */
    public function lugar(): string
    {
        $partes = array_filter([$this->empresa?->nombre ?? 'Toda la línea', $this->sede?->nombre, $this->sucursal?->nombre]);

        return implode(' · ', $partes);
    }
}
