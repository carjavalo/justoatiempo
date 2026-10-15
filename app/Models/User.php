<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Rol;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'nombres',
        'primer_apellido',
        'segundo_apellido',
        'email',
        'password',
        'rol',
        'empresa_id',
        'sede_id',
        'sucursal_id',
        'linea_servicio_id',
        'empleado_id',
        'activo',
        'ultimo_acceso_en',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'rol' => Rol::class,
            'activo' => 'boolean',
            'ultimo_acceso_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // El nombre completo (para mostrar y buscar) sale de las partes, cuando las hay
        static::saving(function (User $user) {
            if (filled($user->nombres)) {
                $user->name = self::nombreCompleto($user->nombres, $user->primer_apellido, $user->segundo_apellido);
            }
        });
    }

    /** "Ana María", "Gómez", "Ruiz" → "Ana María Gómez Ruiz" (sin espacios de más). */
    public static function nombreCompleto(?string $nombres, ?string $primerApellido, ?string $segundoApellido): string
    {
        $texto = implode(' ', array_filter([$nombres, $primerApellido, $segundoApellido], fn ($parte) => filled($parte)));

        return trim(preg_replace('/\s+/u', ' ', $texto));
    }

    public function empleado(): BelongsTo
    {
        return $this->belongsTo(Empleado::class);
    }

    /** Empresa donde trabaja; sin empresa es personal propio de Justo a Tiempo. */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }

    /** Sede de la empresa (p. ej. TuGo, de Ditranza). */
    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    /** Sucursal donde trabaja (de su sede o, sin empresa, una propia de Justo a Tiempo). */
    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    /** Línea de servicio en la que trabaja (los administradores no tienen: ven todas). */
    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id');
    }

    public function puedeVerLinea(LineaServicio $linea): bool
    {
        return $this->esAdmin() || $this->linea_servicio_id === $linea->id;
    }

    /**
     * Límites de lo que ve quien no es administrador: si está asignado a una empresa solo ve esa
     * empresa, y dentro de ella su sede y su sucursal si las tiene.
     */
    public function empresaFija(): ?int
    {
        return $this->esAdmin() ? null : $this->empresa_id;
    }

    /** Sede y sucursal solo limitan dentro de una empresa: la sucursal propia del personal de JaT es su ubicación. */
    public function sedeFija(): ?int
    {
        return $this->empresaFija() === null ? null : $this->sede_id;
    }

    public function sucursalFija(): ?int
    {
        return $this->empresaFija() === null ? null : $this->sucursal_id;
    }

    /** Página de inicio: el panel para el administrador; para los demás, su línea. */
    public function inicio(): array
    {
        if (! $this->esAdmin() && $this->linea) {
            return ['titulo' => $this->linea->nombre, 'volver' => "Volver a {$this->linea->nombre}", 'url' => route('lineas.show', $this->linea, false)];
        }

        return ['titulo' => 'Panel', 'volver' => 'Volver al panel', 'url' => route('panel', [], false)];
    }

    public function tieneRol(Rol ...$roles): bool
    {
        return in_array($this->rol, $roles, true);
    }

    public function esAdmin(): bool
    {
        return $this->rol === Rol::Admin;
    }

    public function puedeGestionarOperacion(): bool
    {
        return $this->tieneRol(Rol::Admin, Rol::Coordinador);
    }
}
