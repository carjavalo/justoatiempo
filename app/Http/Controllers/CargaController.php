<?php

namespace App\Http\Controllers;

use App\Enums\EstadoCarga;
use App\Models\Bitacora;
use App\Models\Carga;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\Sede;
use App\Services\Drivin\ImportadorPreliquidacion;
use App\Services\Drivin\MapeoColumnas;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/** Módulo 2: carga de la preliquidación de Drivin (RF-03, RF-04) con revisión previa. */
class CargaController extends Controller
{
    public function __construct(private ImportadorPreliquidacion $importador) {}

    public function index(): Response
    {
        $cargas = Carga::query()
            ->with('usuario:id,name')
            ->latest('id')
            ->paginate(12)
            ->through(fn (Carga $c) => [
                'id' => $c->id,
                'archivo' => $c->archivo_nombre,
                'fechaOperacion' => $c->fecha_operacion?->toDateString(),
                'estado' => $c->estado->value,
                'estadoLabel' => $c->estado->label(),
                'filas' => $c->total_filas,
                'ordenes' => $c->ordenes_importadas,
                'filasError' => $c->filas_error,
                'advertencias' => $c->advertencias,
                'usuario' => $c->usuario?->name,
                'creada' => $c->created_at->toIso8601String(),
                'duracionMs' => $c->duracion_ms,
            ]);

        return Inertia::render('cargas/index', [
            'cargas' => $cargas,
            'jornadaPendiente' => $this->jornadaPendiente(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'max:10240', 'mimes:xlsx,xls,csv,txt'],
        ], [
            'archivo.required' => 'Selecciona el archivo de la preliquidación.',
            'archivo.mimes' => 'El archivo debe ser Excel (.xlsx, .xls) o CSV.',
            'archivo.max' => 'El archivo no debe pesar más de 10 MB.',
        ]);

        $archivo = $request->file('archivo');
        $hash = hash_file('sha256', $archivo->getRealPath());

        if ($existente = Carga::firstWhere('archivo_hash', $hash)) {
            if ($existente->enRevision()) {
                return to_route('cargas.show', $existente)->with('success', 'Este archivo ya estaba en revisión: puedes continuar donde quedaste.');
            }
            // Una carga anulada no dejó órdenes: el mismo archivo vuelve a su revisión
            if ($existente->estado === EstadoCarga::Anulada) {
                $existente->update([
                    'estado' => EstadoCarga::EnRevision, 'fecha_operacion' => null, 'total_filas' => 0, 'filas_validas' => 0, 'filas_error' => 0,
                    'ordenes_importadas' => 0, 'advertencias' => 0, 'errores' => null, 'resumen' => null, 'procesado_en' => null, 'duracion_ms' => null,
                    'anulada_por' => null, 'anulada_en' => null,
                ]);
                Bitacora::registrar('reabierta', $existente);

                return to_route('cargas.show', $existente)->with('success', 'Este archivo se había anulado: vuelve a su revisión para importarlo de nuevo.');
            }

            return back()->withErrors(['archivo' => "Este archivo ya se importó el {$existente->procesado_en?->format('d/m/Y H:i')} (carga #{$existente->id})."]);
        }

        $extension = strtolower($archivo->getClientOriginalExtension() ?: 'xlsx');
        $ruta = $archivo->storeAs('cargas/'.now()->format('Y/m'), $hash.'.'.$extension, 'local');

        $carga = Carga::create([
            'archivo_nombre' => mb_substr($archivo->getClientOriginalName(), 0, 255),
            'archivo_path' => $ruta,
            'archivo_hash' => $hash,
            'estado' => EstadoCarga::EnRevision,
            'cargado_por' => $request->user()->id,
        ]);

        // Si no se puede leer, mejor avisar ya que dejar una revisión inservible
        try {
            $this->importador->analizar($carga);
        } catch (RuntimeException $e) {
            Storage::disk('local')->delete($ruta);
            $carga->delete();

            return back()->withErrors(['archivo' => $e->getMessage()]);
        }

        Bitacora::registrar('subida', $carga);

        return to_route('cargas.show', $carga);
    }

    public function show(Carga $carga): Response
    {
        $carga->load('usuario:id,name', 'anuladaPor:id,name');

        $base = [
            'id' => $carga->id,
            'archivo' => $carga->archivo_nombre,
            'estado' => $carga->estado->value,
            'estadoLabel' => $carga->estado->label(),
            'usuario' => $carga->usuario?->name,
            'creada' => $carga->created_at->toIso8601String(),
        ];

        if ($carga->enRevision()) {
            return $this->revision($carga, $base);
        }

        $resumen = $carga->resumen ?? [];
        $informes = InformeDiario::query()
            ->with('sede:id,nombre', 'sucursal:id,nombre')
            ->whereIn('id', $resumen['informes'] ?? [])
            ->orderBy('fecha_operacion')
            ->get()
            ->map(fn (InformeDiario $i) => [
                'id' => $i->id,
                'fecha' => $i->fecha_operacion->toDateString(),
                'sede' => $i->sede?->nombre,
                'sucursal' => $i->sucursal?->nombre,
                'estado' => $i->estado->value,
                'estadoLabel' => $i->estado->label(),
                'asignadas' => $i->total_asignadas,
                'aprobadas' => $i->total_aprobadas,
                'efectividad' => (float) $i->efectividad,
            ]);

        return Inertia::render('cargas/resultado', [
            'carga' => [
                ...$base,
                'fechaOperacion' => $carga->fecha_operacion?->toDateString(),
                'hoja' => $carga->hoja,
                'filas' => $carga->total_filas,
                'filasError' => $carga->filas_error,
                'ordenes' => $carga->ordenes_importadas,
                'duracionMs' => $carga->duracion_ms,
                'procesada' => $carga->procesado_en?->toIso8601String(),
                'anuladaPor' => $carga->anuladaPor?->name,
                'anulada' => $carga->anulada_en?->toIso8601String(),
            ],
            'totales' => $resumen['totales'] ?? null,
            'advertencias' => $resumen['advertencias'] ?? [],
            'errores' => $carga->errores ?? [],
            'informes' => $informes,
            'puedeAnular' => $carga->estado !== EstadoCarga::Anulada
                && ! $informes->contains(fn ($i) => $i['estado'] === 'cerrado')
                && request()->user()->puede('cargas.anular'),
        ]);
    }

    /** Ajustes de la revisión: hoja, mapeo de columnas, sede/sucursal por defecto y a quién se incluye de otra operación. */
    public function update(Request $request, Carga $carga): RedirectResponse
    {
        abort_unless($carga->enRevision(), 409, 'La carga ya fue procesada.');

        $datos = $request->validate([
            'hoja' => ['nullable', 'string', 'max:120'],
            'mapeo' => ['nullable', 'array'],
            'mapeo.*' => ['nullable', 'integer', 'min:0', 'max:500'],
            'sede_id' => ['nullable', 'integer', Rule::in($this->sedesPorDefecto()->modelKeys())],
            'sucursal_id' => ['nullable', 'integer', Rule::exists('sucursales', 'id')->where('sede_id', $request->integer('sede_id'))->where('activo', true)->whereNull('deleted_at')],
            'incluir' => ['nullable', 'array', 'max:500'],
            'incluir.*' => ['string', 'max:150'],
        ], [
            'sede_id.in' => 'Elige una sede activa de una empresa que reciba servicios logísticos.',
            'sucursal_id.exists' => 'Elige una sucursal activa de la sede elegida.',
        ]);

        // Cada ajuste llega por separado desde la revisión: solo se toca lo que viene en la petición
        $cambios = [];

        if ($request->has('sede_id')) {
            $cambios['opciones'] = [...($carga->opciones ?? []), 'sede_id' => $datos['sede_id'] ?? null, 'sucursal_id' => $datos['sucursal_id'] ?? null];
        }

        if ($request->has('incluir')) {
            $cambios['opciones'] = [...($cambios['opciones'] ?? $carga->opciones ?? []), 'incluir' => array_values(array_unique($datos['incluir'] ?? []))];
        }

        if ($request->filled('hoja') && $datos['hoja'] !== $carga->hoja) {
            // Otra hoja = otros encabezados: se vuelve a detectar el mapeo
            $cambios['hoja'] = $datos['hoja'];
            $cambios['mapeo_columnas'] = null;
        } elseif (array_key_exists('mapeo', $datos)) {
            $cambios['mapeo_columnas'] = collect(MapeoColumnas::CAMPOS)
                ->keys()
                ->mapWithKeys(fn ($campo) => [$campo => isset($datos['mapeo'][$campo]) ? (int) $datos['mapeo'][$campo] : null])
                ->all();
        }

        $carga->update($cambios);

        return to_route('cargas.show', $carga);
    }

    public function confirmar(Carga $carga): RedirectResponse
    {
        try {
            $r = $this->importador->importar($carga);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $informes = count($r['informes']);

        return to_route('cargas.show', $carga)->with('success', "Se importaron {$r['ordenes']} órdenes y se ".($informes === 1 ? 'actualizó 1 informe diario' : "actualizaron {$informes} informes diarios").'.');
    }

    /** Descarta una carga que aún está en revisión (no se importó nada). */
    public function destroy(Carga $carga): RedirectResponse
    {
        abort_unless($carga->enRevision(), 409, 'Solo se puede descartar una carga en revisión. Para deshacer una importación, anúlala.');

        Storage::disk('local')->delete($carga->archivo_path);
        Bitacora::registrar('descartada', $carga, ['archivo' => $carga->archivo_nombre]);
        $carga->delete();

        return to_route('cargas.index')->with('success', 'Se descartó la carga. No se importó ninguna orden.');
    }

    public function anular(Carga $carga): RedirectResponse
    {
        abort_if($carga->enRevision() || $carga->estado === EstadoCarga::Anulada, 409);

        try {
            $this->importador->anular($carga);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return to_route('cargas.show', $carga)->with('success', 'Carga anulada: se retiraron sus órdenes y se recalcularon los informes.');
    }

    private function revision(Carga $carga, array $base): Response
    {
        try {
            ['lectura' => $lectura, 'mapeo' => $mapeo, 'analisis' => $analisis] = $this->importador->analizar($carga);
        } catch (RuntimeException $e) {
            return Inertia::render('cargas/revision', ['carga' => $base, 'errorLectura' => $e->getMessage()]);
        }

        // Primer valor no vacío de cada columna, para reconocerla al mapear
        $muestras = [];
        foreach ($lectura['encabezados'] as $i => $h) {
            foreach ($lectura['filas'] as $f) {
                $v = $f['valores'][$i] ?? null;
                if ($v !== null && trim((string) $v) !== '') {
                    $muestras[$i] = mb_substr((string) $v, 0, 60);
                    break;
                }
            }
        }

        unset($analisis['ordenes']);

        return Inertia::render('cargas/revision', [
            'carga' => [...$base, 'opciones' => ($carga->opciones ?? []) + ['sede_id' => null, 'sucursal_id' => null, 'incluir' => []]],
            'lectura' => [
                'hojas' => $lectura['hojas'],
                'hoja' => $lectura['hoja'],
                'filaEncabezados' => $lectura['filaEncabezados'],
                'columnas' => collect($lectura['encabezados'])->map(fn ($h, $i) => [
                    'indice' => $i,
                    'encabezado' => $h !== '' ? $h : 'Columna '.($i + 1),
                    'muestra' => $muestras[$i] ?? null,
                ])->values(),
            ],
            'campos' => collect(MapeoColumnas::CAMPOS)->map(fn ($c, $clave) => [
                'clave' => $clave,
                'etiqueta' => $c[0],
                'obligatorio' => $c[1],
                'columna' => $mapeo[$clave] ?? null,
            ])->values(),
            'analisis' => $analisis,
            // Sede por defecto para las órdenes sin plan ni cliente corporativo reconocible
            'sedes' => $this->sedesPorDefecto()
                ->map(fn (Sede $s) => ['id' => $s->id, 'nombre' => $s->nombre, 'empresa' => $s->empresa?->nombre, 'sucursales' => $s->sucursales->map->only(['id', 'nombre'])]),
        ]);
    }

    /**
     * La carga es a día vencido: se espera la jornada operativa anterior
     * (los domingos no se opera, así que el lunes se espera la del sábado).
     */
    private function jornadaPendiente(): ?string
    {
        $esperada = today()->subDay();
        if ($esperada->isSunday()) {
            $esperada->subDay();
        }

        $cargada = Orden::whereDate('fecha_operacion', $esperada)->exists();

        return $cargada ? null : $esperada->toDateString();
    }

    /**
     * Sedes que se pueden elegir como destino por defecto de una preliquidación: activas, de empresas activas
     * que reciben servicios logísticos (las demás quedarían por fuera del tablero de la línea), con sus
     * sucursales activas.
     *
     * @return Collection<int, Sede>
     */
    private function sedesPorDefecto(): Collection
    {
        return Sede::query()
            ->where('activo', true)
            ->whereHas('empresa', fn ($q) => $q->where('activo', true)->whereHas('lineas', fn ($l) => $l->where('modulo', LineaServicio::LOGISTICA)))
            ->with(['empresa:id,nombre', 'sucursales' => fn ($q) => $q->where('activo', true)->orderBy('nombre')->select('id', 'sede_id', 'nombre')])
            ->orderBy('nombre')
            ->get(['id', 'empresa_id', 'nombre']);
    }
}
