<?php

namespace App\Http\Controllers;

use App\Models\Bitacora;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Elimina un registro sin borrarlo de la base: queda marcado como eliminado (deleted_at), deja de verse y su
     * rastro queda en la bitácora (quién, cuándo y qué). Lo que lo referencia (órdenes, informes, programación…)
     * se conserva tal cual. Su nombre, cédula o placa quedan libres: los únicos solo cuentan lo vigente.
     *
     * `$antes` corre dentro de la misma transacción, antes de marcarlo: lo que hay que dejar en orden primero
     * (terminar las asignaciones de un lugar, pasar a otro rol a sus personas…).
     */
    protected function eliminarRegistro(Model $registro, string $nombre, ?callable $antes = null, array $detalle = []): RedirectResponse
    {
        DB::transaction(function () use ($registro, $nombre, $antes, $detalle) {
            $resultado = $antes ? $antes() : [];
            Bitacora::registrar('eliminada', $registro, ['nombre' => $nombre, ...$detalle, ...(is_array($resultado) ? $resultado : [])]);
            $registro->delete();
        });

        return back()->with('success', "Se eliminó {$nombre}.");
    }
}
