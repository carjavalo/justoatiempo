<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * La programación de un día en un lugar de una línea de servicio: cuántas personas (y, en logística, cuántos
 * vehículos) se requieren en la empresa, su sede o su sucursal, y quiénes van.
 */
class Programacion extends Model
{
    use SoftDeletes;

    protected $table = 'programaciones';

    protected $fillable = [
        'fecha', 'linea_servicio_id', 'empresa_id', 'sede_id', 'sucursal_id', 'personas_requeridas',
        'vehiculos_requeridos', 'observaciones', 'creado_por',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id')->withTrashed();
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

    /** Las personas programadas, con su turno y su asistencia. */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(ProgramacionAsignacion::class);
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por')->withTrashed();
    }

    /** "Ditransa · TuGo · Cali Sur". */
    public function lugar(): string
    {
        return implode(' · ', array_filter([$this->empresa?->nombre, $this->sede?->nombre, $this->sucursal?->nombre]));
    }
}
