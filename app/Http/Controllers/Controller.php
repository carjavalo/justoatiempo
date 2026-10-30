<?php

namespace App\Http\Controllers;

use App\Models\Bitacora;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

abstract class Controller
{
    /**
     * Elimina un registro ya revisado (sin historial) y deja constancia en la bitácora. Si la base aún lo referencia,
     * no se borra y se explica por qué. Los de borrado lógico también se borran del todo: si no, su nombre o su NIT
     * quedarían ocupados por un registro que nadie puede ver.
     */
    protected function eliminarRegistro(Model $registro, string $nombre, string $enUso, ?callable $despues = null): RedirectResponse
    {
        try {
            DB::transaction(function () use ($registro, $nombre) {
                Bitacora::registrar('eliminada', $registro, ['nombre' => $nombre]);
                method_exists($registro, 'forceDelete') ? $registro->forceDelete() : $registro->delete();
            });
        } catch (QueryException) {
            return back()->with('error', $enUso);
        }

        if ($despues) {
            $despues();
        }

        return back()->with('success', "Se eliminó {$nombre}.");
    }
}
