<?php

namespace App\Models;

use App\Enums\TipoAccion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccionDesempeno extends Model
{
    protected $table = 'acciones_desempeno';

    protected $fillable = [
        'empleado_id', 'informe_id', 'fecha', 'tipo', 'descripcion',
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

    public function empleado(): BelongsTo
    {
        return $this->belongsTo(Empleado::class);
    }

    public function informe(): BelongsTo
    {
        return $this->belongsTo(InformeDiario::class, 'informe_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
