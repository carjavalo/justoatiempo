<?php

namespace App\Models;

use App\Enums\Rol;
use App\Support\Permisos;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Rol que se le asigna a un usuario (lo crea la administración): su nombre es libre ("Conductor", "Supervisor de
 * bodega"…) y sus permisos dicen qué módulos ve quien lo tenga, qué puede hacer en cada uno y qué alcance tiene
 * de la operación (App\Support\Permisos). El `nivel` (administrador, coordinador o auxiliar) se deduce de los
 * permisos: solo agrupa a las personas, no da acceso.
 */
class RolUsuario extends Model
{
    protected $table = 'roles';

    protected $fillable = ['nombre', 'descripcion', 'permisos', 'alcance', 'activo'];

    protected function casts(): array
    {
        return ['nivel' => Rol::class, 'permisos' => 'array', 'base' => 'boolean', 'activo' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saving(function (RolUsuario $rol) {
            // El Administrador de la plataforma siempre lo puede todo: así nunca queda sin quien la gestione
            if ($rol->esAdministradorBase()) {
                $rol->permisos = Permisos::todos();
                $rol->alcance = Permisos::ALCANCE_TODO;
            } else {
                $rol->permisos = Permisos::normalizar($rol->permisos ?? []);
                $rol->alcance = array_key_exists((string) $rol->alcance, Permisos::alcances()) ? $rol->alcance : Permisos::ALCANCE_ASIGNACION;
            }
            $rol->nivel = $rol->nivelSegunPermisos();
        });

        // Quienes tienen el rol quedan agrupados con su nuevo nivel
        static::saved(function (RolUsuario $rol) {
            if ($rol->wasChanged('nivel')) {
                User::where('rol_id', $rol->id)->update(['rol' => $rol->nivel->value]);
            }
        });
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

    public function esAdministradorBase(): bool
    {
        return $this->base && $this->getRawOriginal('nivel', $this->attributes['nivel'] ?? null) === Rol::Admin->value;
    }

    public function permite(string $permiso): bool
    {
        return in_array($permiso, $this->permisos ?? [], true);
    }

    /** Si tiene todos los permisos y ve toda la operación. */
    public function esTotal(): bool
    {
        return $this->alcance === Permisos::ALCANCE_TODO && array_diff(Permisos::todos(), $this->permisos ?? []) === [];
    }

    /**
     * Si quien tiene $otro puede hacer y ver, como mucho, lo mismo que este rol: se usa para no dar (ni tocar)
     * más de lo que uno mismo tiene.
     */
    public function cubre(RolUsuario $otro): bool
    {
        return array_diff($otro->permisos ?? [], $this->permisos ?? []) === []
            && Permisos::alcanceCubre($this->alcance, $otro->alcance);
    }

    /** Agrupación para la plataforma: administra, coordina la operación o solo ve lo suyo. */
    public function nivelSegunPermisos(): Rol
    {
        $permisos = $this->permisos ?? [];

        return match (true) {
            in_array('usuarios.editar', $permisos, true) && in_array('roles.editar', $permisos, true) => Rol::Admin,
            $this->alcance === Permisos::ALCANCE_PROPIO => Rol::Auxiliar,
            default => Rol::Coordinador,
        };
    }

    /** "Acceso total" o los módulos que ve ("Tablero de la línea, Cargas Drivin y Auditoría POD"). */
    public function resumen(): string
    {
        if ($this->esTotal()) {
            return 'Acceso total';
        }

        $modulos = [];
        foreach ($this->permisos ?? [] as $permiso) {
            if ($permiso !== Permisos::TODAS_LAS_LINEAS && str_ends_with($permiso, '.ver')) {
                $modulos[] = Permisos::tituloModulo(strstr($permiso, '.', true));
            }
        }
        $modulos = array_values(array_filter($modulos));

        return match (count($modulos)) {
            0 => 'Solo su carnet',
            1 => $modulos[0],
            default => implode(', ', array_slice($modulos, 0, -1)).' y '.end($modulos),
        };
    }
}
