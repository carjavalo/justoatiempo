<?php

namespace App\Models;

use App\Enums\EstadoCarga;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Carga extends Model
{
    protected $fillable = [
        'archivo_nombre', 'archivo_path', 'archivo_hash', 'hoja', 'fila_encabezados', 'fecha_operacion', 'estado',
        'total_filas', 'filas_validas', 'filas_error', 'ordenes_importadas', 'advertencias', 'errores',
        'mapeo_columnas', 'opciones', 'resumen', 'duracion_ms', 'cargado_por', 'procesado_en', 'anulada_por', 'anulada_en',
    ];

    protected function casts(): array
    {
        return [
            'fecha_operacion' => 'date',
            'estado' => EstadoCarga::class,
            'errores' => 'array',
            'mapeo_columnas' => 'array',
            'opciones' => 'array',
            'resumen' => 'array',
            'procesado_en' => 'datetime',
            'anulada_en' => 'datetime',
        ];
    }

    public function enRevision(): bool
    {
        return $this->estado === EstadoCarga::EnRevision;
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cargado_por');
    }

    public function anuladaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulada_por');
    }
}
