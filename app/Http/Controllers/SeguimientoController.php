<?php

namespace App\Http\Controllers;

use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use App\Support\OperacionLogistica;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Seguimiento y desempeño de la operación logística: cómo le va a cada auxiliar en el periodo (entregas,
 * cumplimiento, evidencias) y las acciones que se toman con él: felicitaciones, retroalimentaciones y llamados de
 * atención (la columna "Acción / Seguimiento" del informe diario).
 */
class SeguimientoController extends Controller
{
    private const PERIODOS = [7, 30, 90];

    public function index(Request $request): Response
    {
        $yo = $request->user();
        $op = OperacionLogistica::para($yo, $request->integer('sede') ?: null);
        $periodo = in_array($request->integer('periodo'), self::PERIODOS, true) ? $request->integer('periodo') : 30;
        $ultima = $op->ubicacion(Orden::query())->max('fecha_operacion');
        $hasta = $ultima ? Carbon::parse($ultima) : today();
        $desde = $hasta->copy()->subDays($periodo - 1);
        $texto = trim((string) $request->input('q'));

        // Cada auxiliar con entregas en el periodo, dentro de lo que se ve
        $porPersona = $op->ubicacion(Orden::query(), 'ordenes')
            ->whereBetween('ordenes.fecha_operacion', [$desde->toDateString(), $hasta->toDateString()])
            ->whereNotNull('ordenes.auxiliar_id')
            ->leftJoin('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->groupBy('ordenes.auxiliar_id')
            // Entregas por producto, como el informe diario
            ->selectRaw('ordenes.auxiliar_id,
                SUM(ordenes.productos) as asignadas,
                SUM(ordenes.productos_entregados) as realizadas,
                COUNT(DISTINCT ordenes.fecha_operacion) as jornadas,
                SUM(ordenes.tiene_imagenes = 0 OR a.sin_evidencia = 1) as sin_evidencia,
                COUNT(a.auditado_en) as auditadas,
                SUM(a.cumple_protocolo) as cumplen,
                MAX(ordenes.fecha_operacion) as ultima')
            ->toBase()
            ->get()
            ->keyBy('auxiliar_id');

        $personas = User::whereIn('id', $porPersona->keys())
            ->when($texto !== '', fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', '%'.addcslashes($texto, '%_\\').'%')->orWhere('cedula', 'like', '%'.addcslashes($texto, '%_\\').'%')))
            ->get(['id', 'name', 'cedula', 'cargo', 'activo']);
        $acciones = AccionDesempeno::whereIn('user_id', $personas->pluck('id'))
            ->where('linea_servicio_id', $op->linea->id)
            // Las acciones se registran después de la jornada (el informe es a día vencido): hasta hoy
            ->whereBetween('fecha', [$desde->toDateString(), max($hasta, today())->toDateString()])
            ->with('registradoPor:id,name')
            ->latest('fecha')->latest('id')
            ->get()
            ->groupBy('user_id');

        $filas = $personas->map(function (User $p) use ($porPersona, $acciones) {
            $r = $porPersona[$p->id];
            $suyas = $acciones[$p->id] ?? collect();

            return [
                'id' => $p->id,
                'nombre' => $p->name,
                'cedula' => $p->cedula,
                'cargo' => $p->cargo,
                'activo' => $p->activo,
                'jornadas' => (int) $r->jornadas,
                'asignadas' => (int) $r->asignadas,
                'realizadas' => (int) $r->realizadas,
                'cumplimiento' => ConsolidadorInforme::efectividad((int) $r->realizadas, (int) $r->asignadas),
                'sinEvidencia' => (int) $r->sin_evidencia,
                'protocolo' => $r->auditadas ? round($r->cumplen / $r->auditadas * 100, 1) : null,
                'ultimaJornada' => Carbon::parse($r->ultima)->toDateString(),
                'conteo' => collect(TipoAccion::cases())->mapWithKeys(fn (TipoAccion $t) => [$t->value => $suyas->where('tipo', $t)->count()]),
                'acciones' => $suyas->take(8)->map(fn (AccionDesempeno $a) => [
                    'id' => $a->id,
                    'fecha' => $a->fecha->toDateString(),
                    'tipo' => $a->tipo->value,
                    'tipoLabel' => $a->tipo->label(),
                    'descripcion' => $a->descripcion,
                    'efectividad' => $a->efectividad_referencia !== null ? (float) $a->efectividad_referencia : null,
                    'registradaPor' => $a->registradoPor?->name,
                ])->values(),
            ];
        })->sortBy([['cumplimiento', 'asc'], ['nombre', 'asc']])->values();

        return Inertia::render('seguimiento/index', [
            'filtros' => ['q' => $texto, 'sede' => $op->sedeId ? (string) $op->sedeId : '', 'periodo' => (string) $periodo],
            'periodo' => ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString(), 'dias' => $periodo],
            'sedes' => $op->opcionesSede()->map(fn ($s) => ['id' => $s->id, 'nombre' => $s->nombre]),
            'personas' => $filas,
            'tiposAccion' => TipoAccion::opciones(),
        ]);
    }

    /** Registra una felicitación, retroalimentación o llamado de atención (desde el informe o desde aquí). */
    public function registrar(Request $request): RedirectResponse
    {
        $yo = $request->user();
        $datos = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'informe_id' => ['nullable', 'integer', Rule::exists('informes_diarios', 'id')],
            'tipo' => ['required', Rule::in(TipoAccion::values())],
            'descripcion' => ['nullable', 'string', 'max:500'],
        ], ['tipo.required' => 'Elige qué acción se toma.', 'tipo.in' => 'Elige una de las acciones de la lista.']);

        $persona = User::find($datos['user_id']);
        $informe = isset($datos['informe_id']) ? InformeDiario::find($datos['informe_id']) : null;
        $op = OperacionLogistica::para($yo);

        if ($persona->is($yo)) {
            throw ValidationException::withMessages(['tipo' => 'No puedes registrarte acciones a ti mismo.']);
        }
        // La persona debe operar dentro de lo que se ve (sus entregas) y el informe, si lo hay, también
        $operaAqui = $op->ubicacion(Orden::query())->where('auxiliar_id', $persona->id)->exists();
        abort_unless($operaAqui || $yo->alcanza($persona), 404);
        if ($informe) {
            abort_unless($op->ubicacion(InformeDiario::whereKey($informe->id))->exists(), 404);
            if ($informe->estaCerrado()) {
                throw ValidationException::withMessages(['tipo' => 'El informe está cerrado: reábrelo para registrar acciones.']);
            }
        }

        $linea = $informe?->lineas()->where('auxiliar_id', $persona->id)->first();
        $tipo = TipoAccion::from($datos['tipo']);
        AccionDesempeno::create([
            'user_id' => $persona->id,
            'linea_servicio_id' => $op->linea->id,
            'informe_id' => $informe?->id,
            // El día en que se revisa la operación (el informe es a día vencido)
            'fecha' => today(),
            'tipo' => $tipo,
            'descripcion' => trim((string) ($datos['descripcion'] ?? '')) ?: null,
            'efectividad_referencia' => $linea?->efectividad,
            'notificado' => false,
            'registrado_por' => $yo->id,
        ]);

        return back()->with('success', "{$tipo->label()} registrada para {$persona->name}.");
    }

    public function eliminar(Request $request, AccionDesempeno $accion): RedirectResponse
    {
        $yo = $request->user();
        $op = OperacionLogistica::para($yo);
        abort_unless($accion->registrado_por === $yo->id || $yo->sinLimites(), 403, 'Solo quien registró la acción puede quitarla.');
        if ($accion->informe_id) {
            abort_unless($op->ubicacion(InformeDiario::whereKey($accion->informe_id))->exists(), 404);
            abort_if($accion->informe?->estaCerrado(), 409, 'El informe está cerrado: reábrelo para quitar la acción.');
        }

        $accion->delete();

        return back()->with('success', 'Acción quitada.');
    }
}
