<?php

namespace App\Services\Drivin;

use App\Enums\EstadoCarga;
use App\Models\Bitacora;
use App\Models\Carga;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Parametro;
use App\Services\ConsolidadorInforme;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Orquesta el módulo 2: lee el archivo guardado, lo analiza con el mapeo elegido en la revisión,
 * guarda las órdenes válidas y consolida los informes diarios afectados (módulo 3).
 */
class ImportadorPreliquidacion
{
    public function __construct(
        private LectorPreliquidacion $lector,
        private AnalizadorPreliquidacion $analizador,
        private ConsolidadorInforme $consolidador,
    ) {}

    /** Lectura + análisis de una carga en revisión (no escribe nada). */
    public function analizar(Carga $carga): array
    {
        $lectura = $this->lector->leer(Storage::disk('local')->path($carga->archivo_path), $carga->hoja);

        // Primera vez: se detecta el mapeo, partiendo del último que confirmó el usuario
        $mapeo = $carga->mapeo_columnas ?? $this->mapeoSugerido($lectura['encabezados']);

        $analisis = $this->analizador->analizar($lectura, $mapeo, $carga->opciones ?? []);

        return ['lectura' => $lectura, 'mapeo' => $mapeo, 'analisis' => $analisis];
    }

    /**
     * Importa las órdenes válidas. RNF: hasta 1.000 líneas en menos de 5 s (inserción por lotes).
     *
     * @return array{ordenes: int, informes: list<int>}
     */
    public function importar(Carga $carga): array
    {
        if ($carga->estado !== EstadoCarga::EnRevision) {
            throw new RuntimeException('Esta carga ya fue procesada.');
        }

        $inicio = hrtime(true);
        ['lectura' => $lectura, 'mapeo' => $mapeo, 'analisis' => $a] = $this->analizar($carga);

        if ($a['columnasFaltantes'] !== []) {
            throw new RuntimeException('Faltan columnas obligatorias en el mapeo.');
        }
        if ($a['ordenes'] === []) {
            throw new RuntimeException('El archivo no tiene órdenes válidas para importar.');
        }

        return DB::transaction(function () use ($carga, $lectura, $mapeo, $a, $inicio) {
            $ahora = now();
            $filas = array_map(fn (array $o) => [
                ...collect($o)->except(['fila'])->all(),
                'carga_id' => $carga->id,
                'datos_crudos' => json_encode($o['datos_crudos'], JSON_UNESCAPED_UNICODE),
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ], $a['ordenes']);

            foreach (array_chunk($filas, 500) as $lote) {
                Orden::insert($lote);
            }

            $informes = collect($a['ordenes'])
                ->unique(fn ($o) => $o['fecha_operacion'].'|'.$o['cliente_id'].'|'.$o['sede_id'])
                ->map(fn ($o) => $this->consolidador->consolidar($o['fecha_operacion'], $o['cliente_id'], $o['sede_id'])->id)
                ->values()
                ->all();

            $fechaPrincipal = collect($a['fechas'])->sortDesc()->keys()->first();

            $carga->update([
                'estado' => $a['totalErrores'] > 0 ? EstadoCarga::ConErrores : EstadoCarga::Procesada,
                'hoja' => $lectura['hoja'],
                'fila_encabezados' => $lectura['filaEncabezados'],
                'mapeo_columnas' => $mapeo,
                'fecha_operacion' => $fechaPrincipal,
                'total_filas' => $a['filasLeidas'],
                'filas_validas' => $a['filasLeidas'] - $a['filasConError'],
                'filas_error' => $a['filasConError'],
                'ordenes_importadas' => count($a['ordenes']),
                'advertencias' => $a['totalAdvertencias'],
                'errores' => $a['errores'],
                'resumen' => [
                    'totales' => $a['totales'],
                    'fechas' => $a['fechas'],
                    'advertencias' => $a['advertencias'],
                    'informes' => $informes,
                ],
                'procesado_en' => now(),
                'duracion_ms' => (int) ((hrtime(true) - $inicio) / 1e6),
            ]);

            // El mapeo confirmado se recuerda para las próximas cargas
            Parametro::updateOrCreate(
                ['clave' => 'drivin_mapeo_columnas'],
                ['valor' => json_encode(['encabezados' => $lectura['encabezados'], 'mapeo' => $mapeo], JSON_UNESCAPED_UNICODE), 'descripcion' => 'Último mapeo de columnas confirmado para la preliquidación de Drivin'],
            );

            Bitacora::registrar('importada', $carga, ['ordenes' => count($a['ordenes']), 'filas_omitidas' => $a['filasConError']]);

            return ['ordenes' => count($a['ordenes']), 'informes' => $informes];
        });
    }

    /** Elimina las órdenes de la carga y recalcula los informes; solo si ninguno está cerrado. */
    public function anular(Carga $carga): void
    {
        $claves = $carga->ordenes()
            ->select('fecha_operacion', 'cliente_id', 'sede_id')
            ->distinct()
            ->get();

        $cerrado = $claves->first(fn ($k) => InformeDiario::query()
            ->whereDate('fecha_operacion', $k->fecha_operacion)
            ->where('cliente_id', $k->cliente_id)
            ->where('sede_id', $k->sede_id)
            ->where('estado', 'cerrado')
            ->exists());

        if ($cerrado) {
            throw new RuntimeException('No se puede anular: uno de los informes de esta carga ya está cerrado.');
        }

        DB::transaction(function () use ($carga, $claves) {
            $carga->ordenes()->delete();

            foreach ($claves as $k) {
                $informe = $this->consolidador->consolidar($k->fecha_operacion, $k->cliente_id, $k->sede_id);
                if ($informe->total_asignadas === 0) {
                    $informe->delete(); // la jornada quedó sin órdenes
                }
            }

            $carga->update(['estado' => EstadoCarga::Anulada, 'anulada_por' => auth()->id(), 'anulada_en' => now()]);
            Bitacora::registrar('anulada', $carga);
        });
    }

    /**
     * Detección automática, pero si los encabezados coinciden con los de la última carga confirmada
     * se reutiliza el mapeo que el usuario ajustó entonces.
     *
     * @param  array<int, string>  $encabezados
     * @return array<string, int|null>
     */
    private function mapeoSugerido(array $encabezados): array
    {
        $ultimo = json_decode((string) Parametro::where('clave', 'drivin_mapeo_columnas')->value('valor'), true);

        if (is_array($ultimo) && ($ultimo['encabezados'] ?? null) === $encabezados) {
            return $ultimo['mapeo'] + array_fill_keys(array_keys(MapeoColumnas::CAMPOS), null);
        }

        return MapeoColumnas::detectar($encabezados);
    }
}
