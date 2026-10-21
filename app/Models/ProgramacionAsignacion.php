<?php

namespace App\Models;

use App\Enums\EstadoAsistencia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Una persona programada en un día: su turno, su vehículo y ruta (logística) y su asistencia. */
class ProgramacionAsignacion extends Model
{
    protected $table = 'programacion_asignaciones';

    protected $fillable = [
        'programacion_id', 'user_id', 'hora_entrada', 'hora_salida', 'vehiculo_id', 'ruta',
        'asistencia', 'hora_llegada', 'observacion', 'asistencia_por', 'asistencia_en',
    ];

    protected function casts(): array
    {
        return ['asistencia' => EstadoAsistencia::class, 'asistencia_en' => 'datetime'];
    }

    public function programacion(): BelongsTo
    {
        return $this->belongsTo(Programacion::class);
    }

    public function persona(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function registradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'asistencia_por');
    }
}
