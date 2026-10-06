<?php

namespace App\Http\Controllers;

use App\Enums\EstadoInforme;
use App\Enums\Rol;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Carga;
use App\Models\Cliente;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Parametro;
use App\Services\ConsolidadorInforme;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Panel directivo (SRS 4.1): efectividad global, motivos de rechazo y ranking por auxiliar y cliente. */
class DashboardController extends Controller
{
    private const PERIODOS = [7, 30, 90];

    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $esAuxiliar = $user->rol === Rol::Auxiliar;
        $empleadoId = $esAuxiliar ? ($user->empleado_id ?? 0) : null;

        // El periodo termina en la última jornada con datos (la carga es a día vencido)
        $ultimaOperacion = Orden::max('fecha_operacion');
        $hasta = $request->date('hasta') ?? ($ultimaOperacion ? Carbon::parse($ultimaOperacion) : today());
        $periodo = in_array($request->integer('periodo'), self::PERIODOS, true) ? $request->integer('periodo') : 30;
        $desde = $request->date('desde') ?? $hasta->copy()->subDays($periodo - 1);
        $clienteId = $request->integer('cliente') ?: null;

        $base = fn (Carbon $d, Carbon $h) => Orden::query()
            ->whereBetween('fecha_operacion', [$d->toDateString(), $h->toDateString()])
            ->when($clienteId, fn (Builder $q) => $q->where('cliente_id', $clienteId))
            ->when($empleadoId !== null, fn (Builder $q) => $q->where('empleado_id', $empleadoId));

        $dias = $desde->diffInDays($hasta) + 1;
        $prevHasta = $desde->copy()->subDay();
        $prevDesde = $prevHasta->copy()->subDays($dias - 1);

        $kpis = $this->kpis($base($desde, $hasta));
        $kpisPrevios = $this->kpis($base($prevDesde, $prevHasta));

        return Inertia::render('dashboard', [
            'filtros' => [
                'desde' => $desde->toDateString(),
                'hasta' => $hasta->toDateString(),
                'periodo' => $request->filled('desde') ? null : $periodo,
                'cliente' => $clienteId,
            ],
            'vista' => $esAuxiliar ? 'auxiliar' : 'gerencial',
            'clientes' => Cliente::orderBy('nombre')->get(['id', 'nombre', 'color']),
            'ultimaOperacion' => $ultimaOperacion,
            'meta' => (float) ($clienteId
                ? Cliente::find($clienteId)?->meta_efectividad
                : Parametro::valor('meta_efectividad_global', 95)),
            'kpis' => $kpis,
            'kpisPrevios' => $kpisPrevios,
            'tendencia' => $this->tendencia($base($desde, $hasta)),
            'motivos' => $this->motivos($base($desde, $hasta)),
            'porCliente' => $esAuxiliar ? [] : $this->porCliente($base($desde, $hasta)),
            'ranking' => $this->ranking($base($desde, $hasta), $desde, $hasta),
            'protocolo' => $this->protocolo($base($desde, $hasta)),
            'pendientes' => $esAuxiliar ? null : $this->pendientes(),
            'acciones' => $this->accionesRecientes($empleadoId),
        ]);
    }

    private function kpis(Builder $q): array
    {
        $r = $q->clone()
            ->leftJoin('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->selectRaw("
                COUNT(*) as asignadas,
                SUM(ordenes.estado = 'aprobada') as aprobadas,
                SUM(ordenes.estado <> 'aprobada') as rechazadas,
                SUM(ordenes.devolucion) as devoluciones,
                SUM(ordenes.averia) as averias,
                SUM(ordenes.faltante) as faltantes,
                COUNT(a.id) as auditadas,
                SUM(a.cumple_protocolo) as cumplen,
                SUM(a.sin_evidencia) as sin_evidencia,
                SUM(ordenes.estado = 'aprobada' AND a.id IS NULL) as sin_auditar,
                COUNT(DISTINCT ordenes.empleado_id) as auxiliares,
                COUNT(DISTINCT ordenes.fecha_operacion) as jornadas
            ")
            ->first();

        $asignadas = (int) $r->asignadas;
        $aprobadas = (int) $r->aprobadas;
        $auditadas = (int) $r->auditadas;

        return [
            'asignadas' => $asignadas,
            'aprobadas' => $aprobadas,
            'rechazadas' => (int) $r->rechazadas,
            'efectividad' => ConsolidadorInforme::efectividad($aprobadas, $asignadas),
            'devoluciones' => (int) $r->devoluciones,
            'averias' => (int) $r->averias,
            'faltantes' => (int) $r->faltantes,
            'auditadas' => $auditadas,
            'cumplimientoPod' => $auditadas ? round($r->cumplen / $auditadas * 100, 1) : null,
            'sinEvidencia' => (int) $r->sin_evidencia,
            'sinAuditar' => (int) $r->sin_auditar,
            'auxiliares' => (int) $r->auxiliares,
            'jornadas' => (int) $r->jornadas,
        ];
    }

    private function tendencia(Builder $q): array
    {
        return $q->clone()
            ->selectRaw("fecha_operacion as fecha, COUNT(*) as asignadas, SUM(estado = 'aprobada') as aprobadas")
            ->groupBy('fecha_operacion')
            ->orderBy('fecha_operacion')
            ->get()
            ->map(fn ($r) => [
                'fecha' => Carbon::parse($r->fecha)->toDateString(),
                'asignadas' => (int) $r->asignadas,
                'aprobadas' => (int) $r->aprobadas,
                'rechazadas' => (int) $r->asignadas - (int) $r->aprobadas,
                'efectividad' => ConsolidadorInforme::efectividad((int) $r->aprobadas, (int) $r->asignadas),
            ])
            ->all();
    }

    private function motivos(Builder $q): array
    {
        return $q->clone()
            ->where('estado', '<>', 'aprobada')
            ->selectRaw("COALESCE(motivo_texto, 'Sin motivo registrado') as motivo, COUNT(*) as total")
            ->groupBy('motivo')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['motivo' => $r->motivo, 'total' => (int) $r->total])
            ->all();
    }

    private function porCliente(Builder $q): array
    {
        return $q->clone()
            ->join('clientes as c', 'c.id', '=', 'ordenes.cliente_id')
            ->selectRaw("c.id, c.nombre, c.color, c.meta_efectividad as meta, COUNT(*) as asignadas, SUM(ordenes.estado = 'aprobada') as aprobadas")
            ->groupBy('c.id', 'c.nombre', 'c.color', 'c.meta_efectividad')
            ->orderByDesc('asignadas')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'nombre' => $r->nombre,
                'color' => $r->color,
                'meta' => (float) $r->meta,
                'asignadas' => (int) $r->asignadas,
                'aprobadas' => (int) $r->aprobadas,
                'efectividad' => ConsolidadorInforme::efectividad((int) $r->aprobadas, (int) $r->asignadas),
            ])
            ->all();
    }

    private function ranking(Builder $q, Carbon $desde, Carbon $hasta): array
    {
        $filas = $q->clone()
            ->join('empleados as e', 'e.id', '=', 'ordenes.empleado_id')
            ->leftJoin('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->selectRaw("
                e.id, e.nombres, e.apellidos, e.cedula,
                COUNT(*) as asignadas,
                SUM(ordenes.estado = 'aprobada') as aprobadas,
                COUNT(a.id) as auditadas,
                SUM(a.cumple_protocolo) as cumplen,
                SUM(a.sin_evidencia) as sin_evidencia,
                COUNT(DISTINCT ordenes.fecha_operacion) as jornadas
            ")
            ->groupBy('e.id', 'e.nombres', 'e.apellidos', 'e.cedula')
            ->get();

        // toBase(): sin el cast a enum, "tipo" llega como texto y sirve de clave
        $acciones = AccionDesempeno::query()
            ->toBase()
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->copy()->addDay()->toDateString()])
            ->whereIn('empleado_id', $filas->pluck('id'))
            ->selectRaw('empleado_id, tipo, COUNT(*) as total')
            ->groupBy('empleado_id', 'tipo')
            ->get()
            ->groupBy('empleado_id');

        return $filas
            ->map(function ($r) use ($acciones) {
                $porTipo = ($acciones[$r->id] ?? collect())->pluck('total', 'tipo');

                return [
                    'id' => $r->id,
                    'nombre' => trim("$r->nombres $r->apellidos"),
                    'cedula' => $r->cedula,
                    'jornadas' => (int) $r->jornadas,
                    'asignadas' => (int) $r->asignadas,
                    'aprobadas' => (int) $r->aprobadas,
                    'efectividad' => ConsolidadorInforme::efectividad((int) $r->aprobadas, (int) $r->asignadas),
                    'pod' => $r->auditadas ? round($r->cumplen / $r->auditadas * 100, 1) : null,
                    'sinEvidencia' => (int) $r->sin_evidencia,
                    'felicitaciones' => (int) ($porTipo[TipoAccion::Felicitacion->value] ?? 0),
                    'retroalimentaciones' => (int) ($porTipo[TipoAccion::Retroalimentacion->value] ?? 0),
                    'llamados' => (int) ($porTipo[TipoAccion::LlamadoAtencion->value] ?? 0),
                ];
            })
            ->sortByDesc(fn ($r) => [$r['efectividad'], $r['pod'] ?? -1])
            ->values()
            ->all();
    }

    /** RF-09: qué componente del protocolo falla más. */
    private function protocolo(Builder $q): array
    {
        $r = $q->clone()
            ->join('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->selectRaw('
                COUNT(*) as auditadas,
                SUM(a.foto_fachada) as fachada,
                SUM(a.fotos_sellado >= 4) as sellado,
                SUM(a.fotos_destapado >= 4 OR a.recibe_sin_destapar) as destapado,
                SUM(a.foto_remesa) as remesa,
                SUM(a.recibe_sin_destapar) as sin_destapar
            ')
            ->first();

        $total = (int) $r->auditadas;
        $pct = fn ($v) => $total ? round($v / $total * 100, 1) : 0;

        return [
            'auditadas' => $total,
            'sinDestapar' => (int) $r->sin_destapar,
            'componentes' => [
                ['clave' => 'fachada', 'nombre' => 'Foto de fachada', 'detalle' => '1 foto', 'cumplimiento' => $pct($r->fachada)],
                ['clave' => 'sellado', 'nombre' => 'Producto sellado', 'detalle' => 'mín. 4 fotos', 'cumplimiento' => $pct($r->sellado)],
                ['clave' => 'destapado', 'nombre' => 'Producto destapado', 'detalle' => 'mín. 4 fotos o nota firmada', 'cumplimiento' => $pct($r->destapado)],
                ['clave' => 'remesa', 'nombre' => 'Remesa firmada', 'detalle' => 'factura o remesa', 'cumplimiento' => $pct($r->remesa)],
            ],
        ];
    }

    private function pendientes(): array
    {
        return [
            'informes' => InformeDiario::query()
                ->with(['cliente:id,nombre,color', 'sede:id,nombre'])
                ->where('estado', '<>', EstadoInforme::Cerrado)
                ->orderByDesc('fecha_operacion')
                ->limit(6)
                ->get()
                ->map(fn (InformeDiario $i) => [
                    'id' => $i->id,
                    'fecha' => $i->fecha_operacion->toDateString(),
                    'cliente' => $i->cliente?->nombre,
                    'color' => $i->cliente?->color,
                    'sede' => $i->sede?->nombre,
                    'estado' => $i->estado->value,
                    'estadoLabel' => $i->estado->label(),
                    'efectividad' => (float) $i->efectividad,
                    'asignadas' => $i->total_asignadas,
                    'sinAuditar' => $i->ordenes()->where('estado', 'aprobada')->whereDoesntHave('auditoria')->count(),
                ]),
            'ultimaCarga' => Carga::latest('id')->first(['id', 'archivo_nombre', 'fecha_operacion', 'total_filas', 'estado', 'procesado_en']),
        ];
    }

    private function accionesRecientes(?int $empleadoId): array
    {
        return AccionDesempeno::query()
            ->with('empleado:id,nombres,apellidos')
            ->when($empleadoId !== null, fn ($q) => $q->where('empleado_id', $empleadoId))
            ->latest('fecha')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(fn (AccionDesempeno $a) => [
                'id' => $a->id,
                'fecha' => $a->fecha->toDateString(),
                'tipo' => $a->tipo->value,
                'tipoLabel' => $a->tipo->label(),
                'empleado' => $a->empleado?->nombre_completo,
                'descripcion' => $a->descripcion,
            ])
            ->all();
    }
}
