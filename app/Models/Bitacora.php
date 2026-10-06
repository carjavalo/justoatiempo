<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bitacora extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'bitacora';

    protected $fillable = ['user_id', 'accion', 'modelo_tipo', 'modelo_id', 'cambios', 'ip'];

    protected function casts(): array
    {
        return ['cambios' => 'array'];
    }

    public static function registrar(string $accion, Model $modelo, ?array $cambios = null): self
    {
        return static::create([
            'user_id' => auth()->id(),
            'accion' => $accion,
            'modelo_tipo' => $modelo::class,
            'modelo_id' => $modelo->getKey(),
            'cambios' => $cambios,
            'ip' => request()?->ip(),
        ]);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
