<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sede extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['cliente_id', 'nombre', 'alias_drivin', 'ciudad', 'direccion', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }
}
