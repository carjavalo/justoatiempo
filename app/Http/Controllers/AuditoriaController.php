<?php

namespace App\Http\Controllers;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoEvidencia;
use App\Models\AuditoriaPod;
use App\Models\Bitacora;
use App\Models\Cliente;
use App\Models\Evidencia;
use App\Models\Orden;
use App\Models\TipoNovedad;
use App\Services\ConsolidadorInforme;
use App\Services\Pod\AlmacenEvidencias;
use App\Services\Pod\EmparejadorArchivos;
use App\Services\Pod\EvaluadorProtocolo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Módulo 4: auditoría del protocolo de prueba de entrega (RF-09, RF-10).
 * Se auditan las entregas aprobadas; la cola se trabaja por jornada.
 */
class AuditoriaController extends Controller
{
    private const ESTADOS = ['pendientes', 'no_cumplen', 'sin_evidencia', 'auditadas', 'todas'];

    private const ARCHIVOS = ['required', 'array', 'min:1', 'max:60'];

    private const ARCHIVO = ['file', 'max:15360', 'mimetypes:application/pdf,image/jpeg,image/png,image/webp'];

    public function __construct(
        private AlmacenEvidencias $almacen,
        private EmparejadorArchivos $emparejador,
        private ConsolidadorInforme $consolidador,
    ) {}

    public function index(Request $request): Response
    {
        return $this->pantalla($request, null);
    }

    public function show(Request $request, Orden $orden): Response
    {
        abort_unless($orden->estado === EstadoOrden::Aprobada, 404, 'Solo se auditan entregas aprobadas.');

        return $this->pantalla($request, $orden);
    }

    public function guardar(Request $request, Orden $orden): RedirectResponse
    {
        abort_unless($orden->estado === EstadoOrden::Aprobada, 404);
        if ($this->informeCerrado($orden)) {
            return back()->with('error', 'El informe de esta jornada ya está cerrado: la auditoría no se puede modificar.');
        }

        $datos = $request->validate([
            'foto_fachada' => ['boolean'],
            'fotos_sellado' => ['integer', 'min:0', 'max:50'],
            'fotos_destapado' => ['integer', 'min:0', 'max:50'],
            'foto_remesa' => ['boolean'],
            'foto_rotulo' => ['boolean'],
            'recibe_sin_destapar' => ['boolean'],
            'sin_evidencia' => ['boolean'],
            'tipo_novedad_id' => ['nullable', 'integer', 'exists:tipos_novedad,id'],
            'concepto' => ['nullable', 'string', 'max:500'],
            'siguiente' => ['nullable', 'integer', 'exists:ordenes,id'],
        ]);

        // "Sin evidencia" anula el resto de la lista de chequeo
        $checklist = ($datos['sin_evidencia'] ?? false)
            ? ['foto_fachada' => false, 'fotos_sellado' => 0, 'fotos_destapado' => 0, 'foto_remesa' => false, 'foto_rotulo' => false, 'recibe_sin_destapar' => false, 'sin_evidencia' => true]
            : collect($datos)->only(['foto_fachada', 'fotos_sellado', 'fotos_destapado', 'foto_remesa', 'foto_rotulo', 'recibe_sin_destapar'])->all() + ['sin_evidencia' => false];

        $auditoria = DB::transaction(function () use ($orden, $checklist, $datos, $request) {
            $auditoria = AuditoriaPod::updateOrCreate(['orden_id' => $orden->id], [
                ...$checklist,
                'tipo_novedad_id' => $datos['tipo_novedad_id'] ?? null,
                'concepto' => $datos['concepto'] ?? null,
                'auditado_por' => $request->user()->id,
                'auditado_en' => now(),
            ]);

            // El informe del día refleja el cumplimiento del protocolo y las novedades (RF-05)
            if ($orden->cliente_id) {
                $this->consolidador->consolidar($orden->fecha_operacion, $orden->cliente_id, $orden->sede_id);
            }

            Bitacora::registrar('auditada', $orden, ['cumple' => $auditoria->cumple_protocolo]);

            return $auditoria;
        });

        $destino = $datos['siguiente'] ?? $orden->id;

        return redirect()
            ->route('auditoria.show', ['orden' => $destino, ...$this->filtrosDe($request)])
            ->with('success', "Orden {$orden->codigo_orden}: ".($auditoria->cumple_protocolo ? 'cumple el protocolo.' : 'no cumple el protocolo.'));
    }

    public function subirEvidencias(Request $request, Orden $orden): RedirectResponse|JsonResponse
    {
        if ($this->informeCerrado($orden)) {
            return back()->with('error', 'El informe de esta jornada ya está cerrado.');
        }

        $request->validate(['archivos' => self::ARCHIVOS, 'archivos.*' => self::ARCHIVO], $this->mensajesArchivos());

        $nuevas = 0;
        foreach ($request->file('archivos') as $archivo) {
            [, $nueva] = $this->almacen->guardar($orden, $archivo, $request->user()->id);
            $nuevas += (int) $nueva;
        }

        $repetidas = count($request->file('archivos')) - $nuevas;

        // El navegador envía en tandas (PHP limita los archivos por petición) y arma el resumen al final
        if ($request->wantsJson()) {
            return response()->json(['asignados' => $nuevas, 'repetidos' => $repetidas, 'ordenes' => [$orden->id], 'sinOrden' => [], 'cerrados' => []]);
        }

        return back()->with('success', $nuevas === 1 ? 'Se agregó 1 evidencia.' : "Se agregaron {$nuevas} evidencias.".($repetidas ? " {$repetidas} ya estaban cargadas." : ''));
    }

    /** Carga masiva: cada archivo se asigna a su orden por el código que trae en el nombre. */
    public function subirLote(Request $request): RedirectResponse|JsonResponse
    {
        $request->validate(['archivos' => self::ARCHIVOS, 'archivos.*' => self::ARCHIVO, 'fecha' => ['nullable', 'date']], $this->mensajesArchivos());

        $asignados = 0;
        $repetidos = 0;
        $ordenes = [];
        $sinOrden = [];
        $cerrados = [];

        foreach ($request->file('archivos') as $archivo) {
            $nombre = $archivo->getClientOriginalName();
            $orden = $this->emparejador->orden($nombre, $request->input('fecha')) ?? $this->emparejador->orden($nombre);

            if (! $orden) {
                $sinOrden[] = $nombre;

                continue;
            }
            if ($this->informeCerrado($orden)) {
                $cerrados[] = $nombre;

                continue;
            }

            [, $nueva] = $this->almacen->guardar($orden, $archivo, $request->user()->id);
            if ($nueva) {
                $asignados++;
                $ordenes[$orden->id] = true; // solo cuentan las órdenes que recibieron archivos nuevos
            } else {
                $repetidos++;
            }
        }

        if ($request->wantsJson()) {
            return response()->json(['asignados' => $asignados, 'repetidos' => $repetidos, 'ordenes' => array_keys($ordenes), 'sinOrden' => $sinOrden, 'cerrados' => $cerrados]);
        }

        $mensaje = $asignados === 1 ? 'Se asignó 1 archivo' : "Se asignaron {$asignados} archivos";
        $mensaje .= ' a '.count($ordenes).' '.(count($ordenes) === 1 ? 'orden' : 'órdenes').'.';
        if ($repetidos) {
            $mensaje .= " {$repetidos} ya estaban cargados.";
        }

        return back()
            ->with($asignados || $repetidos ? 'success' : 'error', $asignados || $repetidos ? $mensaje : 'Ningún archivo trae en el nombre el código de una orden.')
            ->with('lote', ['sinOrden' => $sinOrden, 'cerrados' => $cerrados]);
    }

    public function clasificar(Request $request, Evidencia $evidencia): RedirectResponse
    {
        if ($this->informeCerrado($evidencia->orden)) {
            return back()->with('error', 'El informe de esta jornada ya está cerrado.');
        }

        $datos = $request->validate(['tipo' => ['required', Rule::enum(TipoEvidencia::class)]]);
        $evidencia->update($datos);

        return back();
    }

    public function eliminarEvidencia(Evidencia $evidencia): RedirectResponse
    {
        if ($this->informeCerrado($evidencia->orden)) {
            return back()->with('error', 'El informe de esta jornada ya está cerrado.');
        }

        Bitacora::registrar('evidencia_eliminada', $evidencia->orden, ['archivo' => $evidencia->nombre_original]);
        $this->almacen->eliminar($evidencia);

        return back()->with('success', 'Evidencia eliminada.');
    }

    /** Sirve el archivo solo a usuarios autenticados con permiso (no está en una carpeta pública). */
    public function ver(Request $request, Evidencia $evidencia): StreamedResponse
    {
        $nombre = $evidencia->nombre_original ?: basename($evidencia->path);

        return $request->boolean('descargar')
            ? Storage::disk('local')->download($evidencia->path, $nombre)
            : Storage::disk('local')->response($evidencia->path, $nombre, ['Cache-Control' => 'private, max-age=3600']);
    }

    private function pantalla(Request $request, ?Orden $seleccionada): Response
    {
        $jornadas = $this->jornadas();
        $estado = in_array($request->input('estado'), self::ESTADOS, true) ? $request->input('estado') : 'pendientes';
        $clienteId = $request->integer('cliente') ?: null;
        $busqueda = trim((string) $request->input('q'));

        // Jornada: la de la orden abierta, la pedida, o la más reciente con pendientes
        $porDefecto = collect($jornadas)->first(fn ($j) => $j['pendientes'] > 0) ?? ($jornadas[0] ?? null);
        $fecha = $seleccionada?->fecha_operacion->toDateString()
            ?? $request->date('fecha')?->toDateString()
            ?? $porDefecto['fecha']
            ?? today()->toDateString();

        $base = Orden::query()
            ->where('ordenes.estado', EstadoOrden::Aprobada)
            ->whereDate('ordenes.fecha_operacion', $fecha)
            ->when($clienteId, fn (Builder $q) => $q->where('ordenes.cliente_id', $clienteId));

        $lista = $base->clone()
            ->with(['auditoria:id,orden_id,cumple_protocolo,sin_evidencia', 'cliente:id,nombre', 'sede:id,nombre', 'empleado:id,nombres,apellidos', 'informe:id,estado'])
            ->withCount('evidencias')
            ->when($busqueda !== '', fn (Builder $q) => $q->where(fn ($w) => $w
                ->where('codigo_orden', 'like', "%{$busqueda}%")
                ->orWhere('destinatario', 'like', "%{$busqueda}%")
                ->orWhere('auxiliar_nombre', 'like', "%{$busqueda}%")
                ->orWhere('placa', 'like', "%{$busqueda}%")))
            ->tap(fn (Builder $q) => match ($estado) {
                'pendientes' => $q->whereDoesntHave('auditoria'),
                'auditadas' => $q->whereHas('auditoria'),
                'no_cumplen' => $q->whereHas('auditoria', fn ($a) => $a->where('cumple_protocolo', false)->where('sin_evidencia', false)),
                'sin_evidencia' => $q->where(fn ($w) => $w->whereHas('auditoria', fn ($a) => $a->where('sin_evidencia', true))
                    ->orWhere(fn ($x) => $x->whereDoesntHave('auditoria')->whereDoesntHave('evidencias'))),
                default => $q,
            })
            ->orderBy('ruta')
            ->orderBy('auxiliar_nombre')
            ->orderBy('codigo_orden')
            ->limit(400)
            ->get();

        // Sin selección explícita se abre la primera de la lista: la cola se trabaja de arriba a abajo
        $seleccionada ??= $lista->first();

        // Siguiente al guardar: la próxima pendiente (dando la vuelta a la lista) o, si no quedan, la siguiente de la lista
        $pos = $seleccionada ? $lista->search(fn (Orden $o) => $o->id === $seleccionada->id) : false;
        $pendiente = fn (Orden $o) => ! $o->auditoria && $o->id !== $seleccionada?->id;
        $siguiente = $lista->slice($pos === false ? 0 : $pos + 1)->first($pendiente)
            ?? $lista->first($pendiente)
            ?? ($pos !== false ? $lista->get($pos + 1) : null);

        return Inertia::render('auditoria/index', [
            'filtros' => ['fecha' => $fecha, 'cliente' => $clienteId, 'estado' => $estado, 'q' => $busqueda ?: null],
            'jornadas' => $jornadas,
            'clientes' => Cliente::orderBy('nombre')->get(['id', 'nombre']),
            'resumen' => $this->resumen($base),
            'ordenes' => $lista->map(fn (Orden $o) => [
                'id' => $o->id,
                'codigo' => $o->codigo_orden,
                'destinatario' => $o->destinatario,
                'ciudad' => $o->ciudad,
                'cliente' => $o->cliente?->nombre,
                'sede' => $o->sede?->nombre,
                'auxiliar' => $o->empleado?->nombre_completo ?? $o->auxiliar_nombre,
                'placa' => $o->placa,
                'evidencias' => (int) $o->evidencias_count,
                'estadoAuditoria' => $this->estadoAuditoria($o),
            ])->values(),
            'seleccionada' => $seleccionada ? $this->detalle($seleccionada) : null,
            'siguiente' => $siguiente ? ['id' => $siguiente->id, 'codigo' => $siguiente->codigo_orden] : null,
            'tiposNovedad' => TipoNovedad::where('activo', true)->orderBy('nombre')->get(['id', 'nombre', 'severidad']),
        ]);
    }

    private function detalle(Orden $orden): array
    {
        $orden->loadMissing(['auditoria.auditor:id,name', 'evidencias', 'cliente:id,nombre', 'sede:id,nombre', 'empleado:id,nombres,apellidos', 'informe:id,estado']);
        $evidencias = $orden->evidencias->sortBy('id')->values();
        $a = $orden->auditoria;

        // Si aún no se ha auditado, la lista de chequeo parte de lo que dicen las fotos clasificadas
        $porTipo = $evidencias->countBy(fn (Evidencia $e) => $e->tipo->value);
        $checklist = $a ? $a->only(['foto_fachada', 'fotos_sellado', 'fotos_destapado', 'foto_remesa', 'foto_rotulo', 'recibe_sin_destapar', 'sin_evidencia']) : [
            'foto_fachada' => ($porTipo['fachada'] ?? 0) > 0,
            'fotos_sellado' => $porTipo['sellado'] ?? 0,
            'fotos_destapado' => $porTipo['destapado'] ?? 0,
            'foto_remesa' => ($porTipo['remesa'] ?? 0) > 0,
            'foto_rotulo' => ($porTipo['rotulo'] ?? 0) > 0,
            'recibe_sin_destapar' => false,
            'sin_evidencia' => $evidencias->isEmpty(),
        ];

        $productos = $orden->datos_crudos['productos'] ?? [];

        return [
            'id' => $orden->id,
            'codigo' => $orden->codigo_orden,
            'fecha' => $orden->fecha_operacion->toDateString(),
            'cliente' => $orden->cliente?->nombre,
            'sede' => $orden->sede?->nombre,
            'ruta' => $orden->ruta,
            'placa' => $orden->placa,
            'auxiliar' => $orden->empleado?->nombre_completo ?? $orden->auxiliar_nombre,
            'conductor' => $orden->datos_crudos['conductor'] ?? null,
            'destinatario' => $orden->destinatario,
            'direccion' => $orden->direccion,
            'ciudad' => $orden->ciudad,
            'horaEntrega' => $orden->hora_entrega?->format('H:i'),
            'comentarioPod' => $orden->comentario_pod,
            'faltante' => $orden->faltante ? ($orden->faltante_detalle ?? 'Entrega parcial') : null,
            'productos' => collect($productos)->pluck('producto')->filter()->unique()->values(),
            'informeCerrado' => $orden->informe?->estado === EstadoInforme::Cerrado,
            'evidencias' => $evidencias->map(fn (Evidencia $e) => [
                'id' => $e->id,
                'tipo' => $e->tipo->value,
                'nombre' => $e->nombre_original,
                'esPdf' => $e->esPdf(),
                'imagenes' => $e->imagenes,
                'tamano' => $e->tamano_bytes,
                'url' => route('evidencias.ver', $e),
            ]),
            'auditoria' => [
                ...$checklist,
                'tipo_novedad_id' => $a?->tipo_novedad_id,
                'concepto' => $a?->concepto,
                'auditada' => $a !== null,
                'auditor' => $a?->auditor?->name,
                'auditadaEn' => $a?->auditado_en?->toIso8601String(),
            ],
            'sugerencia' => EvaluadorProtocolo::evaluar($checklist),
        ];
    }

    /** @return list<array{fecha: string, aprobadas: int, pendientes: int}> */
    private function jornadas(): array
    {
        return Orden::query()
            ->where('ordenes.estado', EstadoOrden::Aprobada)
            ->leftJoin('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->selectRaw('ordenes.fecha_operacion as fecha, COUNT(*) as aprobadas, SUM(a.id IS NULL) as pendientes')
            ->groupBy('ordenes.fecha_operacion')
            ->orderByDesc('ordenes.fecha_operacion')
            ->limit(45)
            ->get()
            ->map(fn ($j) => ['fecha' => Carbon::parse($j->fecha)->toDateString(), 'aprobadas' => (int) $j->aprobadas, 'pendientes' => (int) $j->pendientes])
            ->all();
    }

    private function resumen(Builder $base): array
    {
        $r = $base->clone()
            ->leftJoin('auditorias_pod as a', 'a.orden_id', '=', 'ordenes.id')
            ->selectRaw('
                COUNT(*) as aprobadas,
                COUNT(a.id) as auditadas,
                SUM(a.cumple_protocolo) as cumplen,
                SUM(a.sin_evidencia) as sin_evidencia,
                SUM(a.id IS NOT NULL AND a.cumple_protocolo = 0 AND a.sin_evidencia = 0) as no_cumplen,
                SUM(a.id IS NULL AND NOT EXISTS (SELECT 1 FROM evidencias e WHERE e.orden_id = ordenes.id)) as pendientes_sin_archivos
            ')
            ->first();

        $auditadas = (int) $r->auditadas;

        return [
            'aprobadas' => (int) $r->aprobadas,
            'auditadas' => $auditadas,
            'pendientes' => (int) $r->aprobadas - $auditadas,
            'cumplen' => (int) $r->cumplen,
            'noCumplen' => (int) $r->no_cumplen,
            'sinEvidencia' => (int) $r->sin_evidencia + (int) $r->pendientes_sin_archivos,
            'cumplimiento' => $auditadas ? round($r->cumplen / $auditadas * 100, 1) : null,
        ];
    }

    private function estadoAuditoria(Orden $o): string
    {
        return match (true) {
            $o->auditoria === null => $o->evidencias_count > 0 ? 'pendiente' : 'pendiente_sin_archivos',
            (bool) $o->auditoria->sin_evidencia => 'sin_evidencia',
            (bool) $o->auditoria->cumple_protocolo => 'cumple',
            default => 'no_cumple',
        };
    }

    private function informeCerrado(Orden $orden): bool
    {
        return $orden->informe()->where('estado', EstadoInforme::Cerrado)->exists();
    }

    private function filtrosDe(Request $request): array
    {
        return array_filter($request->only(['estado', 'cliente', 'q']), fn ($v) => $v !== null && $v !== '');
    }

    private function mensajesArchivos(): array
    {
        return [
            'archivos.required' => 'Elige al menos un archivo.',
            'archivos.max' => 'Sube como máximo 60 archivos a la vez.',
            'archivos.*.mimetypes' => 'Solo se aceptan PDF y fotos (JPG, PNG o WebP).',
            'archivos.*.max' => 'Cada archivo debe pesar como máximo 15 MB.',
        ];
    }
}
