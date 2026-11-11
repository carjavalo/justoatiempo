<?php

namespace App\Services\Pod;

use App\Models\Orden;
use Illuminate\Support\Collection;

/**
 * Asigna un archivo a su orden: por los códigos que trae adentro (el PDF de Drivin) o por el que trae en el nombre.
 * Drivin nombra la prueba de entrega como "POD_PDVT000228311_20261005.pdf"; también sirve
 * para fotos renombradas ("PDVT000228311_fachada.jpg").
 */
class EmparejadorArchivos
{
    /** @return list<string> */
    public function codigos(string $nombre): array
    {
        preg_match_all('/[A-Za-z]{2,8}\d{4,}/', pathinfo($nombre, PATHINFO_FILENAME), $m);

        return array_values(array_unique(array_map('strtoupper', $m[0])));
    }

    public function orden(string $nombre, ?string $fecha = null): ?Orden
    {
        $codigos = $this->codigos($nombre);
        if ($codigos === []) {
            return null;
        }

        return Orden::query()
            ->whereIn('codigo_orden', $codigos)
            ->when($fecha, fn ($q) => $q->whereDate('fecha_operacion', $fecha))
            ->orderByDesc('fecha_operacion') // si el código se repite en otra jornada, la más reciente
            ->first();
    }

    /**
     * Las órdenes que existen entre los códigos dados (los que trae un PDF), una por código: la de la jornada si se
     * da, si no la más reciente.
     *
     * @param  list<string>  $codigos
     * @return Collection<int, Orden>
     */
    public function ordenes(array $codigos, ?string $fecha = null): Collection
    {
        if ($codigos === []) {
            return collect();
        }

        return Orden::query()
            ->whereIn('codigo_orden', $codigos)
            ->when($fecha, fn ($q) => $q->orderByRaw('DATE(fecha_operacion) = ? DESC', [$fecha]))
            ->orderByDesc('fecha_operacion')
            ->get()
            ->unique('codigo_orden')
            ->values();
    }
}
