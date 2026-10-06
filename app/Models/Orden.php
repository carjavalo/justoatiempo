<?php

namespace App\Models;

use App\Enums\EstadoOrden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Orden extends Model
{
    protected $table = 'ordenes';

    protected $fillable = [
        'carga_id', 'informe_id', 'fecha_operacion', 'cliente_id', 'sede_id', 'ruta',
        'vehiculo_id', 'placa', 'empleado_id', 'auxiliar_nombre',
        'codigo_orden', 'codigo_direccion', 'destinatario', 'direccion', 'ciudad', 'unidades',
        'estado', 'motivo_rechazo_id', 'motivo_texto', 'comentario_pod', 'hora_entrega',
        'devolucion', 'averia', 'averia_detalle', 'faltante', 'faltante_detalle', 'datos_crudos',
    ];

    protected function casts(): array
    {
        return [
            'fecha_operacion' => 'date',
            'estado' => EstadoOrden::class,
            'hora_entrega' => 'datetime',
            'devolucion' => 'boolean',
            'averia' => 'boolean',
            'faltante' => 'boolean',
            'datos_crudos' => 'array',
        ];
    }

    protected static function booted(): void
    {
        // RF-07: toda orden rechazada genera devolución
        static::saving(function (Orden $orden) {
            $orden->devolucion = $orden->estado === EstadoOrden::Rechazada;
        });
    }

    public function carga(): BelongsTo
    {
        return $this->belongsTo(Carga::class);
    }

    public function informe(): BelongsTo
    {
        return $this->belongsTo(InformeDiario::class, 'informe_id');
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    public function empleado(): BelongsTo
    {
        return $this->belongsTo(Empleado::class);
    }

    public function motivoRechazo(): BelongsTo
    {
        return $this->belongsTo(MotivoRechazo::class);
    }

    public function auditoria(): HasOne
    {
        return $this->hasOne(AuditoriaPod::class);
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(Evidencia::class);
    }
}
