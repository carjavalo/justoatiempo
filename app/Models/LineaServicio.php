<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * Línea de servicio (logística, aseo general…). Las 8 del portafolio vienen de fábrica; las demás se crean desde
 * la plataforma. Se identifica en la URL por su slug, que no cambia aunque se le cambie el nombre.
 */
class LineaServicio extends Model
{
    /** Línea con las herramientas de Drivin: tablero de indicadores, cargas y auditoría POD. */
    public const LOGISTICA = 'logistica';

    /** Íconos que se le pueden poner a una línea (sus dibujos están en resources/js/lib/iconos-linea.ts). */
    public const ICONOS = [
        'logistica', 'personal', 'aseo', 'escoba', 'rodillo', 'planta', 'arbol', 'operario',
        'camion', 'bodega', 'contenedor', 'fabrica', 'casco', 'martillo', 'seguridad', 'uniforme',
        'tienda', 'compras', 'alimentos', 'salud', 'educacion', 'publico', 'residencial', 'engranaje',
        'energia', 'brillo', 'capas',
    ];

    protected $table = 'lineas_servicio';

    protected $fillable = ['slug', 'nombre', 'descripcion', 'icono', 'orden', 'modulo', 'activa'];

    protected function casts(): array
    {
        return ['activa' => 'boolean', 'orden' => 'integer'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Empresas que reciben esta línea. */
    public function empresas(): BelongsToMany
    {
        return $this->belongsToMany(Empresa::class, 'empresa_linea_servicio')->withTimestamps();
    }

    /** Las asignaciones que incluyen esta línea (las vigentes son su personal). */
    public function asignaciones(): BelongsToMany
    {
        return $this->belongsToMany(Asignacion::class, 'asignacion_linea');
    }

    public function scopeOrdenadas(Builder $query): Builder
    {
        return $query->orderBy('orden');
    }

    public function scopeActivas(Builder $query): Builder
    {
        return $query->where('activa', true);
    }

    /** Slug libre para una línea nueva: "Vigilancia y portería" → "vigilancia-y-porteria" (o "…-2" si ya existe). */
    public static function slugPara(string $nombre): string
    {
        $base = Str::limit(Str::slug($nombre), 50, '') ?: 'linea';
        $slug = $base;
        for ($i = 2; static::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    public function esLogistica(): bool
    {
        return $this->modulo === self::LOGISTICA;
    }

    public static function logistica(): self
    {
        return static::where('modulo', self::LOGISTICA)->firstOrFail();
    }
}
