<?php

namespace App\Services;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Models\InformeDiario;
use App\Models\Orden;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Módulo 3: agrupa las órdenes de una jornada y genera el informe diario
 * (fecha > cliente > sede > ruta > placa > auxiliar) con sus KPIs.
 */
class ConsolidadorInforme
{
    /** RF-06: efectividad = aprobadas / asignadas × 100, redondeada a 2 decimales. */
    public static function efectividad(int $aprobadas, int $asignadas): float
    {
        return $asignadas > 0 ? round($aprobadas / $asignadas * 100, 2) : 0.0;
    }

    /**
     * Consolida todas las combinaciones cliente/sede presentes en las órdenes de la fecha.
     *
     * @return Collection<int, InformeDiario>
     */
    public function consolidarFecha(Carbon|string $fecha): Collection
    {
        $fecha = Carbon::parse($fecha)->toDateString();

        return Orden::query()
            ->whereDate('fecha_operacion', $fecha)
            ->whereNotNull('cliente_id')
            ->select('cliente_id', 'sede_id')
            ->distinct()
            ->get()
            ->map(fn ($g) => $this->consolidar($fecha, $g->cliente_id, $g->sede_id));
    }

    public function consolidar(Carbon|string $fecha, int $clienteId, ?int $sedeId): InformeDiario
    {
        $fecha = Carbon::parse($fecha)->toDateString();

        return DB::transaction(function () use ($fecha, $clienteId, $sedeId) {
            $informe = InformeDiario::firstOrNew([
                'fecha_operacion' => $fecha,
                'cliente_id' => $clienteId,
                'sede_id' => $sedeId,
            ]);

            if ($informe->exists && $informe->estaCerrado()) {
                throw new RuntimeException('El informe está cerrado y no puede recalcularse.');
            }

            $informe->estado ??= EstadoInforme::Borrador;
            $informe->save();

            $ordenes = Orden::query()
                ->with('auditoria')
                ->whereDate('fecha_operacion', $fecha)
                ->where('cliente_id', $clienteId)
                ->when($sedeId, fn ($q) => $q->where('sede_id', $sedeId), fn ($q) => $q->whereNull('sede_id'))
                ->get();

            Orden::whereIn('id', $ordenes->pluck('id'))->update(['informe_id' => $informe->id]);

            $informe->lineas()->delete();

            $grupos = $ordenes->groupBy(fn (Orden $o) => implode('|', [
                $o->ruta, $o->vehiculo_id ?? $o->placa, $o->empleado_id ?? $o->auxiliar_nombre,
            ]));

            foreach ($grupos as $grupo) {
                $informe->lineas()->create($this->calcularLinea($grupo));
            }

            $aprobadas = $ordenes->where('estado', EstadoOrden::Aprobada)->count();

            $informe->fill([
                'total_asignadas' => $ordenes->count(),
                'total_aprobadas' => $aprobadas,
                'total_rechazadas' => $ordenes->where('estado', '!=', EstadoOrden::Aprobada)->count(),
                'total_devoluciones' => $ordenes->where('devolucion', true)->count(),
                'total_averias' => $ordenes->where('averia', true)->count(),
                'total_faltantes' => $ordenes->where('faltante', true)->count(),
                'efectividad' => self::efectividad($aprobadas, $ordenes->count()),
            ])->save();

            return $informe->fresh('lineas');
        });
    }

    /** @param Collection<int, Orden> $grupo */
    private function calcularLinea(Collection $grupo): array
    {
        $primera = $grupo->first();
        $aprobadas = $grupo->where('estado', EstadoOrden::Aprobada)->count();
        $auditadas = $grupo->filter(fn (Orden $o) => $o->auditoria?->auditado_en !== null);

        $novedades = $auditadas
            ->map(fn (Orden $o) => $o->auditoria->concepto)
            ->filter()
            ->unique()
            ->implode(' · ');

        return [
            'ruta' => $primera->ruta,
            'vehiculo_id' => $primera->vehiculo_id,
            'placa' => $primera->placa,
            'empleado_id' => $primera->empleado_id,
            'auxiliar_nombre' => $primera->auxiliar_nombre,
            'asignadas' => $grupo->count(),
            'aprobadas' => $aprobadas,
            'rechazadas' => $grupo->count() - $aprobadas,
            'efectividad' => self::efectividad($aprobadas, $grupo->count()),
            'devoluciones' => $grupo->where('devolucion', true)->count(),
            'averias' => $grupo->where('averia', true)->count(),
            'faltantes' => $grupo->where('faltante', true)->count(),
            'ordenes_sin_evidencia' => $grupo->filter(fn (Orden $o) => $o->auditoria?->sin_evidencia)->count(),
            // null mientras no haya entregas auditadas; si las hay, todas deben cumplir el protocolo
            'pod_cumple' => $auditadas->isEmpty() ? null : $auditadas->every(fn (Orden $o) => $o->auditoria->cumple_protocolo),
            'novedades' => $novedades ?: null,
        ];
    }
}
