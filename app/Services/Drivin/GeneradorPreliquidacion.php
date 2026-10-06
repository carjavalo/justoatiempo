<?php

namespace App\Services\Drivin;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Escribe un .xlsx con la misma forma que la exportación de Drivin (libro con hojas PoE, Entregas,
 * Eventos, KPIs, Reingreso y Preguntas; fila 1 vacía y encabezados en la fila 2; una fila por producto).
 * Se usa para el archivo de ejemplo (php artisan drivin:ejemplo) y en las pruebas automáticas.
 */
class GeneradorPreliquidacion
{
    /** Encabezados en el orden de la exportación real (los del medio, inferidos del video). */
    public const ENCABEZADOS = [
        'Nombre Plan', 'Fecha Plan', 'Grupo de Flota', 'Código del Vehículo', 'Descripción del Vehículo', 'Número de Viaje',
        'ETA aprobado', 'Odómetro', 'Código de Dirección', 'Código de Orden', 'Cliente', 'Nombre de Contacto', 'Dirección',
        'Ciudad', 'Provincia', 'País', 'Latitud', 'Longitud', 'Descripción del Item', 'Unidades Entregadas', 'Estado de la orden',
        'Motivo', 'Hora de Entrega', 'Comentario PoE', 'Conductor', 'Asistente', 'Pregunta 1', 'Pregunta 2', 'Pregunta 3',
        'Comentario Cliente', 'Comentario general de la ruta',
    ];

    /**
     * @param  list<array<string, mixed>>  $filas  cada fila indexada por nombre de encabezado
     * @param  list<string>|null  $encabezados  para simular exportaciones con columnas distintas
     */
    public function escribir(string $ruta, array $filas, ?array $encabezados = null): string
    {
        $encabezados ??= self::ENCABEZADOS;
        $libro = new Spreadsheet;

        $poe = $libro->getActiveSheet()->setTitle('PoE');
        $poe->fromArray($encabezados, null, 'A2');
        $datos = array_map(fn ($f) => array_map(fn ($h) => $f[$h] ?? null, $encabezados), $filas);
        if ($datos !== []) {
            $poe->fromArray($datos, null, 'A3', true);
        }

        // Hojas que acompañan la exportación (sin las columnas de la preliquidación)
        foreach (['Entregas' => ['Ruta', 'Entregas', 'Exitosas'], 'Eventos' => ['Evento', 'Hora'], 'KPIs' => ['Indicador', 'Valor'], 'Reingreso' => ['Orden', 'Motivo reingreso'], 'Preguntas' => ['Pregunta', 'Respuesta']] as $titulo => $cols) {
            $libro->createSheet()->setTitle($titulo)->fromArray($cols, null, 'A1');
        }

        if (! is_dir(dirname($ruta))) {
            mkdir(dirname($ruta), 0775, true);
        }
        (new Xlsx($libro))->save($ruta);
        $libro->disconnectWorksheets();

        return $ruta;
    }
}
