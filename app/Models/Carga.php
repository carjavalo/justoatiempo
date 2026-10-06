<?php

namespace App\Models;

use App\Enums\EstadoCarga;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Carga extends Model
{
    protected $fillable = [
        'archivo_nombre', 'archivo_path', 'archivo_hash', 'fecha_operacion', 'estado',
        'total_filas', 'filas_validas', 'filas_error', 'errores', 'mapeo_columnas',
        'duracion_ms', 'cargado_por', 'procesado_en',
    ];

    protected function casts(): array
    {
        return [
            'fecha_operacion' => 'date',
            'estado' => EstadoCarga::class,
            'errores' => 'array',
            'mapeo_columnas' => 'array',
            'procesado_en' => 'datetime',
        ];
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cargado_por');
    }
}
