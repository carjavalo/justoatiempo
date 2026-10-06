<?php

namespace App\Services\Drivin;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use RuntimeException;

/**
 * Lee la preliquidación exportada de Drivin (.xlsx, .xls o .csv).
 * El libro trae varias hojas (PoE, Entregas, Eventos, KPIs…) y los encabezados no siempre
 * están en la fila 1, así que se elige la hoja y la fila cuyo encabezado reconoce más columnas.
 */
class LectorPreliquidacion
{
    private const FILAS_BUSQUEDA_ENCABEZADO = 15;

    /**
     * @return array{
     *     hojas: list<array{nombre: string, puntaje: int, filas: int}>,
     *     hoja: string,
     *     filaEncabezados: int,
     *     encabezados: array<int, string>,
     *     filas: list<array{fila: int, valores: array<int, mixed>}>
     * }
     */
    public function leer(string $ruta, ?string $hojaPreferida = null): array
    {
        $libro = $this->abrir($ruta);

        $candidatas = [];
        foreach ($libro->getWorksheetIterator() as $hoja) {
            $datos = $hoja->toArray(null, true, false, false);
            [$fila, $puntaje] = $this->ubicarEncabezado($datos);
            $candidatas[$hoja->getTitle()] = ['datos' => $datos, 'fila' => $fila, 'puntaje' => $puntaje];
        }

        if ($candidatas === []) {
            throw new RuntimeException('El archivo no contiene hojas con datos.');
        }

        $elegida = $hojaPreferida !== null && isset($candidatas[$hojaPreferida])
            ? $hojaPreferida
            : collect($candidatas)
                ->sortByDesc(fn ($c) => [$c['puntaje'], count($c['datos'])])
                ->keys()
                ->first();

        $c = $candidatas[$elegida];
        $encabezados = array_map(fn ($v) => trim((string) $v), $c['datos'][$c['fila']] ?? []);

        $filas = [];
        foreach (array_slice($c['datos'], $c['fila'] + 1, null, true) as $i => $valores) {
            if ($this->vacia($valores)) {
                continue;
            }
            $filas[] = ['fila' => $i + 1, 'valores' => $valores]; // número de fila tal como lo ve Excel
        }

        return [
            'hojas' => collect($candidatas)->map(fn ($c, $nombre) => [
                'nombre' => (string) $nombre,
                'puntaje' => $c['puntaje'],
                'filas' => max(0, count($c['datos']) - $c['fila'] - 1),
            ])->values()->all(),
            'hoja' => (string) $elegida,
            'filaEncabezados' => $c['fila'] + 1,
            'encabezados' => $encabezados,
            'filas' => $filas,
        ];
    }

    private function abrir(string $ruta): Spreadsheet
    {
        try {
            $lector = IOFactory::createReaderForFile($ruta);
        } catch (\Throwable) {
            throw new RuntimeException('No se reconoce el formato del archivo. Exporta la preliquidación de Drivin en Excel (.xlsx) o CSV.');
        }

        if ($lector instanceof Csv) {
            $muestra = (string) file_get_contents($ruta, false, null, 0, 4096);
            $lector->setInputEncoding(mb_check_encoding($muestra, 'UTF-8') ? 'UTF-8' : 'Windows-1252');
            $lector->setDelimiter(substr_count($muestra, ';') > substr_count($muestra, ',') ? ';' : ',');
        } else {
            $lector->setReadDataOnly(true);
        }

        try {
            return $lector->load($ruta);
        } catch (\Throwable) {
            throw new RuntimeException('El archivo está dañado o protegido y no se pudo leer.');
        }
    }

    /**
     * @param  array<int, array<int, mixed>>  $datos
     * @return array{0: int, 1: int} índice (base 0) de la fila de encabezados y su puntaje
     */
    private function ubicarEncabezado(array $datos): array
    {
        $mejor = [0, 0];
        foreach (array_slice($datos, 0, self::FILAS_BUSQUEDA_ENCABEZADO, true) as $i => $fila) {
            $p = MapeoColumnas::puntaje($fila);
            if ($p > $mejor[1]) {
                $mejor = [$i, $p];
            }
        }

        return $mejor;
    }

    /** @param array<int, mixed> $valores */
    private function vacia(array $valores): bool
    {
        foreach ($valores as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return false;
            }
        }

        return true;
    }
}
