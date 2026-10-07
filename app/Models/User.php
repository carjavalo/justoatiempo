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
        'cliente_id',
        'sede_id',
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

    /** Empresa cliente donde trabaja; sin empresa es personal propio de Justo a Tiempo. */
    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
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
