<?php

namespace App\Services;

use App\Enums\EstadoInforme;
use App\Models\InformeDiario;
use App\Models\InformeLinea;
use App\Models\Orden;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Módulo 3: agrupa las órdenes de una jornada y genera el informe diario
 * (fecha > sede > sucursal > ruta > placa > auxiliar) con sus KPIs.
 */
class ConsolidadorInforme
{
    /** RF-06: efectividad = entregas realizadas / asignadas × 100, redondeada a 2 decimales. */
    public static function efectividad(int $aprobadas, int $asignadas): float
    {
        return $asignadas > 0 ? round($aprobadas / $asignadas * 100, 2) : 0.0;
    }

    /**
     * Las entregas se cuentan por producto, como en el informe que se llenaba a mano: una orden con 3 productos son 3
     * entregas. Las devoluciones son los productos de las órdenes rechazadas. Sirve con órdenes guardadas o por importar.
     *
     * @param  Collection<int, Orden|array<string, mixed>>  $ordenes
     * @return array{asignadas: int, realizadas: int, devoluciones: int, efectividad: float}
     */
    public static function entregas(Collection $ordenes): array
    {
        $asignadas = (int) $ordenes->sum(fn ($o) => data_get($o, 'productos'));
        $realizadas = (int) $ordenes->sum(fn ($o) => data_get($o, 'productos_entregados'));

        return [
            'asignadas' => $asignadas,
            'realizadas' => $realizadas,
            'devoluciones' => (int) $ordenes->filter(fn ($o) => data_get($o, 'devolucion'))->sum(fn ($o) => data_get($o, 'productos')),
            'efectividad' => self::efectividad($realizadas, $asignadas),
        ];
    }

    /**
     * Consolida todas las combinaciones sede/sucursal presentes en las órdenes de la fecha.
     *
     * @return Collection<int, InformeDiario>
     */
    public function consolidarFecha(Carbon|string $fecha): Collection
    {
        $fecha = Carbon::parse($fecha)->toDateString();

        return Orden::query()
            ->whereDate('fecha_operacion', $fecha)
            ->whereNotNull('sede_id')
            ->select('sede_id', 'sucursal_id')
            ->distinct()
            ->get()
            ->map(fn ($g) => $this->consolidar($fecha, $g->sede_id, $g->sucursal_id));
    }

    /** @param  bool  $aunCerrado  recalcular también uno cerrado (solo lo calculado: su estado no cambia) */
    public function consolidar(Carbon|string $fecha, int $sedeId, ?int $sucursalId, bool $aunCerrado = false): InformeDiario
    {
        $fecha = Carbon::parse($fecha)->toDateString();

        return DB::transaction(function () use ($fecha, $sedeId, $sucursalId, $aunCerrado) {
            $informe = InformeDiario::firstOrNew([
                'fecha_operacion' => $fecha,
                'sede_id' => $sedeId,
                'sucursal_id' => $sucursalId,
            ]);

            if ($informe->exists && $informe->estaCerrado() && ! $aunCerrado) {
                throw new RuntimeException('El informe está cerrado y no puede recalcularse.');
            }

            $informe->estado ??= EstadoInforme::Borrador;
            $informe->save();

            $ordenes = Orden::query()
                ->with('auditoria')
                ->whereDate('fecha_operacion', $fecha)
                ->where('sede_id', $sedeId)
                ->when($sucursalId, fn ($q) => $q->where('sucursal_id', $sucursalId), fn ($q) => $q->whereNull('sucursal_id'))
                ->get();

            Orden::whereIn('id', $ordenes->pluck('id'))->update(['informe_id' => $informe->id]);

            // Cada fila (ruta, placa y auxiliar) se actualiza en su sitio al recalcular (al auditar o al cargar otra
            // preliquidación): no se acumulan copias, conserva lo escrito a mano y sigue siendo la misma para quien
            // está escribiendo su observación. La que se quedó sin órdenes se retira con rastro y, si sus órdenes
            // vuelven (otra carga del mismo día), reaparece con su observación.
            $clave = fn ($ruta, $placa, $auxiliar) => implode('|', [$ruta, $placa, $auxiliar]);
            $deLaFila = fn (InformeLinea $l) => $clave($l->ruta, $l->vehiculo_id ?? $l->placa, $l->auxiliar_id ?? $l->auxiliar_nombre);
            $todas = $informe->lineas()->withTrashed()->orderBy('id')->get();
            $vigentes = $todas->whereNull('deleted_at')->keyBy($deLaFila);
            // De las retiradas con la misma clave, la más reciente
            $retiradas = $todas->whereNotNull('deleted_at')->keyBy($deLaFila);

            $grupos = $ordenes->groupBy(fn (Orden $o) => $clave($o->ruta, $o->vehiculo_id ?? $o->placa, $o->auxiliar_id ?? $o->auxiliar_nombre));

            foreach ($grupos as $llave => $grupo) {
                $datos = $this->calcularLinea($grupo);
                if ($linea = $vigentes->pull($llave)) {
                    $linea->update($datos);
                } elseif ($linea = $retiradas->get($llave)) {
                    $linea->restore();
                    $linea->update($datos);
                } else {
                    $informe->lineas()->create($datos);
                }
            }

            // Las que ya no tienen órdenes (p. ej. al anular su carga) dejan de verse, sin borrarse
            $vigentes->each->delete();

            $e = self::entregas($ordenes);

            $informe->fill([
                'total_asignadas' => $e['asignadas'],
                'total_aprobadas' => $e['realizadas'],
                'total_rechazadas' => $e['asignadas'] - $e['realizadas'],
                'total_devoluciones' => $e['devoluciones'],
                'total_averias' => $ordenes->where('averia', true)->count(),
                'total_faltantes' => $ordenes->where('faltante', true)->count(),
                'efectividad' => $e['efectividad'],
            ])->save();

            return $informe->fresh('lineas');
        });
    }

    /**
     * Recalcula todos los informes con las reglas vigentes (p. ej. al cambiar cómo se escriben las novedades),
     * también los cerrados: solo cambia lo calculado, no su estado.
     */
    public function recalcularTodos(): int
    {
        $total = 0;
        InformeDiario::query()->whereNotNull('sede_id')->orderBy('id')->each(function (InformeDiario $i) use (&$total) {
            $this->consolidar($i->fecha_operacion, $i->sede_id, $i->sucursal_id, true);
            $total++;
        });

        return $total;
    }

    /** @param Collection<int, Orden> $grupo */
    private function calcularLinea(Collection $grupo): array
    {
        $primera = $grupo->first();
        $e = self::entregas($grupo);
        $auditadas = $grupo->filter(fn (Orden $o) => $o->auditoria?->auditado_en !== null);
        // Sin evidencias: Drivin dice que no tiene imágenes, o la auditoría no encontró ninguna
        $sinEvidencia = $grupo->filter(fn (Orden $o) => $o->tiene_imagenes === false || ($o->auditoria?->auditado_en && $o->auditoria->sin_evidencia))->count();

        return [
            'ruta' => $primera->ruta,
            'vehiculo_id' => $primera->vehiculo_id,
            'placa' => $primera->placa,
            'auxiliar_id' => $primera->auxiliar_id,
            'auxiliar_nombre' => $primera->auxiliar_nombre,
            // Entregas por producto; las órdenes, para ver en cuántas paradas iban
            'ordenes' => $grupo->count(),
            'asignadas' => $e['asignadas'],
            'aprobadas' => $e['realizadas'],
            'rechazadas' => $e['asignadas'] - $e['realizadas'],
            'efectividad' => $e['efectividad'],
            'devoluciones' => $e['devoluciones'],
            'averias' => $grupo->where('averia', true)->count(),
            'faltantes' => $grupo->where('faltante', true)->count(),
            'ordenes_sin_evidencia' => $sinEvidencia,
            // POD / Evidencia del informe: sin evidencias en alguna orden, no; con auditorías, todas deben cumplir el
            // protocolo; sin auditar, sí si Drivin dice que todas tienen imágenes (null si no lo dice)
            'pod_cumple' => match (true) {
                $sinEvidencia > 0 => false,
                $auditadas->isNotEmpty() => $auditadas->every(fn (Orden $o) => $o->auditoria->cumple_protocolo),
                $grupo->every(fn (Orden $o) => $o->tiene_imagenes === true) => true,
                default => null,
            },
            'novedades' => self::novedades($grupo, $auditadas, $sinEvidencia),
        ];
    }

    /**
     * Las novedades de la fila, como las escribe quien hace el informe: "Sin evidencias en 2 órdenes · 1 devolución
     * (Cliente reprograma fecha de recibo)". Sin nada que reportar: "Sin novedad".
     *
     * @param  Collection<int, Orden>  $grupo
     * @param  Collection<int, Orden>  $auditadas
     */
    public static function novedades(Collection $grupo, Collection $auditadas, int $sinEvidencia): string
    {
        $cuantas = fn (int $n, string $uno, string $varias) => $n === 1 ? "1 {$uno}" : "{$n} {$varias}";
        $partes = [];

        if ($sinEvidencia > 0) {
            $partes[] = 'Sin evidencias en '.$cuantas($sinEvidencia, 'orden', 'órdenes');
        }
        $protocolo = $auditadas->filter(fn (Orden $o) => ! $o->auditoria->cumple_protocolo && ! $o->auditoria->sin_evidencia)->count();
        if ($protocolo > 0) {
            $partes[] = 'Protocolo de entrega incompleto en '.$cuantas($protocolo, 'orden', 'órdenes');
        }
        $borrosas = $auditadas->filter(fn (Orden $o) => $o->auditoria->fotos_ilegibles > 0)->count();
        if ($borrosas > 0) {
            $partes[] = 'Fotos borrosas o ilegibles en '.$cuantas($borrosas, 'orden', 'órdenes');
        }
        // Las devoluciones, por producto como la columna del informe
        $devueltas = $grupo->where('devolucion', true);
        if ($devueltas->isNotEmpty()) {
            $motivos = $devueltas->pluck('motivo_texto')->filter()->unique()->take(3)->implode(', ');
            $partes[] = $cuantas(self::entregas($grupo)['devoluciones'], 'devolución', 'devoluciones').($motivos !== '' ? " ({$motivos})" : '');
        }
        if (($averias = $grupo->where('averia', true)->count()) > 0) {
            $partes[] = $cuantas($averias, 'avería', 'averías');
        }
        if (($faltantes = $grupo->where('faltante', true)->count()) > 0) {
            $partes[] = $cuantas($faltantes, 'entrega con faltantes', 'entregas con faltantes');
        }

        return $partes === [] ? 'Sin novedad' : implode(' · ', $partes);
    }
}
