<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Línea de servicio del portafolio (logística, aseo general…). Se identifica en la URL por su slug. */
class LineaServicio extends Model
{
    /** Línea con las herramientas de Drivin: tablero de indicadores, cargas y auditoría POD. */
    public const LOGISTICA = 'logistica';

    protected $table = 'lineas_servicio';

    protected $fillable = ['slug', 'nombre', 'orden', 'modulo', 'activa'];

    protected function casts(): array
    {
        return ['activa' => 'boolean', 'orden' => 'integer'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Empresas que reciben esta línea. */
    public function empresas(): BelongsToMany
    {
        return $this->belongsToMany(Empresa::class, 'empresa_linea_servicio')->withTimestamps();
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function scopeOrdenadas(Builder $query): Builder
    {
        return $query->orderBy('orden');
    }

    public function esLogistica(): bool
    {
        return $this->modulo === self::LOGISTICA;
    }

    public static function logistica(): self
    {
        return static::where('modulo', self::LOGISTICA)->firstOrFail();
    }
}
