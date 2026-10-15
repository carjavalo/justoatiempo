<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Sede de una empresa: cada cliente que la empresa atiende (TuGo y Sodimac, de Ditranza). En Drivin es la
 * columna "Cliente corporativo"; tiene su meta de efectividad pactada y sus sucursales.
 */
class Sede extends Model
{
    use SoftDeletes;

    protected $fillable = ['empresa_id', 'nombre', 'codigo', 'meta_efectividad', 'color', 'activo'];

    protected function casts(): array
    {
        return [
            'meta_efectividad' => 'decimal:2',
            'activo' => 'boolean',
        ];
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /**
     * Pasa la sede (con sus sucursales y su operación) a otra empresa y lleva con ella a su personal, para que
     * nadie quede asignado a una sede de otra empresa. Las órdenes e informes cuelgan de la sede: no cambian.
     */
    public function trasladarA(Empresa $empresa): void
    {
        DB::transaction(function () use ($empresa) {
            if ($this->empresa_id !== $empresa->id) {
                $this->update(['empresa_id' => $empresa->id]);
            }
            User::where('sede_id', $this->id)->update(['empresa_id' => $empresa->id]);
        });
    }

    public function sucursales(): HasMany
    {
        return $this->hasMany(Sucursal::class);
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }

    public function informes(): HasMany
    {
        return $this->hasMany(InformeDiario::class);
    }

    public function programaciones(): HasMany
    {
        return $this->hasMany(Programacion::class);
    }
}
