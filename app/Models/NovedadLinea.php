<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Una novedad de la operación de una línea (una llegada tarde, una queja del cliente, un faltante de insumos…), con
 * su seguimiento hasta cerrarla.
 */
class NovedadLinea extends Model
{
    protected $table = 'novedades_linea';

    /** Tipos que se ofrecen al registrar, con la gravedad que se sugiere (se puede cambiar). */
    public const TIPOS = [
        'Llegada tarde' => 'leve',
        'Inasistencia' => 'grave',
        'Abandono del puesto' => 'grave',
        'Uniforme o presentación' => 'leve',
        'Faltan insumos o equipos' => 'leve',
        'Daño o pérdida' => 'grave',
        'Accidente o incidente' => 'grave',
        'Queja del cliente' => 'grave',
        'Felicitación del cliente' => 'ninguna',
        'Otra' => 'leve',
    ];

    public const ESTADOS = ['abierta' => 'Abierta', 'en_seguimiento' => 'En seguimiento', 'cerrada' => 'Cerrada'];

    public const GRAVEDADES = ['ninguna' => 'Sin falta', 'leve' => 'Leve', 'grave' => 'Grave'];

    protected $fillable = [
        'linea_servicio_id', 'fecha', 'empresa_id', 'sede_id', 'sucursal_id', 'user_id', 'tipo', 'gravedad',
        'descripcion', 'estado', 'seguimiento', 'registrada_por', 'cerrada_por', 'cerrada_en',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date', 'cerrada_en' => 'datetime'];
    }

    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id');
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    /** La persona involucrada (si la hay). */
    public function persona(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function registradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrada_por');
    }

    public function cerradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }

    /** Las acciones de desempeño que se tomaron por ella. */
    public function acciones(): HasMany
    {
        return $this->hasMany(AccionDesempeno::class, 'novedad_id');
    }

    /** "Ditranza · TuGo · Cali Sur". */
    public function lugar(): string
    {
        return implode(' · ', array_filter([$this->empresa?->nombre, $this->sede?->nombre, $this->sucursal?->nombre]));
    }
}
