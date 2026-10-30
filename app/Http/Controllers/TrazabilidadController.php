<?php

namespace App\Http\Controllers;

use App\Models\Orden;
use App\Models\Vehiculo;
use App\Services\Trazabilidad;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Busca una orden por su código, destinatario, placa o auxiliar y muestra su recorrido. */
class TrazabilidadController extends Controller
{
    private const MAX_RESULTADOS = 30;

    public function __invoke(Request $request, Trazabilidad $trazabilidad): Response
    {
        $datos = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'codigo' => ['nullable', 'string', 'max:60'],
        ]);
        $texto = trim($datos['q'] ?? '');

        $resultados = $texto === '' ? collect() : $this->buscar($texto);
        // Una sola coincidencia se abre de una; sin coincidencias se revisa si es una orden de una carga anulada
        $codigo = $datos['codigo'] ?? match (true) {
            $resultados->count() === 1 => $resultados->first()['codigo'],
            $resultados->isEmpty() && $texto !== '' => $texto,
            default => null,
        };

        return Inertia::render('trazabilidad/index', [
            'filtros' => ['q' => $texto],
            'resultados' => $resultados,
            'limite' => self::MAX_RESULTADOS,
            'traza' => $codigo ? $trazabilidad->deOrden($codigo) : null,
        ]);
    }

    private function buscar(string $texto)
    {
        $like = '%'.addcslashes($texto, '%_\\').'%';
        $placa = '%'.addcslashes((string) Vehiculo::normalizarPlaca($texto), '%_\\').'%';

        return Orden::query()
            ->where(fn ($q) => $q->where('codigo_orden', 'like', $like)->orWhere('destinatario', 'like', $like)
                ->orWhere('placa', 'like', $placa)->orWhere('auxiliar_nombre', 'like', $like)->orWhere('auxiliar_cedula', 'like', $like))
            ->selectRaw('codigo_orden, COUNT(*) as jornadas, MAX(fecha_operacion) as ultima, MAX(destinatario) as destinatario, MAX(placa) as placa, MAX(auxiliar_nombre) as auxiliar')
            ->groupBy('codigo_orden')
            ->orderByDesc('ultima')
            ->limit(self::MAX_RESULTADOS)
            ->toBase()
            ->get()
            ->map(fn ($r) => [
                'codigo' => $r->codigo_orden,
                'jornadas' => (int) $r->jornadas,
                'ultima' => substr((string) $r->ultima, 0, 10),
                'destinatario' => $r->destinatario,
                'placa' => $r->placa,
                'auxiliar' => $r->auxiliar,
            ]);
    }
}
