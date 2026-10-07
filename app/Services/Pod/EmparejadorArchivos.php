<?php

namespace App\Services\Pod;

use App\Models\Orden;

/**
 * Asigna un archivo a su orden por el código que trae el nombre.
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
}
