<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cliente extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nombre', 'nit', 'codigo', 'meta_efectividad', 'color',
        'contacto_nombre', 'contacto_email', 'contacto_telefono', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'meta_efectividad' => 'decimal:2',
            'activo' => 'boolean',
        ];
    }

    public function sedes(): HasMany
    {
        return $this->hasMany(Sede::class);
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
