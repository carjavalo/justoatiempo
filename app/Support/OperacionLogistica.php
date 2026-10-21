<?php

namespace App\Support;

use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Lo que una persona alcanza a ver de la operación logística: las sedes de las empresas que reciben la línea, dentro
 * de sus asignaciones, y dentro de cada sede solo las sucursales que sus asignaciones fijan. Lo usan el tablero, el
 * informe diario, el seguimiento y sus descargas, para que todos muestren lo mismo.
 */
final class OperacionLogistica
{
    /**
     * @param  Collection<int, Sede>  $sedes  todas las sedes del alcance (las inactivas conservan su historial)
     * @param  Collection<int, Sede>  $sedesVista  las de la vista: todas o la sede elegida
     */
    private function __construct(
        public readonly LineaServicio $linea,
        public readonly Alcance $alcance,
        public readonly Collection $sedes,
        public readonly Collection $sedesVista,
        public readonly ?int $sedeId,
    ) {}

    /**
     * @param  int|null  $sedePedida  la sede elegida en la vista (si está en el alcance)
     * @param  bool  $soloEmpresas  quien ve solo lo suyo (el auxiliar) ve sus órdenes en sus empresas, sin fijar sede
     */
    public static function para(User $user, ?int $sedePedida = null, bool $soloEmpresas = false): self
    {
        $linea = LineaServicio::logistica();
        // El informe y el seguimiento de logística (los de Drivin) son de quien trabaja en ella
        abort_unless($user->trabajaEn($linea), 403, 'Esta herramienta es de otra línea de servicio.');
        $alcance = $soloEmpresas ? $user->alcanceEn($linea)->soloEmpresas() : $user->alcanceEn($linea);
        $sedes = $alcance->filtrarSedes(Sede::query()
            ->whereHas('empresa', fn ($q) => $q->whereHas('lineas', fn ($l) => $l->whereKey($linea->id))))
            ->with('empresa:id,nombre,activo')
            ->orderBy('nombre')
            ->get(['id', 'empresa_id', 'nombre', 'color', 'meta_efectividad', 'activo']);
        $ids = $sedes->pluck('id')->all();

        // Con una sola sede (y alcance limitado) es esa; si no, la pedida, si está dentro del alcance
        $pedida = count($ids) === 1 && ! $alcance->todo ? $ids[0] : $sedePedida;
        $sedeId = in_array($pedida, $ids, true) ? $pedida : null;

        return new self($linea, $alcance, $sedes, $sedeId ? $sedes->where('id', $sedeId)->values() : $sedes, $sedeId);
    }

    /** Filtra una consulta con sede_id/sucursal_id (órdenes, informes) a lo que se ve. */
    public function ubicacion(Builder $q, string $tabla = ''): Builder
    {
        return $this->alcance->filtrarUbicacion($q, $this->sedesVista, $tabla);
    }

    /** Las sedes que se ofrecen para elegir: las activas de empresas activas. */
    public function opcionesSede(): Collection
    {
        return $this->sedes->filter(fn (Sede $s) => $s->activo && $s->empresa?->activo)->values();
    }
}
