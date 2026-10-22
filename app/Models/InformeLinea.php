<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InformeLinea extends Model
{
    protected $fillable = [
        'informe_id', 'ruta', 'vehiculo_id', 'placa', 'auxiliar_id', 'auxiliar_nombre',
        'ordenes', 'asignadas', 'aprobadas', 'rechazadas', 'efectividad', 'devoluciones',
        'averias', 'faltantes', 'ordenes_sin_evidencia', 'pod_cumple', 'novedades', 'observacion',
    ];

    protected function casts(): array
    {
        return [
            'efectividad' => 'decimal:2',
            'pod_cumple' => 'boolean',
        ];
    }

    public function informe(): BelongsTo
    {
        return $this->belongsTo(InformeDiario::class, 'informe_id');
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function auxiliar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auxiliar_id');
    }
}
