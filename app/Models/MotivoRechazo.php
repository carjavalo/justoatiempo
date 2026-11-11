<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MotivoRechazo extends Model
{
    use SoftDeletes;

    protected $table = 'motivos_rechazo';

    protected $fillable = ['nombre', 'imputable_operacion', 'activo'];

    protected function casts(): array
    {
        return ['imputable_operacion' => 'boolean', 'activo' => 'boolean'];
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }
}
