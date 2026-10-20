<?php

namespace App\Http\Controllers;

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Carga;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\Parametro;
use App\Models\Sede;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tablero de la línea de servicios logísticos (SRS 4.1): efectividad, motivos de rechazo y ranking
 * por auxiliar y sede. Se muestra dentro de la línea; quien está asignado a una empresa solo ve la suya
 * (y, dentro de ella, su sede y su sucursal si las tiene).
 */
class DashboardController extends Controller
{
    private const PERIODOS = [7, 30, 90];

    public function mostrar(Request $request, LineaServicio $linea): Response
    {
        $user = $request->user();
        // Con alcance "solo lo suyo" (p. ej. el auxiliar) el tablero muestra únicamente su desempeño
        $esAuxiliar = $user->soloLoSuyo();
        $empleadoId = $esAuxiliar ? ($user->empleado_id ?? 0) : null;

        // Alcance: las sedes de las empresas que reciben la línea. Quien está asignado a una empresa queda
        // limitado a ella, y a su sede y su sucursal si las tiene; el auxiliar ve sus propias órdenes.
        $empresaFija = $user->empresaFija();
        $sedeFija = $esAuxiliar ? null : $user->sedeFija();
        $sucursalFija = $esAuxiliar ? null : $user->sucursalFija();
        // Las sedes o empresas desactivadas conservan su historial en el tablero; el selector ofrece solo las activas
        $sedesAlcance = Sede::query()
            ->whereHas('empresa', fn ($q) => $q->whereHas('lineas', fn ($l) => $l->whereKey($linea->id)))
            ->when($empresaFija, fn ($q) => $q->where('empresa_id', $empresaFija))
            ->when($sedeFija, fn ($q) => $q->whereKey($sedeFija))
            ->with('empresa:id,nombre,activo')
            ->orderBy('nombre')
            ->get(['id', 'empresa_id', 'nombre', 'color', 'activo']);
        $idsAlcance = $sedesAlcance->pluck('id')->all();
        $opcionesSede = $sedesAlcance->filter(fn (Sede $s) => $s->activo && $s->empresa?->activo)->values();

        // La sede pedida (o la fija) debe estar dentro del alcance
        $pedida = $sedeFija ?? ($request->integer('sede') ?: null);
        $sedeId = in_array($pedida, $idsAlcance, true) ? $pedida : null;

        $enAlcance = fn (Builder $q) => $q
            ->when($sedeId, fn (Builder $q) => $q->where('sede_id', $sedeId), fn (Builder $q) => $q->whereIn('sede_id', $idsAlcance))
            ->when($sucursalFija, fn (Builder $q) => $q->where('sucursal_id', $sucursalFija))
            ->when($empleadoId !== null, fn (Builder $q) => $q->where('empleado_id', $empleadoId));

        // El periodo termina en la última jornada con datos del alcance (la carga es a día vencido)
        $ultimaOperacion = $enAlcance(Orden::query())->max('fecha_operacion');
        $hasta = $request->date('hasta') ?? ($ultimaOperacion ? Carbon::parse($ultimaOperacion) : today());
        $periodo = in_array($request->integer('periodo'), self::PERIODOS, true) ? $request->integer('periodo') : 30;
        $desde = $request->date('desde') ?? $hasta->copy()->subDays($periodo - 1);

        $base = fn (Carbon $d, Carbon $h) => $enAlcance(Orden::query()->whereBetween('fecha_operacion', [$d->toDateString(), $h->toDateString()]));
        $sedesVista = $sedeId ? [$sedeId] : $idsAlcance;
        // Con alcance fijo, las acciones de desempeño se limitan a lo ocurrido dentro de ese alcance
        $limitarAcciones = $empresaFija !== null && $empleadoId === null;

        $dias = $desde->diffInDays($hasta) + 1;
        $prevHasta = $desde->copy()->subDay();
        $prevDesde = $prevHasta->copy()->subDays($dias - 1);

        $kpis = $this->kpis($base($desde, $hasta));
        $kpisPrevios = $this->kpis($base($prevDesde, $prevHasta));

        return Inertia::render('lineas/logistica', [
            'linea' => ['slug' => $linea->slug, 'nombre' => $linea->nombre],
            // Lo más específico a lo que está asignado: "TuGo · Cali Sur", "TuGo" o "Ditranza"
            'alcanceFijo' => $this->alcanceFijo($user),
            'filtros' => [
                'desde' => $desde->toDateString(),
                'hasta' => $hasta->toDateString(),
                'periodo' => $request->filled('desde') ? null : $periodo,
                'sede' => $sedeId,
            ],
            'vista' => $esAuxiliar ? 'auxiliar' : 'gerencial',
            'sedes' => $opcionesSede->map(fn (Sede $s) => ['id' => $s->id, 'nombre' => $s->nombre, 'color' => $s->color, 'empresa' => $s->empresa?->nombre]),
            'ultimaOperacion' => $ultimaOperacion,
            'meta' => (float) ($sedeId
                ? Sede::find($sedeId)?->meta_efectividad
                : Parametro::valor('meta_efectividad_global', 95)),
            'kpis' => $kpis,
            'kpisPrevios' => $kpisPrevios,
            'tendencia' => $this->tendencia($base($desde, $hasta)),
            'motivos' => $this->motivos($base($desde, $hasta)),
            'porSede' => $esAuxiliar ? [] : $this->porSede($base($desde, $hasta)),
            'ranking' => $this->ranking($base($desde, $hasta), $desde, $hasta, $limitarAcciones ? $this->informesDe($sedesVista, $sucursalFija) : null),
            'protocolo' => $this->protocolo($base($desde, $hasta)),
            // La última carga de Drivin solo la ve quien puede abrir Cargas
            'pendientes' => $esAuxiliar ? null : $this->pendientes($sedesVista, $sucursalFija, $user->puede('cargas.ver')),
            'acciones' => $this->accionesRecientes($empleadoId, $sedesVista, $sucursalFija, $limitarAcciones),
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

    private function alcanceFijo(User $user): ?string
    {
        if ($user->empresaFija() === null) {
            return null;
        }
        $user->loadMissing('empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre');

        return match (true) {
            $user->sucursal !== null => trim(($user->sede?->nombre ?? '').' · '.$user->sucursal->nombre, ' ·'),
            $user->sede !== null => $user->sede->nombre,
            default => $user->empresa?->nombre,
        };
    }

    private function porSede(Builder $q): array
    {
        return $q->clone()
            ->join('sedes as c', 'c.id', '=', 'ordenes.sede_id')
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

    /** Informes diarios de unas sedes (y de una sucursal, si se indica): el alcance de las acciones de desempeño. */
    private function informesDe(array $sedes, ?int $sucursalId): Builder
    {
        return InformeDiario::query()
            ->whereIn('sede_id', $sedes)
            ->when($sucursalId, fn ($q) => $q->where('sucursal_id', $sucursalId))
            ->select('id');
    }

    /** @param  Builder|null  $informes  con alcance fijo, solo cuentan las acciones de esos informes */
    private function ranking(Builder $q, Carbon $desde, Carbon $hasta, ?Builder $informes = null): array
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
            ->when($informes, fn ($q) => $q->whereIn('informe_id', $informes))
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

    /**
     * @param  list<int>  $sedes
     * @param  bool  $verCarga  la última carga de Drivin mezcla empresas: solo para el personal propio
     */
    private function pendientes(array $sedes, ?int $sucursalId, bool $verCarga): array
    {
        return [
            'informes' => InformeDiario::query()
                ->with(['sede:id,nombre,color', 'sucursal:id,nombre'])
                ->whereIn('sede_id', $sedes)
                ->when($sucursalId, fn ($q) => $q->where('sucursal_id', $sucursalId))
                ->where('estado', '<>', EstadoInforme::Cerrado)
                ->orderByDesc('fecha_operacion')
                ->limit(6)
                ->get()
                ->map(fn (InformeDiario $i) => [
                    'id' => $i->id,
                    'fecha' => $i->fecha_operacion->toDateString(),
                    'sede' => $i->sede?->nombre,
                    'color' => $i->sede?->color,
                    'sucursal' => $i->sucursal?->nombre,
                    'estado' => $i->estado->value,
                    'estadoLabel' => $i->estado->label(),
                    'efectividad' => (float) $i->efectividad,
                    'asignadas' => $i->total_asignadas,
                    'sinAuditar' => $i->ordenes()->where('estado', 'aprobada')->whereDoesntHave('auditoria')->count(),
                ]),
            'ultimaCarga' => $verCarga
                ? Carga::where('estado', '<>', EstadoCarga::Anulada)->latest('id')->first(['id', 'archivo_nombre', 'fecha_operacion', 'total_filas', 'estado', 'procesado_en'])
                : null,
        ];
    }

    /**
     * @param  list<int>  $sedes
     * @param  bool  $limitar  con alcance fijo, las acciones generales (sin informe) solo de quienes operan en él
     */
    private function accionesRecientes(?int $empleadoId, array $sedes, ?int $sucursalId, bool $limitar): array
    {
        return AccionDesempeno::query()
            ->with('empleado:id,nombres,apellidos')
            ->when($empleadoId !== null, fn ($q) => $q->where('empleado_id', $empleadoId))
            // Acciones ligadas a un informe fuera del alcance no se muestran
            ->where(fn ($q) => $q
                ->whereIn('informe_id', $this->informesDe($sedes, $sucursalId))
                ->orWhere(fn ($g) => $g->whereNull('informe_id')->when($limitar, fn ($w) => $w->whereIn(
                    'empleado_id',
                    Orden::query()->whereIn('sede_id', $sedes)->when($sucursalId, fn ($o) => $o->where('sucursal_id', $sucursalId))->whereNotNull('empleado_id')->select('empleado_id'),
                ))))
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
