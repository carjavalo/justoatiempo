<?php

namespace App\Models;

use App\Enums\Rol;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Rol que se le asigna a un usuario (lo crea la administración). Su `nivel` es uno de los tres niveles de
 * acceso de la plataforma (App\Enums\Rol) y decide qué ve y qué puede hacer quien lo tenga; el nombre es libre
 * ("Conductor", "Supervisor de bodega"…).
 */
class RolUsuario extends Model
{
    protected $table = 'roles';

    protected $fillable = ['nombre', 'descripcion', 'nivel', 'activo'];

    protected function casts(): array
    {
        return ['nivel' => Rol::class, 'base' => 'boolean', 'activo' => 'boolean'];
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class, 'rol_id');
    }

    /** El rol base de un nivel (Administrador, Coordinador / Supervisor o Auxiliar operativo). */
    public static function base(Rol $nivel): ?self
    {
        return self::where('base', true)->where('nivel', $nivel->value)->first();
    }
}
