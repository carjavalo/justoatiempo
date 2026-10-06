<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehiculo extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['placa', 'codigo_interno', 'tipo', 'descripcion', 'conductor_id', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    /** Normaliza "snx 708" -> "SNX708" para emparejar con Drivin. */
    public static function normalizarPlaca(?string $placa): ?string
    {
        if ($placa === null) {
            return null;
        }

        $limpia = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $placa));

        return $limpia === '' ? null : $limpia;
    }

    protected function placa(): Attribute
    {
        return Attribute::set(fn (?string $value) => self::normalizarPlaca($value));
    }

    public function conductor(): BelongsTo
    {
        return $this->belongsTo(Empleado::class, 'conductor_id');
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }
}
