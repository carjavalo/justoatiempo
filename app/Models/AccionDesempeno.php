<?php

namespace App\Models;

use App\Enums\TipoAccion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccionDesempeno extends Model
{
    protected $table = 'acciones_desempeno';

    protected $fillable = [
        'user_id', 'linea_servicio_id', 'informe_id', 'novedad_id', 'fecha', 'tipo', 'descripcion',
        'efectividad_referencia', 'notificado', 'registrado_por',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'tipo' => TipoAccion::class,
            'efectividad_referencia' => 'decimal:2',
            'notificado' => 'boolean',
        ];
    }

    /** La persona a la que se le hace el seguimiento. */
    public function persona(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function informe(): BelongsTo
    {
        return $this->belongsTo(InformeDiario::class, 'informe_id');
    }

    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id');
    }

    /** La novedad por la que se tomó (en las líneas sin Drivin). */
    public function novedad(): BelongsTo
    {
        return $this->belongsTo(NovedadLinea::class, 'novedad_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
