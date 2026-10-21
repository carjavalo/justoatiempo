<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** El formato de las hojas de los informes en Excel: título, encabezados en azul con el borde coral, bordes y anchos. */
trait FormatoExcel
{
    private const AZUL = '1F3A68';

    private const CORAL = 'E8705F';

    protected function titulo(Worksheet $hoja, string $titulo, ?string $subtitulo, int $columnas): void
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
    protected function encabezados(Worksheet $hoja, array $encabezados, int $fila): void
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

    protected function bordes(Worksheet $hoja, string $rango): void
    {
        $hoja->getStyle($rango)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D0D5DD');
        $hoja->getStyle($rango)->getAlignment()->setVertical(Alignment::VERTICAL_TOP);
    }

    /** @param list<int> $anchos */
    protected function anchos(Worksheet $hoja, array $anchos): void
    {
        foreach ($anchos as $i => $ancho) {
            $hoja->getColumnDimension(Coordinate::stringFromColumnIndex($i + 1))->setWidth($ancho);
        }
    }

    protected function periodo(Carbon $desde, Carbon $hasta): string
    {
        $formato = fn (Carbon $f) => $f->locale('es')->isoFormat('D [de] MMMM [de] YYYY');

        return $desde->isSameDay($hasta) ? 'el '.$formato($desde) : 'del '.$formato($desde).' al '.$formato($hasta);
    }
}
