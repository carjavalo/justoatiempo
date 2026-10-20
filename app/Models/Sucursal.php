<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Sucursal de una sede (Cali Sur, Cañasgordas…); en Drivin se reconoce por su alias en el nombre del
 * plan. Sin sede, es una sucursal propia de Justo a Tiempo.
 */
class Sucursal extends Model
{
    use SoftDeletes;

    protected $table = 'sucursales';

    protected $fillable = ['sede_id', 'nombre', 'alias_drivin', 'ciudad', 'direccion', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    /** Las asignaciones de personas a esta sucursal. */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(Asignacion::class);
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }
}
