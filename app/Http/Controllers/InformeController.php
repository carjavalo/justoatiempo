<?php

namespace App\Http\Controllers;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Bitacora;
use App\Models\InformeDiario;
use App\Models\InformeLinea;
use App\Models\Parametro;
use App\Services\ExportadorInforme;
use App\Support\OperacionLogistica;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Informe diario de la operación logística (el Excel "INFORME DIARIO DE OPERACIONES"): por cada sede y sucursal,
 * una fila por auxiliar, ruta y placa con sus entregas asignadas, realizadas y pendientes, el cumplimiento, las
 * novedades, averías, devoluciones, faltantes, si hay evidencias y la acción de seguimiento.
 */
class InformeController extends Controller
{
    public function index(Request $request): Response
    {
        $op = OperacionLogistica::para($request->user(), $request->integer('sede') ?: null);

        // Las jornadas con informe, de la más reciente a la más antigua (para moverse entre ellas)
        $jornadas = $op->ubicacion(InformeDiario::query())
            ->selectRaw('distinct date(fecha_operacion) as fecha')
            ->orderByDesc('fecha')
            ->limit(400)
            ->pluck('fecha')
            ->map(fn ($f) => Carbon::parse($f)->toDateString())
            ->values();
        $pedida = $request->date('fecha')?->toDateString();
        $fecha = $pedida ?? $jornadas->first();

        $informes = $fecha ? $op->ubicacion(InformeDiario::query())
            ->whereDate('fecha_operacion', $fecha)
            ->with(['sede:id,nombre,color,meta_efectividad,empresa_id', 'sede.empresa:id,nombre', 'sucursal:id,nombre,ciudad', 'cerradoPor:id,name',
                'lineas' => fn ($q) => $q->orderBy('auxiliar_nombre'), 'lineas.auxiliar:id,name,cedula'])
            ->withCount(['ordenes as sin_auditar' => fn ($q) => $q->where('estado', EstadoOrden::Aprobada)->whereDoesntHave('auditoria')])
            ->get()
            ->sortBy(fn (InformeDiario $i) => [$i->sede?->nombre, $i->sucursal?->nombre])
            ->values() : collect();

        $acciones = AccionDesempeno::whereIn('informe_id', $informes->pluck('id'))
            ->with('registradoPor:id,name')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (AccionDesempeno $a) => $a->informe_id.'|'.$a->user_id);

        $umbrales = ['felicitacion' => (float) Parametro::valor('umbral_felicitacion', 100), 'llamado' => (float) Parametro::valor('umbral_llamado_atencion', 70)];
        $filas = $informes->map(fn (InformeDiario $i) => $this->informe($i, $acciones, $umbrales));

        return Inertia::render('informes/index', [
            'fecha' => $fecha,
            // La anterior y la siguiente jornada con informe
            'anterior' => $fecha ? $jornadas->first(fn ($f) => $f < $fecha) : null,
            'siguiente' => $fecha ? $jornadas->reverse()->first(fn ($f) => $f > $fecha) : null,
            'sede' => $op->sedeId,
            'sedes' => $op->opcionesSede()->map(fn ($s) => ['id' => $s->id, 'nombre' => $s->nombre, 'empresa' => $s->empresa?->nombre]),
            'informes' => $filas,
            'resumen' => $this->resumen($filas),
            'porCiudad' => $this->porCiudad($filas),
            'tiposAccion' => TipoAccion::opciones(),
            'umbrales' => $umbrales,
        ]);
    }

    /** Una observación escrita a mano en una fila (se conserva al recalcular el informe). */
    public function observacion(Request $request, InformeLinea $linea): RedirectResponse
    {
        $informe = $linea->informe;
        $this->autorizarCambio($request, $informe);
        $datos = $request->validate(['observacion' => ['nullable', 'string', 'max:500']]);

        $linea->update(['observacion' => trim((string) $datos['observacion']) ?: null]);

        return back()->with('success', 'Observación guardada.');
    }

    /** Las observaciones generales del informe de una sede y sucursal. */
    public function observaciones(Request $request, InformeDiario $informe): RedirectResponse
    {
        $this->autorizarCambio($request, $informe);
        $datos = $request->validate(['observaciones' => ['nullable', 'string', 'max:1000']]);

        $informe->update(['observaciones' => trim((string) $datos['observaciones']) ?: null]);

        return back()->with('success', 'Observaciones guardadas.');
    }

    /** Pasar a seguimiento (mientras se aclaran novedades), cerrar o reabrir. */
    public function estado(Request $request, InformeDiario $informe): RedirectResponse
    {
        $this->enAlcance($request, $informe);
        $estado = EstadoInforme::from($request->validate([
            'estado' => ['required', Rule::in([EstadoInforme::Seguimiento->value, EstadoInforme::Cerrado->value])],
        ])['estado']);

        $nombre = $informe->sede?->nombre.($informe->sucursal ? " · {$informe->sucursal->nombre}" : '');
        if ($estado === EstadoInforme::Cerrado) {
            $informe->update(['estado' => $estado, 'cerrado_por' => $request->user()->id, 'cerrado_en' => now()]);
            Bitacora::registrar('informe_estado', $informe, ['estado' => $estado->value]);

            return back()->with('success', "Informe de {$nombre} cerrado: ya no admite nuevas órdenes ni cambios.");
        }

        $reabierto = $informe->estaCerrado();
        $informe->update(['estado' => $estado, 'cerrado_por' => null, 'cerrado_en' => null]);
        Bitacora::registrar('informe_estado', $informe, ['estado' => $estado->value, 'reabierto' => $reabierto]);

        return back()->with('success', $reabierto
            ? "Informe de {$nombre} reabierto: queda en seguimiento."
            : "Informe de {$nombre} en seguimiento mientras se aclaran sus novedades.");
    }

    /** El informe en Excel, con las hojas del formato de la operación, para una jornada o un periodo. */
    public function descargar(Request $request, ExportadorInforme $exportador): StreamedResponse
    {
        $datos = $request->validate([
            'desde' => ['required', 'date'],
            'hasta' => ['required', 'date', 'after_or_equal:desde'],
        ], ['hasta.after_or_equal' => 'La fecha final no puede ser antes de la inicial.']);
        $desde = Carbon::parse($datos['desde']);
        $hasta = Carbon::parse($datos['hasta']);
        if ($desde->diffInDays($hasta) > 92) {
            throw ValidationException::withMessages(['hasta' => 'El periodo puede ser de hasta tres meses.']);
        }
        $op = OperacionLogistica::para($request->user(), $request->integer('sede') ?: null);
        $nombre = 'Informe diario de operaciones '.($desde->isSameDay($hasta) ? $desde->toDateString() : $desde->toDateString().' a '.$hasta->toDateString()).'.xlsx';

        return response()->streamDownload(fn () => $exportador->escribir($op, $desde, $hasta), $nombre, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function enAlcance(Request $request, InformeDiario $informe): void
    {
        $op = OperacionLogistica::para($request->user());
        abort_unless($op->ubicacion(InformeDiario::whereKey($informe->id))->exists(), 404);
    }

    private function autorizarCambio(Request $request, InformeDiario $informe): void
    {
        $this->enAlcance($request, $informe);
        abort_if($informe->estaCerrado(), 409, 'El informe está cerrado: reábrelo para hacer cambios.');
    }

    /**
     * @param  Collection<string, Collection<int, AccionDesempeno>>  $acciones  por "informe|persona"
     * @param  array{felicitacion: float, llamado: float}  $umbrales
     */
    private function informe(InformeDiario $i, Collection $acciones, array $umbrales): array
    {
        return [
            'id' => $i->id,
            'empresa' => $i->sede?->empresa?->nombre,
            'sede' => $i->sede?->nombre,
            'sucursal' => $i->sucursal?->nombre,
            'ciudad' => $i->sucursal?->ciudad,
            'color' => $i->sede?->color,
            'meta' => (float) ($i->sede?->meta_efectividad ?? 95),
            'estado' => $i->estado->value,
            'estadoLabel' => $i->estado->label(),
            'cerradoPor' => $i->cerradoPor?->name,
            'cerradoEn' => $i->cerrado_en?->toIso8601String(),
            'observaciones' => $i->observaciones,
            'sinAuditar' => (int) $i->sin_auditar,
            'lineas' => $i->lineas->map(function (InformeLinea $l) use ($i, $acciones, $umbrales) {
                $cumplimiento = (float) $l->efectividad;
                $suyas = $l->auxiliar_id ? ($acciones[$i->id.'|'.$l->auxiliar_id] ?? collect()) : collect();

                return [
                    'id' => $l->id,
                    'auxiliar' => $l->auxiliar?->name ?? $l->auxiliar_nombre ?? 'Sin auxiliar',
                    'auxiliarId' => $l->auxiliar_id,
                    'cedula' => $l->auxiliar?->cedula,
                    'ruta' => $l->ruta,
                    'placa' => $l->placa,
                    'asignadas' => $l->asignadas,
                    'realizadas' => $l->aprobadas,
                    'pendientes' => max(0, $l->asignadas - $l->aprobadas),
                    'cumplimiento' => $cumplimiento,
                    'ordenes' => $l->ordenes,
                    'novedades' => $l->novedades ?? 'Sin novedad',
                    'observacion' => $l->observacion,
                    'averias' => $l->averias,
                    'devoluciones' => $l->devoluciones,
                    'faltantes' => $l->faltantes,
                    'sinEvidencia' => $l->ordenes_sin_evidencia,
                    'pod' => $l->pod_cumple,
                    'acciones' => $suyas->map(fn (AccionDesempeno $a) => [
                        'id' => $a->id,
                        'tipo' => $a->tipo->value,
                        'tipoLabel' => $a->tipo->label(),
                        'descripcion' => $a->descripcion,
                        'registradaPor' => $a->registradoPor?->name,
                    ])->values(),
                    // Lo que sugieren los umbrales de Parámetros (la persona decide): felicitación desde el umbral y
                    // sin novedades, llamado de atención por debajo del suyo y, entre ambos o con novedades, retroalimentación
                    'sugerencia' => match (true) {
                        ! $l->auxiliar_id => null,
                        $cumplimiento < $umbrales['llamado'] => TipoAccion::LlamadoAtencion->value,
                        $cumplimiento >= $umbrales['felicitacion'] && $l->pod_cumple !== false && ($l->novedades ?? 'Sin novedad') === 'Sin novedad' => TipoAccion::Felicitacion->value,
                        default => TipoAccion::Retroalimentacion->value,
                    },
                ];
            })->values(),
        ];
    }

    /**
     * Lo del día, como la hoja "Dashboard Gerencial": registros, entregas, cumplimiento y novedades.
     *
     * @param  Collection<int, array>  $informes
     */
    private function resumen(Collection $informes): array
    {
        $lineas = $informes->flatMap(fn ($i) => $i['lineas']);
        $asignadas = $lineas->sum('asignadas');
        $realizadas = $lineas->sum('realizadas');

        return [
            'registros' => $lineas->count(),
            'asignadas' => $asignadas,
            'realizadas' => $realizadas,
            'pendientes' => $lineas->sum('pendientes'),
            'cumplimiento' => $asignadas ? round($realizadas / $asignadas * 100, 2) : null,
            'conNovedad' => $lineas->filter(fn ($l) => $l['novedades'] !== 'Sin novedad' || $l['observacion'])->count(),
            'averias' => $lineas->sum('averias'),
            'devoluciones' => $lineas->sum('devoluciones'),
            'faltantes' => $lineas->sum('faltantes'),
            'sinEvidencia' => $lineas->sum('sinEvidencia'),
            'abiertos' => $informes->where('estado', '!=', EstadoInforme::Cerrado->value)->count(),
        ];
    }

    /**
     * La hoja "Resumen por ciudad".
     *
     * @param  Collection<int, array>  $informes
     */
    private function porCiudad(Collection $informes): array
    {
        return $informes
            ->flatMap(fn ($i) => collect($i['lineas'])->map(fn ($l) => [...$l, 'ciudad' => $i['ciudad'] ?? 'Sin ciudad']))
            ->groupBy('ciudad')
            ->map(fn (Collection $g, string $ciudad) => [
                'ciudad' => $ciudad,
                'registros' => $g->count(),
                'asignadas' => $g->sum('asignadas'),
                'realizadas' => $g->sum('realizadas'),
                'pendientes' => $g->sum('pendientes'),
                'conNovedad' => $g->filter(fn ($l) => $l['novedades'] !== 'Sin novedad' || $l['observacion'])->count(),
                'cumplimiento' => $g->sum('asignadas') ? round($g->sum('realizadas') / $g->sum('asignadas') * 100, 2) : null,
            ])
            ->sortBy('ciudad')
            ->values()
            ->all();
    }
}
