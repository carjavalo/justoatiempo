<?php

namespace App\Services\InformeLinea;

use App\Models\NovedadLinea;
use App\Models\ProgramacionAsignacion;
use App\Services\FormatoExcel;
use App\Support\OperacionLinea;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Shared\Date as FechaExcel;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * El informe diario de una línea en Excel, con el mismo formato que el de logística: Informe diario (una fila por
 * persona programada, con su asistencia y sus novedades), Novedades (con su seguimiento) y Resumen por lugar.
 */
class ExportadorInformeLinea
{
    use FormatoExcel;

    public function __construct(private readonly JornadaLinea $jornada) {}

    public function escribir(OperacionLinea $op, Carbon $desde, Carbon $hasta): void
    {
        $lugares = $this->jornada->lugares($op, $desde, $hasta);
        $novedades = $this->jornada->novedades($op, $desde, $hasta);

        $libro = new Spreadsheet;
        $libro->getProperties()->setCreator('Justo a Tiempo SP')->setTitle("Informe diario · {$op->linea->nombre}");

        $this->informeDiario($libro->getActiveSheet(), $op, $lugares, $desde, $hasta);
        $this->novedades($libro->createSheet(), $novedades, $desde, $hasta);
        $this->resumen($libro->createSheet(), $lugares);
        $libro->setActiveSheetIndex(0);

        (new Xlsx($libro))->save('php://output');
        $libro->disconnectWorksheets();
    }

    private function informeDiario(Worksheet $hoja, OperacionLinea $op, Collection $lugares, Carbon $desde, Carbon $hasta): void
    {
        $hoja->setTitle('Informe Diario');
        $encabezados = ['Fecha', 'Lugar', 'Trabajador', 'Cédula', 'Cargo', 'Turno', 'Asistencia', 'Hora de llegada', 'Observación', 'Novedades del día'];
        $this->titulo($hoja, 'INFORME DIARIO · '.mb_strtoupper($op->linea->nombre), 'Personal programado y su asistencia '.$this->periodo($desde, $hasta), count($encabezados));
        $this->encabezados($hoja, $encabezados, 4);

        $fila = 5;
        foreach ($lugares as $l) {
            $porPersona = $l['novedades']->groupBy('user_id');
            foreach ($l['personas'] as $a) {
                /** @var ProgramacionAsignacion $a */
                $hoja->fromArray([
                    FechaExcel::PHPToExcel(Carbon::parse($l['fecha'])),
                    $l['lugar'],
                    $a->persona?->name ?? 'Persona eliminada',
                    $a->persona?->cedula,
                    $a->persona?->cargo,
                    trim(substr((string) $a->hora_entrada, 0, 5).($a->hora_salida ? ' a '.substr($a->hora_salida, 0, 5) : '')),
                    $a->asistencia?->label() ?? 'Sin registrar',
                    $a->hora_llegada ? substr($a->hora_llegada, 0, 5) : '',
                    $a->observacion,
                    ($porPersona[$a->user_id] ?? collect())->map(fn (NovedadLinea $n) => "{$n->tipo}: {$n->descripcion}")->implode(' / ') ?: 'Sin novedad',
                ], null, "A{$fila}", true);
                $fila++;
            }
        }

        if ($fila > 5) {
            $hoja->getStyle('A5:A'.($fila - 1))->getNumberFormat()->setFormatCode('dd/mm/yyyy');
            $this->bordes($hoja, 'A4:J'.($fila - 1));
            $hoja->getStyle('I5:J'.($fila - 1))->getAlignment()->setWrapText(true);
        }
        $hoja->freezePane('A5');
        $hoja->setAutoFilter('A4:J'.max(4, $fila - 1));
        $this->anchos($hoja, [12, 34, 30, 14, 20, 14, 16, 12, 30, 50]);
    }

    /** @param Collection<int, NovedadLinea> $novedades */
    private function novedades(Worksheet $hoja, Collection $novedades, Carbon $desde, Carbon $hasta): void
    {
        $hoja->setTitle('Novedades');
        $encabezados = ['Fecha', 'Lugar', 'Persona', 'Tipo', 'Gravedad', 'Qué pasó', 'Estado', 'Seguimiento', 'Registrada por'];
        $this->titulo($hoja, 'NOVEDADES Y SEGUIMIENTO', 'Novedades registradas '.$this->periodo($desde, $hasta), count($encabezados));
        $this->encabezados($hoja, $encabezados, 4);

        $fila = 5;
        foreach ($novedades as $n) {
            $hoja->fromArray([
                FechaExcel::PHPToExcel($n->fecha),
                $n->lugar(),
                $n->persona?->name ?? '—',
                $n->tipo,
                NovedadLinea::GRAVEDADES[$n->gravedad] ?? $n->gravedad,
                $n->descripcion,
                NovedadLinea::ESTADOS[$n->estado] ?? $n->estado,
                $n->seguimiento,
                $n->registradaPor?->name,
            ], null, "A{$fila}", true);
            $fila++;
        }

        if ($fila > 5) {
            $hoja->getStyle('A5:A'.($fila - 1))->getNumberFormat()->setFormatCode('dd/mm/yyyy');
            $this->bordes($hoja, 'A4:I'.($fila - 1));
            $hoja->getStyle('F5:H'.($fila - 1))->getAlignment()->setWrapText(true);
        }
        $hoja->freezePane('A5');
        $this->anchos($hoja, [12, 34, 28, 24, 12, 50, 16, 40, 24]);
    }

    private function resumen(Worksheet $hoja, Collection $lugares): void
    {
        $hoja->setTitle('Resumen por lugar');
        $encabezados = ['Lugar', 'Jornadas', 'Requeridas', 'Programadas', 'Asistieron', 'Llegaron tarde', 'No asistieron', 'Justificadas', 'Novedades', 'Cobertura'];
        $this->titulo($hoja, 'RESUMEN POR LUGAR', 'Cobertura: personas que asistieron frente a las requeridas (o a las programadas si no se dijo cuántas)', count($encabezados));
        $this->encabezados($hoja, $encabezados, 4);

        $fila = 5;
        foreach ($lugares->groupBy('lugar')->sortKeys() as $lugar => $grupo) {
            $cobertura = JornadaLinea::cobertura($grupo);
            $hoja->fromArray([
                $lugar,
                $grupo->whereNotNull('programacion')->count(),
                $grupo->sum('requeridas'),
                $grupo->sum('programadas'),
                $grupo->sum('presentes'),
                $grupo->sum('tarde'),
                $grupo->sum('faltas'),
                $grupo->sum('justificadas'),
                $grupo->sum(fn ($l) => $l['novedades']->count()),
                $cobertura === null ? null : $cobertura / 100,
            ], null, "A{$fila}", true);
            $fila++;
        }

        if ($fila > 5) {
            $hoja->getStyle('J5:J'.($fila - 1))->getNumberFormat()->setFormatCode('0.0%');
            $this->bordes($hoja, 'A4:J'.($fila - 1));
        }
        $this->anchos($hoja, [40, 10, 12, 12, 12, 12, 12, 12, 12, 12]);
    }
}
