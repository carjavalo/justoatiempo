<?php

namespace App\Http\Controllers;

use App\Models\AccionDesempeno;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Services\InformeLinea\ExportadorInformeLinea;
use App\Services\InformeLinea\JornadaLinea;
use App\Support\OperacionLinea;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Informe diario de una línea sin Drivin: por cada lugar programado, su personal, la asistencia, la cobertura y las
 * novedades del día. Se descarga en Excel con el formato del informe de logística.
 */
class InformeLineaController extends Controller
{
    public function index(Request $request, LineaServicio $linea, JornadaLinea $jornada): Response|RedirectResponse
    {
        // Logística tiene su informe (el de Drivin)
        if ($linea->esLogistica()) {
            return redirect()->route('informes.index');
        }
        $op = OperacionLinea::para($request->user(), $linea, 'informes.ver');
        $pedida = $request->validate(['fecha' => ['nullable', 'date_format:Y-m-d']])['fecha'] ?? null;

        // Sin fecha: la última jornada con programación o novedades (hasta hoy)
        $fechas = fn () => $op->filtrar(Programacion::query(), 'programaciones')->where('linea_servicio_id', $linea->id)->select('fecha')
            ->union($op->filtrar(NovedadLinea::query(), 'novedades_linea')->where('linea_servicio_id', $linea->id)->select('fecha'));
        $fecha = Carbon::parse($pedida ?? (DB::query()->fromSub($fechas(), 'f')->where('fecha', '<=', today()->toDateString())->max('fecha') ?? today()));
        $anterior = DB::query()->fromSub($fechas(), 'f')->where('fecha', '<', $fecha->toDateString())->max('fecha');
        $siguiente = DB::query()->fromSub($fechas(), 'f')->where('fecha', '>', $fecha->toDateString())->min('fecha');

        $lugares = $jornada->lugares($op, $fecha, $fecha);
        $acciones = AccionDesempeno::where('linea_servicio_id', $linea->id)->whereDate('fecha', $fecha)
            ->whereIn('user_id', $lugares->flatMap(fn ($l) => $l['personas']->pluck('user_id')))
            ->get()->groupBy('user_id');

        return Inertia::render('lineas/informe', [
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre, 'icono' => $linea->icono],
            'fecha' => $fecha->toDateString(),
            'anterior' => $anterior ? Carbon::parse($anterior)->toDateString() : null,
            'siguiente' => $siguiente ? Carbon::parse($siguiente)->toDateString() : null,
            'resumen' => [
                'lugares' => $lugares->whereNotNull('programacion')->count(),
                'requeridas' => $lugares->sum('requeridas'),
                'programadas' => $lugares->sum('programadas'),
                'presentes' => $lugares->sum('presentes'),
                'tarde' => $lugares->sum('tarde'),
                'faltas' => $lugares->sum('faltas'),
                'justificadas' => $lugares->sum('justificadas'),
                'sinRegistrar' => $lugares->sum('sinRegistrar'),
                'novedades' => $lugares->sum(fn ($l) => $l['novedades']->count()),
                'cobertura' => JornadaLinea::cobertura($lugares),
            ],
            'lugares' => $lugares->map(fn ($l) => [
                'lugar' => $l['lugar'],
                'programado' => $l['programacion'] !== null,
                'requeridas' => $l['requeridas'],
                'programadas' => $l['programadas'],
                'presentes' => $l['presentes'],
                'faltas' => $l['faltas'],
                'sinRegistrar' => $l['sinRegistrar'],
                'cobertura' => $l['cobertura'],
                'observaciones' => $l['programacion']?->observaciones,
                'personas' => $l['personas']->map(fn (ProgramacionAsignacion $a) => [
                    'id' => $a->id,
                    'nombre' => $a->persona?->name ?? 'Persona eliminada',
                    'cargo' => $a->persona?->cargo,
                    'turno' => $a->hora_entrada ? substr($a->hora_entrada, 0, 5).($a->hora_salida ? ' a '.substr($a->hora_salida, 0, 5) : '') : null,
                    'asistencia' => $a->asistencia?->value,
                    'asistenciaTexto' => $a->asistencia?->label(),
                    'llegada' => $a->hora_llegada ? substr($a->hora_llegada, 0, 5) : null,
                    'observacion' => $a->observacion,
                    'novedades' => $l['novedades']->where('user_id', $a->user_id)->map(fn (NovedadLinea $n) => "{$n->tipo}: {$n->descripcion}")->values(),
                    'acciones' => ($acciones[$a->user_id] ?? collect())->map(fn (AccionDesempeno $x) => $x->tipo->label())->values(),
                ])->values(),
                // Las novedades del lugar que no son de una persona programada
                'novedades' => $l['novedades']->reject(fn (NovedadLinea $n) => $n->user_id && $l['personas']->contains('user_id', $n->user_id))
                    ->map(fn (NovedadLinea $n) => ['id' => $n->id, 'tipo' => $n->tipo, 'gravedad' => $n->gravedad, 'descripcion' => $n->descripcion, 'persona' => $n->persona?->name, 'estado' => NovedadLinea::ESTADOS[$n->estado] ?? $n->estado])
                    ->values(),
            ])->values(),
        ]);
    }

    public function descargar(Request $request, LineaServicio $linea, ExportadorInformeLinea $exportador): StreamedResponse
    {
        abort_if($linea->esLogistica(), 404);
        $op = OperacionLinea::para($request->user(), $linea, 'informes.descargar');
        $datos = $request->validate([
            'desde' => ['required', 'date'],
            'hasta' => ['required', 'date', 'after_or_equal:desde'],
        ], ['hasta.after_or_equal' => 'La fecha final no puede ser antes de la inicial.']);
        $desde = Carbon::parse($datos['desde']);
        $hasta = Carbon::parse($datos['hasta']);
        if ($desde->diffInDays($hasta) > 92) {
            throw ValidationException::withMessages(['hasta' => 'El periodo puede ser de hasta tres meses.']);
        }
        $nombre = "Informe diario {$linea->nombre} ".($desde->isSameDay($hasta) ? $desde->toDateString() : $desde->toDateString().' a '.$hasta->toDateString()).'.xlsx';

        return response()->streamDownload(fn () => $exportador->escribir($op, $desde, $hasta), $nombre, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
