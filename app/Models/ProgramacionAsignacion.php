<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramacionAsignacion extends Model
{
    protected $table = 'programacion_asignaciones';

    protected $fillable = ['programacion_id', 'empleado_id', 'vehiculo_id', 'ruta'];

    public function programacion(): BelongsTo
    {
        return $this->belongsTo(Programacion::class);
    }

    public function empleado(): BelongsTo
    {
        return $this->belongsTo(Empleado::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }
}
