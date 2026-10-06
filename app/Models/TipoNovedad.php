<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TipoNovedad extends Model
{
    protected $table = 'tipos_novedad';

    protected $fillable = ['nombre', 'severidad', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(AuditoriaPod::class);
    }
}
