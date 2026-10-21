<?php

namespace App\Services;

use App\Models\AccionDesempeno;
use App\Models\InformeDiario;
use App\Models\InformeLinea;
use App\Models\Orden;
use App\Models\Parametro;
use App\Support\OperacionLogistica;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Shared\Date as FechaExcel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Escribe el informe en el formato del Excel de la operación ("INFORME DIARIO DE OPERACIONES"), con sus hojas:
 * Informe Diario, Seguimiento (la auditoría de cada orden), Resumen por ciudad y Dashboard Gerencial.
 */
class ExportadorInforme
{
    private const AZUL = '1F3A68';

    private const CORAL = 'E8705F';

    public function escribir(OperacionLogistica $op, Carbon $desde, Carbon $hasta): void
    {
        $informes = $op->ubicacion(InformeDiario::query())
            ->whereBetween('fecha_operacion', [$desde->toDateString(), $hasta->toDateString()])
            ->with(['sede:id,nombre', 'sucursal:id,nombre,ciudad', 'lineas.auxiliar:id,name'])
            ->orderBy('fecha_operacion')
            ->get();
        $acciones = AccionDesempeno::whereIn('informe_id', $informes->pluck('id'))->orderBy('id')->get()
            ->groupBy(fn (AccionDesempeno $a) => $a->informe_id.'|'.$a->user_id);

        $filas = $informes->flatMap(fn (InformeDiario $i) => $i->lineas->sortBy('auxiliar_nombre')->map(fn (InformeLinea $l) => [
            'fecha' => $i->fecha_operacion,
            'cliente' => trim($i->sede?->nombre.($i->sucursal ? ' · '.$i->sucursal->nombre : '')),
            'trabajador' => $l->auxiliar?->name ?? $l->auxiliar_nombre ?? 'Sin auxiliar',
            'ciudad' => $i->sucursal?->ciudad ?? '',
            'operacion' => 'RUTA'.($l->placa ? " / {$l->placa}" : ''),
            'asignadas' => $l->asignadas,
            'realizadas' => $l->aprobadas,
            'pendientes' => max(0, $l->asignadas - $l->aprobadas),
            'cumplimiento' => $l->asignadas ? $l->aprobadas / $l->asignadas : null,
            'novedades' => trim(($l->novedades ?? 'Sin novedad').($l->observacion ? ". {$l->observacion}" : '')),
            'averias' => $l->averias,
            'devoluciones' => $l->devoluciones,
            'faltantes' => $l->faltantes,
            'pod' => match ($l->pod_cumple) {
                true => 'Sí', false => 'No', default => 'Sin auditar'
            },
            'estado' => $i->estado->label(),
            'accion' => ($l->auxiliar_id ? ($acciones[$i->id.'|'.$l->auxiliar_id] ?? collect()) : collect())
                ->map(fn (AccionDesempeno $a) => mb_strtoupper($a->tipo->label()).($a->descripcion ? ": {$a->descripcion}" : ''))
                ->implode(' / '),
        ]))->values();

        $libro = new Spreadsheet;
        $libro->getProperties()->setCreator('Justo a Tiempo SP')->setTitle('Informe diario de operaciones');

        $this->informeDiario($libro->getActiveSheet(), $filas, $desde, $hasta);
        $this->seguimiento($libro->createSheet(), $op, $desde, $hasta);
        $this->resumenPorCiudad($libro->createSheet(), $filas);
        $this->dashboard($libro->createSheet(), $filas, $desde, $hasta);
        $libro->setActiveSheetIndex(0);

        (new Xlsx($libro))->save('php://output');
        $libro->disconnectWorksheets();
    }

    /** @param Collection<int, array> $filas */
    private function informeDiario(Worksheet $hoja, Collection $filas, Carbon $desde, Carbon $hasta): void
    {
        $hoja->setTitle('Informe Diario');
        $encabezados = ['Fecha operación', 'Cliente', 'Trabajador', 'Ciudad', 'Operación / Servicio', 'Entregas asignadas', 'Entregas realizadas',
            'Entregas pendientes', 'Cumplimiento %', 'Novedades', 'Averías', 'Devoluciones', 'Faltantes', 'POD / Evidencia', 'Estado', 'Acción / Seguimiento'];
        // La hora del informe (Parámetros): "INFORME DIARIO DE OPERACIONES — 10:00 A. M."
        $hora = Carbon::createFromFormat('H:i', (string) Parametro::valor('hora_corte_informe', '10:00')) ?: Carbon::createFromTime(10);
        $this->titulo($hoja, 'INFORME DIARIO DE OPERACIONES — '.$hora->format('g:i').($hora->hour < 12 ? ' A. M.' : ' P. M.'), 'Seguimiento de la operación realizada '.$this->periodo($desde, $hasta).' — todos los clientes', count($encabezados));
        $this->encabezados($hoja, $encabezados, 4);

        $r = 5;
        foreach ($filas as $f) {
            $hoja->fromArray([
                FechaExcel::PHPToExcel($f['fecha']), $f['cliente'], $f['trabajador'], $f['ciudad'], $f['operacion'],
                $f['asignadas'], $f['realizadas'], $f['pendientes'], $f['cumplimiento'], $f['novedades'],
                $f['averias'], $f['devoluciones'], $f['faltantes'], $f['pod'], $f['estado'], $f['accion'],
            ], null, "A{$r}", true);
            // Semáforo del cumplimiento: 100 % completa, 80-99 % revisar pendientes, menos de 80 % seguimiento inmediato
            if ($f['cumplimiento'] !== null) {
                $hoja->getStyle("I{$r}")->getFont()->getColor()->setRGB($f['cumplimiento'] >= 1 ? '1E7A46' : ($f['cumplimiento'] >= 0.8 ? 'A86400' : 'B42318'));
            }
            $r++;
        }

        $ultima = max(5, $r - 1);
        $hoja->getStyle("A5:A{$ultima}")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        $hoja->getStyle("I5:I{$ultima}")->getNumberFormat()->setFormatCode('0%');
        $hoja->getStyle("J5:J{$ultima}")->getAlignment()->setWrapText(true);
        $hoja->getStyle("P5:P{$ultima}")->getAlignment()->setWrapText(true);
        $this->bordes($hoja, "A4:P{$ultima}");
        $this->anchos($hoja, [13, 22, 30, 12, 18, 11, 11, 11, 12, 48, 9, 12, 10, 12, 13, 44]);
        $hoja->freezePane('D5');
        $hoja->setAutoFilter("A4:P{$ultima}");
    }

    private function seguimiento(Worksheet $hoja, OperacionLogistica $op, Carbon $desde, Carbon $hasta): void
    {
        $hoja->setTitle('Seguimiento');
        $hoja->setCellValue('D1', 'NOTA / EVENTO / NP');
        $this->encabezados($hoja, ['FECHA', 'CLIENTE', 'AUXILIAR', 'EVENTOS', 'ESTADOS', 'NOVEDADES', 'QUÉ SE EVIDENCIA'], 2);

        $ordenes = $op->ubicacion(Orden::query())
            ->whereBetween('fecha_operacion', [$desde->toDateString(), $hasta->toDateString()])
            ->with(['sede:id,nombre', 'sucursal:id,nombre', 'auxiliar:id,name', 'auditoria.tipoNovedad:id,nombre'])
            ->orderBy('fecha_operacion')->orderBy('auxiliar_nombre')->orderBy('codigo_orden')
            ->get();

        $r = 3;
        foreach ($ordenes as $o) {
            $hoja->fromArray([
                FechaExcel::PHPToExcel($o->fecha_operacion),
                mb_strtoupper(trim($o->sede?->nombre.($o->sucursal ? ' '.$o->sucursal->nombre : ''))),
                mb_strtoupper($o->auxiliar?->name ?? $o->auxiliar_nombre ?? ''),
                $o->codigo_orden,
                mb_strtoupper($o->estado->label()),
                mb_strtoupper($o->auditoria?->tipoNovedad?->nombre ?? ($o->auditoria ? 'SIN NOVEDAD' : ($o->tiene_imagenes === false ? 'SIN EVIDENCIA' : 'SIN REVISAR'))),
                mb_strtoupper((string) ($o->auditoria?->concepto ?? ($o->tiene_imagenes === false ? 'La orden no tiene imágenes en Drivin' : ''))),
            ], null, "A{$r}", true);
            $r++;
        }

        $ultima = max(3, $r - 1);
        $hoja->getStyle("A3:A{$ultima}")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        $hoja->getStyle("G3:G{$ultima}")->getAlignment()->setWrapText(true);
        $this->bordes($hoja, "A2:G{$ultima}");
        $this->anchos($hoja, [13, 20, 32, 18, 13, 30, 56]);
        $hoja->freezePane('A3');
        $hoja->setAutoFilter("A2:G{$ultima}");
    }

    /** @param Collection<int, array> $filas */
    private function resumenPorCiudad(Worksheet $hoja, Collection $filas): void
    {
        $hoja->setTitle('Resumen por ciudad');
        $encabezados = ['Fecha operación', 'Ciudad', 'Registros / trabajadores', 'Entregas asignadas', 'Entregas realizadas', 'Pendientes', 'Registros con novedad', 'Cumplimiento promedio'];
        $this->titulo($hoja, 'RESUMEN CONSOLIDADO DE OPERACIONES POR CIUDAD', null, count($encabezados));
        $this->encabezados($hoja, $encabezados, 3);

        $r = 4;
        foreach ($filas->groupBy(fn ($f) => $f['fecha']->toDateString().'|'.$f['ciudad']) as $grupo) {
            $asignadas = $grupo->sum('asignadas');
            $hoja->fromArray([
                FechaExcel::PHPToExcel($grupo->first()['fecha']), $grupo->first()['ciudad'] ?: 'Sin ciudad', $grupo->count(),
                $asignadas, $grupo->sum('realizadas'), $grupo->sum('pendientes'),
                $grupo->filter(fn ($f) => ! str_starts_with($f['novedades'], 'Sin novedad'))->count(),
                $asignadas ? $grupo->sum('realizadas') / $asignadas : null,
            ], null, "A{$r}", true);
            $r++;
        }

        $ultima = max(4, $r - 1);
        $hoja->getStyle("A4:A{$ultima}")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        $hoja->getStyle("H4:H{$ultima}")->getNumberFormat()->setFormatCode('0%');
        $this->bordes($hoja, "A3:H{$ultima}");
        $this->anchos($hoja, [14, 16, 14, 13, 13, 12, 14, 14]);
    }

    /** @param Collection<int, array> $filas */
    private function dashboard(Worksheet $hoja, Collection $filas, Carbon $desde, Carbon $hasta): void
    {
        $hoja->setTitle('Dashboard Gerencial');
        $this->titulo($hoja, 'DASHBOARD GERENCIAL — OPERACIÓN '.mb_strtoupper($this->periodo($desde, $hasta)), null, 5);

        $asignadas = $filas->sum('asignadas');
        $realizadas = $filas->sum('realizadas');
        $datos = [
            ['Trabajadores / registros', $filas->count()],
            ['Entregas asignadas', $asignadas],
            ['Entregas realizadas', $realizadas],
            ['Entregas pendientes', $filas->sum('pendientes')],
            ['Cumplimiento general', $asignadas ? $realizadas / $asignadas : null],
            ['Registros con novedad', $filas->filter(fn ($f) => ! str_starts_with($f['novedades'], 'Sin novedad'))->count()],
            ['Averías', $filas->sum('averias')],
            ['Devoluciones', $filas->sum('devoluciones')],
            ['Faltantes', $filas->sum('faltantes')],
        ];
        $hoja->fromArray($datos, null, 'A4', true);
        $hoja->getStyle('B8')->getNumberFormat()->setFormatCode('0%');
        $hoja->getStyle('A4:A12')->getFont()->setBold(true);
        $this->bordes($hoja, 'A4:B12');

        $hoja->setCellValue('D4', 'Semáforo');
        $hoja->fromArray([['100 %', 'Operación completa'], ['80 – 99 %', 'Revisar pendientes'], ['< 80 %', 'Seguimiento inmediato']], null, 'D5', true);
        foreach (['D5' => '1E7A46', 'D6' => 'A86400', 'D7' => 'B42318'] as $celda => $color) {
            $hoja->getStyle($celda)->getFont()->setBold(true)->getColor()->setRGB($color);
        }
        $hoja->getStyle('D4')->getFont()->setBold(true);
        $this->anchos($hoja, [26, 14, 4, 12, 24]);
    }

    private function titulo(Worksheet $hoja, string $titulo, ?string $subtitulo, int $columnas): void
    {
        $ultima = Coordinate::stringFromColumnIndex($columnas);
        $hoja->setCellValue('A1', $titulo)->mergeCells("A1:{$ultima}1");
        $hoja->getStyle('A1')->getFont()->setBold(true)->setSize(14)->getColor()->setRGB(self::AZUL);
        if ($subtitulo) {
            $hoja->setCellValue('A2', $subtitulo)->mergeCells("A2:{$ultima}2");
            $hoja->getStyle('A2')->getFont()->setItalic(true)->getColor()->setRGB('555555');
        }
    }

    /** @param list<string> $encabezados */
    private function encabezados(Worksheet $hoja, array $encabezados, int $fila): void
    {
        $hoja->fromArray($encabezados, null, "A{$fila}");
        $rango = 'A'.$fila.':'.Coordinate::stringFromColumnIndex(count($encabezados)).$fila;
        $estilo = $hoja->getStyle($rango);
        $estilo->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $estilo->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(self::AZUL);
        $estilo->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_CENTER)->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $hoja->getStyle('A'.$fila)->getBorders()->getLeft()->setBorderStyle(Border::BORDER_THICK)->getColor()->setRGB(self::CORAL);
        $hoja->getRowDimension($fila)->setRowHeight(32);
    }

    private function bordes(Worksheet $hoja, string $rango): void
    {
        $hoja->getStyle($rango)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D0D5DD');
        $hoja->getStyle($rango)->getAlignment()->setVertical(Alignment::VERTICAL_TOP);
    }

    /** @param list<int> $anchos */
    private function anchos(Worksheet $hoja, array $anchos): void
    {
        foreach ($anchos as $i => $ancho) {
            $hoja->getColumnDimension(Coordinate::stringFromColumnIndex($i + 1))->setWidth($ancho);
        }
    }

    private function periodo(Carbon $desde, Carbon $hasta): string
    {
        $formato = fn (Carbon $f) => $f->locale('es')->isoFormat('D [de] MMMM [de] YYYY');

        return $desde->isSameDay($hasta) ? 'el '.$formato($desde) : 'del '.$formato($desde).' al '.$formato($hasta);
    }
}
