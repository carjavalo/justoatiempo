<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Rol;
use App\Notifications\RestablecerContrasena;
use App\Support\Permisos;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;
use Throwable;

use function Illuminate\Support\defer;

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
        'cedula',
        'cargo',
        'email',
        'password',
        'rol',
        'rol_id',
        'empresa_id',
        'sede_id',
        'sucursal_id',
        'linea_servicio_id',
        'foto_path',
        'arl_path',
        'arl_subida_en',
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
        // Rutas internas de los archivos: la foto y la ARL se entregan solo por sus rutas propias
        'foto_path',
        'arl_path',
        // Código del QR del carnet: va en el carnet, no en las respuestas de la plataforma
        'carnet_codigo',
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
            'arl_subida_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // El nombre completo (para mostrar y buscar) sale de las partes, cuando las hay
        // Cada persona nace con el código que lleva el QR de su carnet
        static::creating(function (User $user) {
            $user->carnet_codigo ??= Str::random(12);
        });

        static::saving(function (User $user) {
            if (filled($user->nombres)) {
                $user->name = self::nombreCompleto($user->nombres, $user->primer_apellido, $user->segundo_apellido);
            }

            // El nivel de acceso (lo que puede hacer en la plataforma) es siempre el de su rol. Sin rol elegido
            // (p. ej. usuarios creados desde código), toma el rol base de su nivel.
            if ($user->rol_id && $user->isDirty('rol_id')) {
                $user->rol = RolUsuario::whereKey($user->rol_id)->value('nivel') ?? $user->rol;
            } elseif (! $user->rol_id || $user->isDirty('rol')) {
                $user->rol ??= Rol::Auxiliar;
                $user->rol_id = RolUsuario::base($user->rol)?->id;
            }
        });
    }

    /** "Ana María", "Gómez", "Ruiz" → "Ana María Gómez Ruiz" (sin espacios de más). */
    public static function nombreCompleto(?string $nombres, ?string $primerApellido, ?string $segundoApellido): string
    {
        $texto = implode(' ', array_filter([$nombres, $primerApellido, $segundoApellido], fn ($parte) => filled($parte)));

        return trim(preg_replace('/\s+/u', ' ', $texto));
    }

    /** Cómo se le saluda en los correos: "Ana María" (o la primera palabra del nombre, si no tiene nombres aparte). */
    public function nombreDePila(): string
    {
        return filled($this->nombres) ? trim($this->nombres) : Str::before(trim($this->name), ' ');
    }

    /** "¿Olvidaste tu contraseña?": el correo propio de la plataforma, en vez del genérico de Laravel. */
    public function sendPasswordResetNotification($token): void
    {
        $this->avisarDespues(new RestablecerContrasena($token));
    }

    /**
     * Envía el correo después de responder: quien lo pide no espera al servidor de correo, y la respuesta tarda
     * lo mismo exista o no la cuenta (así no delata qué correos están registrados). Si el envío falla, queda en
     * el registro de errores.
     */
    public function avisarDespues(Notification $aviso): void
    {
        defer(function () use ($aviso) {
            try {
                $this->notify($aviso);
            } catch (Throwable $e) {
                report($e);
            }
        });
    }

    public function empleado(): BelongsTo
    {
        return $this->belongsTo(Empleado::class);
    }

    /** Empresa cliente donde presta el servicio (todos son personal de Justo a Tiempo); puede no tener. */
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

    /** Su rol dentro de la empresa (auxiliar, conductor, supervisor…), con sus permisos en la plataforma. */
    public function rolUsuario(): BelongsTo
    {
        return $this->belongsTo(RolUsuario::class, 'rol_id');
    }

    /** El nombre de su rol para mostrar ("Conductor"); sin rol asignado, el de su nivel de acceso. */
    public function nombreRol(): string
    {
        return $this->rolUsuario?->nombre ?? $this->rol->label();
    }

    /** Línea de servicio en la que trabaja (sin línea, si su rol ve todas). */
    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id');
    }

    /** Alcance de lo que ve de la operación, según su rol (App\Support\Permisos). */
    public function alcance(): string
    {
        return $this->rolUsuario?->alcance ?? Permisos::ALCANCE_PROPIO;
    }

    /** Si su rol, tal cual, tiene el permiso (sin mirar su asignación). */
    public function rolPermite(string $permiso): bool
    {
        return (bool) $this->rolUsuario?->permite($permiso);
    }

    /**
     * Lo que de verdad puede hacer: los permisos de su rol, menos las herramientas que no le aplican. Quien ve solo
     * su empresa no abre las que reúnen todas las empresas, y las de logística son solo de quien trabaja en ella.
     *
     * @return list<string>
     */
    public function permisos(): array
    {
        return array_values(array_filter(
            $this->rolUsuario?->permisos ?? [],
            fn (string $permiso) => $this->motivoSinPermiso($permiso) === null,
        ));
    }

    public function puede(string $permiso): bool
    {
        return in_array($permiso, $this->permisos(), true);
    }

    /** Si puede al menos uno de los permisos. */
    public function puedeAlguno(string ...$permisos): bool
    {
        return array_intersect($permisos, $this->permisos()) !== [];
    }

    /** Por qué no puede usar un permiso (null si sí puede): para que el aviso diga la causa real. */
    public function motivoSinPermiso(string $permiso): ?string
    {
        if (! $this->rolPermite($permiso)) {
            return 'Tu rol no tiene permiso para entrar a esta sección.';
        }

        $modulo = strstr($permiso, '.', true);
        if ($this->soloLoSuyo() && ! in_array($modulo, Permisos::SOLO_LO_SUYO, true)) {
            return 'Tu rol solo ve tu propia información: esta sección no está disponible.';
        }
        if (in_array($modulo, Permisos::MEZCLAN_EMPRESAS, true) && $this->empresaFija() !== null) {
            return 'Esta sección reúne la operación de todas las empresas: no está disponible para quien presta el servicio en una sola.';
        }
        if (in_array($modulo, Permisos::DE_LOGISTICA, true) && ! $this->rolPermite(Permisos::TODAS_LAS_LINEAS)
            && $this->linea?->modulo !== LineaServicio::LOGISTICA) {
            return 'Esta herramienta es de otra línea de servicio.';
        }

        return null;
    }

    public function puedeVerLinea(LineaServicio $linea): bool
    {
        return $this->puede('tablero.ver') && ($this->puede(Permisos::TODAS_LAS_LINEAS) || $this->linea_servicio_id === $linea->id);
    }

    /** Si su rol abre algún módulo de la administración (usuarios, roles, empresas…). */
    public function administraAlgo(): bool
    {
        foreach (array_keys(Permisos::CATALOGO[0]['modulos']) as $modulo) {
            if ($this->puede("{$modulo}.ver")) {
                return true;
            }
        }

        return false;
    }

    /**
     * Límites de lo que ve de la operación: con alcance "su asignación" (o "solo lo suyo") y una empresa asignada,
     * solo esa empresa, y dentro de ella su sede y su sucursal si las tiene.
     */
    public function empresaFija(): ?int
    {
        return $this->alcance() === Permisos::ALCANCE_TODO ? null : $this->empresa_id;
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

    /** Si en el tablero solo ve su propio desempeño. */
    public function soloLoSuyo(): bool
    {
        return $this->alcance() === Permisos::ALCANCE_PROPIO;
    }

    /** Página de inicio: el panel si administra algo o ve todas las líneas; si no, su línea (si puede verla). */
    public function inicio(): array
    {
        if (! $this->administraAlgo() && ! $this->puede(Permisos::TODAS_LAS_LINEAS) && $this->linea && $this->puedeVerLinea($this->linea)) {
            return ['titulo' => $this->linea->nombre, 'volver' => "Volver a {$this->linea->nombre}", 'url' => route('lineas.show', $this->linea, false)];
        }

        return ['titulo' => 'Panel', 'volver' => 'Volver al panel', 'url' => route('panel', [], false)];
    }

    /**
     * Si puede tocar a esta persona (editarla, desactivarla): solo a quien tiene, como mucho, sus mismos permisos y
     * está dentro de su alcance. Así nadie toma la cuenta de alguien con más acceso que el suyo.
     */
    public function cubreA(User $otro): bool
    {
        return $this->is($otro) || ($this->alcanza($otro) && $this->rolUsuario !== null && $otro->rolUsuario !== null && $this->rolUsuario->cubre($otro->rolUsuario));
    }

    /** Si esta persona entra en lo que ve de los usuarios: su empresa, sede y sucursal fijas y su línea. */
    public function alcanza(User $otro): bool
    {
        return $this->is($otro) || $this->motivoFueraDeAlcance($otro->empresa_id, $otro->sede_id, $otro->sucursal_id, $otro->linea_servicio_id) === null;
    }

    /**
     * Por qué no puede asignar a alguien a este lugar (null si puede): con empresa fija, solo a su empresa (y a su sede
     * y su sucursal, si las tiene); sin ver todas las líneas, solo a su línea. Así nadie se quita sus propios límites
     * editándose ni creando a otra persona sin ellos.
     *
     * @return array{0: string, 1: string}|null [campo, mensaje]
     */
    public function motivoFueraDeAlcance(?int $empresaId, ?int $sedeId, ?int $sucursalId, ?int $lineaId): ?array
    {
        if ($this->soloLoSuyo()) {
            return ['empresa_id', 'Tu rol solo ve tu propia información.'];
        }
        if (($empresa = $this->empresaFija()) !== null && $empresaId !== $empresa) {
            return ['empresa_id', "Solo puedes asignar personas a tu empresa ({$this->empresa?->nombre})."];
        }
        if (($sede = $this->sedeFija()) !== null && $sedeId !== $sede) {
            return ['sede_id', "Solo puedes asignar personas a tu sede ({$this->sede?->nombre})."];
        }
        if (($sucursal = $this->sucursalFija()) !== null && $sucursalId !== $sucursal) {
            return ['sucursal_id', "Solo puedes asignar personas a tu sucursal ({$this->sucursal?->nombre})."];
        }
        if (! $this->rolPermite(Permisos::TODAS_LAS_LINEAS) && $lineaId !== $this->linea_servicio_id) {
            return ['linea_id', $this->linea ? "Solo puedes asignar personas a tu línea de servicio ({$this->linea->nombre})." : 'Tu rol no ve otras líneas de servicio.'];
        }

        return null;
    }

    /** Solo los usuarios que entran en lo que ve (ver alcanza). */
    public function scopeAlcanceDe(Builder $consulta, User $quien): Builder
    {
        return $consulta
            ->when($quien->soloLoSuyo(), fn (Builder $q) => $q->whereKey($quien->id))
            ->when($quien->empresaFija(), fn (Builder $q, int $id) => $q->where('users.empresa_id', $id))
            ->when($quien->sedeFija(), fn (Builder $q, int $id) => $q->where('users.sede_id', $id))
            ->when($quien->sucursalFija(), fn (Builder $q, int $id) => $q->where('users.sucursal_id', $id))
            ->when(! $quien->rolPermite(Permisos::TODAS_LAS_LINEAS), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('users.linea_servicio_id', $quien->linea_servicio_id)->orWhere('users.id', $quien->id)));
    }

    /** Nivel de agrupación (administrador, coordinador o auxiliar); no da acceso: eso lo dan los permisos. */
    public function esAdmin(): bool
    {
        return $this->rol === Rol::Admin;
    }
}
