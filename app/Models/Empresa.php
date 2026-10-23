<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Empresa cliente de Justo a Tiempo (p. ej. Ditransa): el contrato, con su NIT, su contacto y las
 * líneas de servicio que recibe. Atiende a sus propios clientes, que en la plataforma son sus sedes.
 */
class Empresa extends Model
{
    use SoftDeletes;

    protected $fillable = ['nombre', 'nit', 'contacto_nombre', 'contacto_email', 'contacto_telefono', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function sedes(): HasMany
    {
        return $this->hasMany(Sede::class);
    }

    public function sucursales(): HasManyThrough
    {
        return $this->hasManyThrough(Sucursal::class, Sede::class);
    }

    /** Líneas de servicio que recibe esta empresa. */
    public function lineas(): BelongsToMany
    {
        return $this->belongsToMany(LineaServicio::class, 'empresa_linea_servicio')->withTimestamps();
    }

    /** Las asignaciones de personas a esta empresa (las vigentes son su personal). */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(Asignacion::class);
    }
}
