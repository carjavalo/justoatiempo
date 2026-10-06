<?php

namespace App\Models;

use App\Enums\EstadoInforme;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InformeDiario extends Model
{
    protected $table = 'informes_diarios';

    protected $fillable = [
        'fecha_operacion', 'cliente_id', 'sede_id', 'estado',
        'total_asignadas', 'total_aprobadas', 'total_rechazadas', 'total_devoluciones',
        'total_averias', 'total_faltantes', 'efectividad', 'observaciones',
        'cerrado_por', 'cerrado_en',
    ];

    protected function casts(): array
    {
        return [
            'fecha_operacion' => 'date',
            'estado' => EstadoInforme::class,
            'efectividad' => 'decimal:2',
            'cerrado_en' => 'datetime',
        ];
    }

    public function estaCerrado(): bool
    {
        return $this->estado === EstadoInforme::Cerrado;
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class, 'informe_id');
    }

    public function lineas(): HasMany
    {
        return $this->hasMany(InformeLinea::class, 'informe_id');
    }

    public function acciones(): HasMany
    {
        return $this->hasMany(AccionDesempeno::class, 'informe_id');
    }

    public function cerradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrado_por');
    }
}
