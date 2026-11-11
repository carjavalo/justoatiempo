<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Una novedad de la operación de una línea (una llegada tarde, una queja del cliente, un faltante de insumos…), con
 * su seguimiento hasta cerrarla.
 */
class NovedadLinea extends Model
{
    use SoftDeletes;

    protected $table = 'novedades_linea';

    /** Tipos que se ofrecen al registrar, con la gravedad que se sugiere (se puede cambiar). */
    public const TIPOS = [
        'Llegada tarde' => 'leve',
        'Inasistencia' => 'grave',
        'Abandono del puesto' => 'grave',
        'Uniforme o presentación' => 'leve',
        'Faltan insumos o equipos' => 'leve',
        'Daño o pérdida' => 'grave',
        'Accidente o incidente' => 'grave',
        'Queja del cliente' => 'grave',
        'Felicitación del cliente' => 'ninguna',
        'Otra' => 'leve',
    ];

    public const ESTADOS = ['abierta' => 'Abierta', 'en_seguimiento' => 'En seguimiento', 'cerrada' => 'Cerrada'];

    public const GRAVEDADES = ['ninguna' => 'Sin falta', 'leve' => 'Leve', 'grave' => 'Grave'];

    protected $fillable = [
        'linea_servicio_id', 'fecha', 'empresa_id', 'sede_id', 'sucursal_id', 'user_id', 'tipo', 'gravedad',
        'descripcion', 'estado', 'seguimiento', 'registrada_por', 'cerrada_por', 'cerrada_en',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date', 'cerrada_en' => 'datetime'];
    }

    public function linea(): BelongsTo
    {
        return $this->belongsTo(LineaServicio::class, 'linea_servicio_id')->withTrashed();
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class)->withTrashed();
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class)->withTrashed();
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class)->withTrashed();
    }

    /** La persona involucrada (si la hay). */
    public function persona(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function registradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrada_por')->withTrashed();
    }

    public function cerradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por')->withTrashed();
    }

    /** Las acciones de desempeño que se tomaron por ella. */
    public function acciones(): HasMany
    {
        return $this->hasMany(AccionDesempeno::class, 'novedad_id');
    }

    /** Cada vez que se le dio seguimiento (su nota, su cambio de estado y su acción), en orden, con quién y cuándo. */
    public function seguimientos(): HasMany
    {
        return $this->hasMany(Bitacora::class, 'modelo_id')->where('modelo_tipo', self::class)->where('accion', 'seguimiento')->orderBy('id');
    }

    /**
     * El historial del seguimiento: nada se reemplaza, cada nota queda con quién la escribió y cuándo. Lo escrito antes
     * de que hubiera historial es una sola nota, sin fecha ni autor.
     *
     * @return list<array{fecha: string|null, quien: string|null, de: string|null, estado: string|null, nota: string|null, accion: string|null}>
     */
    public function historialSeguimiento(): array
    {
        $pasos = $this->seguimientos->map(fn (Bitacora $b) => [
            'fecha' => $b->created_at?->toIso8601String(),
            'quien' => $b->usuario?->name,
            'de' => $b->cambios['de'] ?? null,
            'estado' => $b->cambios['estado'] ?? null,
            'nota' => $b->cambios['nota'] ?? null,
            'accion' => $b->cambios['accion'] ?? null,
        ])->values()->all();

        if ($pasos === [] && filled($this->seguimiento)) {
            return [['fecha' => null, 'quien' => null, 'de' => null, 'estado' => null, 'nota' => $this->seguimiento, 'accion' => null]];
        }

        return $pasos;
    }

    /** "Ditransa · TuGo · Cali Sur". */
    public function lugar(): string
    {
        return implode(' · ', array_filter([$this->empresa?->nombre, $this->sede?->nombre, $this->sucursal?->nombre]));
    }
}
