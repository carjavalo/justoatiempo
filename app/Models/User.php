<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Rol;
use App\Notifications\RestablecerContrasena;
use App\Support\Alcance;
use App\Support\Permisos;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection as SupportCollection;
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
        'telefono',
        'ciudad',
        'fecha_nacimiento',
        'fecha_ingreso',
        'email',
        'password',
        'rol',
        'rol_id',
        'foto_path',
        'arl_path',
        'arl_subida_en',
        'activo',
        'acceso',
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
            'acceso' => 'boolean',
            'fecha_nacimiento' => 'date',
            'fecha_ingreso' => 'date',
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

        // Con su cédula, las entregas de Drivin que se importaron antes de registrarla quedan a su nombre (y si se
        // corrige, las de la cédula anterior dejan de serlo)
        static::saved(function (User $user) {
            // (wasRecentlyCreated sigue en true en la misma instancia después de crearla: primero va el cambio)
            if ($user->wasChanged('cedula')) {
                Orden::asignarAPersona($user, $user->getOriginal('cedula'));
            } elseif ($user->wasRecentlyCreated && filled($user->cedula)) {
                Orden::asignarAPersona($user);
            }
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

    /** Sus entregas en la línea logística (las órdenes de Drivin en las que fue el auxiliar). */
    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class, 'auxiliar_id');
    }

    /** Su seguimiento: felicitaciones, retroalimentaciones y llamados de atención. */
    public function acciones(): HasMany
    {
        return $this->hasMany(AccionDesempeno::class);
    }

    /** Si puede entrar a la plataforma: tiene acceso, correo y está activo. Sin acceso sigue teniendo su carnet. */
    public function puedeIngresar(): bool
    {
        return $this->activo && $this->acceso && filled($this->email);
    }

    /** Dónde presta el servicio y qué hace allí: puede estar en varias empresas, cada una con sus líneas y su periodo. */
    public function asignaciones(): HasMany
    {
        return $this->hasMany(Asignacion::class);
    }

    /** Las asignaciones en curso hoy. */
    public function asignacionesVigentes(): HasMany
    {
        return $this->hasMany(Asignacion::class)->vigentes();
    }

    /** @return Collection<int, Asignacion> Sus asignaciones vigentes, con sus líneas y lugares (se cargan una vez). */
    public function vigentes(): Collection
    {
        return $this->loadMissing(['asignacionesVigentes.lineas:id,slug,nombre,modulo,orden', 'asignacionesVigentes.empresa:id,nombre', 'asignacionesVigentes.sede:id,nombre', 'asignacionesVigentes.sucursal:id,nombre'])
            ->asignacionesVigentes;
    }

    /** @return list<int> Las líneas en las que trabaja hoy (las de sus asignaciones vigentes). */
    public function lineasIds(): array
    {
        return $this->vigentes()->flatMap(fn (Asignacion $a) => $a->lineas->pluck('id'))->unique()->values()->all();
    }

    /** @return SupportCollection<int, LineaServicio> Las líneas en las que trabaja hoy, en el orden del portafolio. */
    public function lineas(): SupportCollection
    {
        return $this->vigentes()->flatMap(fn (Asignacion $a) => $a->lineas)->unique('id')->sortBy('orden')->values();
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

    /** Alcance de lo que ve de la operación, según su rol (App\Support\Permisos). */
    public function alcance(): string
    {
        return $this->rolUsuario?->alcance ?? Permisos::ALCANCE_PROPIO;
    }

    /**
     * Lo que ve de la operación (en una línea o en general): todo si su rol ve toda la operación o si tiene una
     * asignación sin empresa (toda la línea); si no, solo los lugares de sus asignaciones vigentes. En una línea
     * donde no tiene asignación, si su rol ve todas las líneas, lo de sus asignaciones en general.
     */
    public function alcanceEn(?LineaServicio $linea = null): Alcance
    {
        if ($this->alcance() === Permisos::ALCANCE_TODO) {
            return Alcance::todo();
        }

        $asignaciones = $this->vigentes();
        if ($linea !== null) {
            $deLaLinea = $asignaciones->filter(fn (Asignacion $a) => $a->lineas->contains('id', $linea->id));
            $asignaciones = $deLaLinea->isEmpty() && $this->rolPermite(Permisos::TODAS_LAS_LINEAS) ? $asignaciones : $deLaLinea;
        }
        if ($asignaciones->contains(fn (Asignacion $a) => $a->empresa_id === null)) {
            return Alcance::todo();
        }

        return Alcance::lugares($asignaciones->map(fn (Asignacion $a) => ['empresa' => $a->empresa_id, 'sede' => $a->sede_id, 'sucursal' => $a->sucursal_id]));
    }

    /** Si su rol, tal cual, tiene el permiso (sin mirar sus asignaciones). */
    public function rolPermite(string $permiso): bool
    {
        return (bool) $this->rolUsuario?->permite($permiso);
    }

    /**
     * Lo que de verdad puede hacer: los permisos de su rol, menos las herramientas que no le aplican. Quien ve solo
     * algunas empresas no abre las que reúnen a todas, y las de logística son solo de quien trabaja en ella.
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

    private ?LineaServicio $logistica = null;

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
        $deLogistica = in_array($modulo, Permisos::DE_LOGISTICA, true);
        if ($deLogistica) {
            $this->logistica ??= LineaServicio::logistica();
        }
        if ($deLogistica && ! $this->rolPermite(Permisos::TODAS_LAS_LINEAS) && ! in_array($this->logistica->id, $this->lineasIds(), true)) {
            return 'Esta herramienta es de otra línea de servicio.';
        }
        if (in_array($modulo, Permisos::MEZCLAN_EMPRESAS, true) && ! $this->alcanceEn($deLogistica ? $this->logistica : null)->todo) {
            return 'Esta sección reúne la operación de todas las empresas: no está disponible para quien solo ve las suyas.';
        }

        return null;
    }

    public function puedeVerLinea(LineaServicio $linea): bool
    {
        return $this->puede('tablero.ver') && ($this->puede(Permisos::TODAS_LAS_LINEAS) || in_array($linea->id, $this->lineasIds(), true));
    }

    /** Si su rol abre algún módulo de la administración (usuarios, roles, empresas…). */
    public function administraAlgo(): bool
    {
        // Administración y datos maestros (la flota, los parámetros)
        foreach (Permisos::CATALOGO as $grupo) {
            if (! in_array($grupo['clave'], ['administracion', 'maestros'], true)) {
                continue;
            }
            foreach (array_keys($grupo['modulos']) as $modulo) {
                if ($this->puede("{$modulo}.ver")) {
                    return true;
                }
            }
        }

        return false;
    }

    /** Si en el tablero solo ve su propio desempeño. */
    public function soloLoSuyo(): bool
    {
        return $this->alcance() === Permisos::ALCANCE_PROPIO;
    }

    /** Si su rol lo ve todo: toda la operación y todas las líneas (nada de sus asignaciones lo limita). */
    public function sinLimites(): bool
    {
        return $this->alcance() === Permisos::ALCANCE_TODO && $this->rolPermite(Permisos::TODAS_LAS_LINEAS);
    }

    /**
     * Página de inicio: el panel si administra algo, ve todas las líneas o trabaja en varias; si trabaja en una sola
     * (y su rol abre su tablero), esa línea.
     */
    public function inicio(): array
    {
        $lineas = $this->lineas()->filter(fn (LineaServicio $l) => $this->puedeVerLinea($l));
        if (! $this->administraAlgo() && ! $this->puede(Permisos::TODAS_LAS_LINEAS) && $lineas->count() === 1) {
            $linea = $lineas->first();

            return ['titulo' => $linea->nombre, 'volver' => "Volver a {$linea->nombre}", 'url' => route('lineas.show', $linea, false)];
        }

        return ['titulo' => 'Panel', 'volver' => 'Volver al panel', 'url' => route('panel', [], false)];
    }

    /**
     * Si puede tocar a esta persona (editarla, desactivarla, asignarla): solo a quien tiene, como mucho, sus mismos
     * permisos y está dentro de lo que ve. Así nadie toma la cuenta de alguien con más acceso que el suyo.
     */
    public function cubreA(User $otro): bool
    {
        return $this->is($otro) || ($this->alcanza($otro) && $this->rolUsuario !== null && $otro->rolUsuario !== null && $this->rolUsuario->cubre($otro->rolUsuario));
    }

    /**
     * Si esta persona entra en lo que ve de los usuarios: alguien sin asignaciones vigentes (aún no tiene dónde
     * trabajar), o con alguna en sus lugares y sus líneas.
     */
    public function alcanza(User $otro): bool
    {
        if ($this->is($otro) || $this->sinLimites()) {
            return true;
        }
        if ($this->soloLoSuyo()) {
            return false;
        }

        $vigentes = $otro->vigentes();

        // Sin asignación aún se ve (hay que poder asignarlo), si su rol no tiene más acceso que el propio
        return $vigentes->isEmpty()
            ? (bool) ($this->rolUsuario && $otro->rolUsuario && $this->rolUsuario->cubre($otro->rolUsuario))
            : $vigentes->contains(fn (Asignacion $a) => $this->veAsignacion($a));
    }

    /** Si ve esta asignación: alguna de sus líneas es de las suyas y su lugar cabe en lo que ve en esa línea. */
    public function veAsignacion(Asignacion $a): bool
    {
        return $a->lineas->contains(fn (LineaServicio $l) => $this->motivoFueraDeAlcance($a->empresa_id, $a->sede_id, $a->sucursal_id, [$l->id]) === null);
    }

    /**
     * Por qué no puede asignar a alguien a este lugar y estas líneas (null si puede): en cada línea, solo dentro de lo
     * que ve en ella (sus empresas, sedes y sucursales) y, si su rol no ve todas las líneas, solo en las suyas. Así
     * nadie se quita sus límites asignándose a sí mismo ni a otra persona sin ellos.
     *
     * @param  list<int>  $lineas
     * @return array{0: string, 1: string}|null [campo, mensaje]
     */
    public function motivoFueraDeAlcance(?int $empresaId, ?int $sedeId, ?int $sucursalId, array $lineas): ?array
    {
        if ($this->soloLoSuyo()) {
            return ['empresa_id', 'Tu rol solo ve tu propia información.'];
        }
        if ($this->sinLimites()) {
            return null;
        }

        $catalogo = once(fn () => LineaServicio::all()->keyBy('id'));
        foreach ($lineas as $id) {
            $linea = $catalogo->get($id);
            if (! $linea) {
                continue;
            }
            if (! $this->rolPermite(Permisos::TODAS_LAS_LINEAS) && ! in_array($linea->id, $this->lineasIds(), true)) {
                return ['lineas', "No trabajas en «{$linea->nombre}»: solo puedes asignar tus líneas de servicio."];
            }
            $alcance = $this->alcanceEn($linea);
            if ($alcance->todo || $alcance->incluye($empresaId, $sedeId, $sucursalId)) {
                continue;
            }
            $campo = match (true) {
                $empresaId === null || ! in_array($empresaId, $alcance->empresas(), true) => 'empresa_id',
                $sedeId === null || ! $alcance->incluye($empresaId, $sedeId) => 'sede_id',
                default => 'sucursal_id',
            };

            return [$campo, "En «{$linea->nombre}» solo puedes asignar personas a los lugares donde tú trabajas."];
        }

        return null;
    }

    /** Solo los usuarios que entran en lo que ve (ver alcanza). */
    public function scopeAlcanceDe(Builder $consulta, User $quien): Builder
    {
        if ($quien->sinLimites()) {
            return $consulta;
        }
        if ($quien->soloLoSuyo()) {
            return $consulta->whereKey($quien->id);
        }

        $mias = $quien->lineasIds();
        $porLinea = LineaServicio::whereIn('id', $mias)->get()->mapWithKeys(fn (LineaServicio $l) => [$l->id => $quien->alcanceEn($l)]);
        $todasLasLineas = $quien->rolPermite(Permisos::TODAS_LAS_LINEAS);
        $general = $quien->alcanceEn();

        // Roles con, como mucho, el acceso del propio: los de quienes aún no tienen asignación y se pueden ver
        $rolesCubiertos = RolUsuario::all()->filter(fn (RolUsuario $r) => (bool) $quien->rolUsuario?->cubre($r))->pluck('id');

        return $consulta->where(fn (Builder $w) => $w
            ->where('users.id', $quien->id)
            ->orWhere(fn (Builder $s) => $s->whereDoesntHave('asignacionesVigentes')->whereIn('users.rol_id', $rolesCubiertos))
            ->orWhereHas('asignacionesVigentes', function (Builder $a) use ($porLinea, $todasLasLineas, $general) {
                $a->where(function (Builder $o) use ($porLinea, $todasLasLineas, $general) {
                    $o->whereRaw('1 = 0');
                    // En cada una de sus líneas, los lugares que ve en ella
                    foreach ($porLinea as $lineaId => $alcance) {
                        $o->orWhere(fn (Builder $l) => $alcance->filtrarAsignaciones($l->whereHas('lineas', fn ($q) => $q->whereKey($lineaId))));
                    }
                    // Con todas las líneas, también las demás, con sus lugares en general
                    if ($todasLasLineas) {
                        $o->orWhere(fn (Builder $l) => $general->filtrarAsignaciones($l->whereDoesntHave('lineas', fn ($q) => $q->whereIn('lineas_servicio.id', $porLinea->keys()))));
                    }
                });
            }));
    }

    /** Nivel de agrupación (administrador, coordinador o auxiliar); no da acceso: eso lo dan los permisos. */
    public function esAdmin(): bool
    {
        return $this->rol === Rol::Admin;
    }
}
