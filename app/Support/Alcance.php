<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Lo que alguien ve de la operación: todo, o solo los lugares de sus asignaciones vigentes. Cada lugar es una
 * empresa y, si la asignación los fija, una sede y una sucursal. Se arma en App\Models\User::alcanceEn.
 */
final class Alcance
{
    /** @param  list<array{empresa: int, sede: int|null, sucursal: int|null}>  $lugares */
    private function __construct(public readonly bool $todo, public readonly array $lugares) {}

    public static function todo(): self
    {
        return new self(true, []);
    }

    /** @param  iterable<array{empresa: int, sede: int|null, sucursal: int|null}>  $lugares */
    public static function lugares(iterable $lugares): self
    {
        return new self(false, array_values(collect($lugares)->unique(fn ($l) => "{$l['empresa']}-{$l['sede']}-{$l['sucursal']}")->all()));
    }

    /** Las mismas empresas, sin fijar sedes ni sucursales (para quien solo ve lo suyo dentro de sus empresas). */
    public function soloEmpresas(): self
    {
        return $this->todo ? $this : self::lugares(array_map(fn ($e) => ['empresa' => $e, 'sede' => null, 'sucursal' => null], $this->empresas()));
    }

    /** No ve nada de la operación (sin asignaciones vigentes). */
    public function vacio(): bool
    {
        return ! $this->todo && $this->lugares === [];
    }

    /** @return list<int> Las empresas que ve (vacío si las ve todas o ninguna). */
    public function empresas(): array
    {
        return array_values(array_unique(array_column($this->lugares, 'empresa')));
    }

    /** Si un lugar (empresa, sede y sucursal) cabe en lo que ve. */
    public function incluye(?int $empresa, ?int $sede = null, ?int $sucursal = null): bool
    {
        if ($this->todo) {
            return true;
        }

        foreach ($this->lugares as $l) {
            if ($l['empresa'] === $empresa
                && ($l['sede'] === null || $l['sede'] === $sede)
                && ($l['sucursal'] === null || $l['sucursal'] === $sucursal)) {
                return true;
            }
        }

        return false;
    }

    /** Limita una consulta de sedes (con columna empresa_id) a las que ve. */
    public function filtrarSedes(Builder $sedes): Builder
    {
        if ($this->todo) {
            return $sedes;
        }

        return $sedes->where(function (Builder $w) {
            $w->whereRaw('1 = 0');
            foreach ($this->lugares as $l) {
                $w->orWhere(fn (Builder $o) => $o->where('sedes.empresa_id', $l['empresa'])->when($l['sede'], fn ($s, int $id) => $s->whereKey($id)));
            }
        });
    }

    /**
     * Limita una consulta con columnas sede_id y sucursal_id (órdenes, informes…) a lo que ve, dentro de las sedes
     * dadas: una sede entera, o solo la sucursal que fija la asignación.
     *
     * @param  Collection<int, object{id: int, empresa_id: int}>  $sedes  las sedes del alcance, con su empresa
     */
    public function filtrarUbicacion(Builder $q, Collection $sedes, string $tabla = ''): Builder
    {
        $col = fn (string $c) => $tabla ? "{$tabla}.{$c}" : $c;
        $ids = $sedes->pluck('id')->all();
        if ($this->todo) {
            return $q->whereIn($col('sede_id'), $ids);
        }

        return $q->where(function (Builder $w) use ($sedes, $col) {
            $w->whereRaw('1 = 0');
            foreach ($sedes as $sede) {
                $sucursales = [];
                $entera = false;
                foreach ($this->lugares as $l) {
                    if ($l['empresa'] !== $sede->empresa_id || ($l['sede'] !== null && $l['sede'] !== $sede->id)) {
                        continue;
                    }
                    if ($l['sucursal'] === null) {
                        $entera = true;
                    } else {
                        $sucursales[] = $l['sucursal'];
                    }
                }
                if ($entera) {
                    $w->orWhere($col('sede_id'), $sede->id);
                } elseif ($sucursales) {
                    $w->orWhere(fn (Builder $o) => $o->where($col('sede_id'), $sede->id)->whereIn($col('sucursal_id'), $sucursales));
                }
            }
        });
    }

    /** Limita una consulta de asignaciones a las que caen en sus lugares. */
    public function filtrarAsignaciones(Builder $asignaciones): Builder
    {
        if ($this->todo) {
            return $asignaciones;
        }

        return $asignaciones->where(function (Builder $w) {
            $w->whereRaw('1 = 0');
            foreach ($this->lugares as $l) {
                $w->orWhere(fn (Builder $o) => $o->where('asignaciones.empresa_id', $l['empresa'])
                    ->when($l['sede'], fn ($q, int $id) => $q->where('asignaciones.sede_id', $id))
                    ->when($l['sucursal'], fn ($q, int $id) => $q->where('asignaciones.sucursal_id', $id)));
            }
        });
    }

    /** Si dentro de alguna sede solo ve sucursales (no la sede entera). */
    public function fijaSucursales(): bool
    {
        return collect($this->lugares)->contains(fn ($l) => $l['sucursal'] !== null);
    }
}
