<?php

namespace App\Http\Controllers;

use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Support\OperacionLinea;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Novedades y seguimiento de cada línea: lo que pasa en la operación (una llegada tarde, una queja del cliente, un
 * faltante de insumos…), quién da el seguimiento hasta cerrarla y la acción de desempeño que se toma, si hay una.
 */
class NovedadController extends Controller
{
    public function index(Request $request, LineaServicio $linea): Response
    {
        $op = OperacionLinea::para($request->user(), $linea, 'novedades.ver');
        $filtros = $request->validate([
            // Sin estado: las que no se han cerrado
            'estado' => ['nullable', Rule::in(array_keys(NovedadLinea::ESTADOS))],
            'lugar' => ['nullable', 'string', 'max:40'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $estado = $filtros['estado'] ?? null;
        $lugar = $op->lugarDe($filtros['lugar'] ?? null);
        $texto = trim($filtros['q'] ?? '');

        $base = fn (): Builder => $op->filtrar(NovedadLinea::query(), 'novedades_linea')->where('linea_servicio_id', $linea->id);
        $novedades = $base()
            ->when($estado === null, fn ($q) => $q->where('estado', '!=', 'cerrada'))
            ->when($estado !== null, fn ($q) => $q->where('estado', $estado))
            ->when($lugar, fn ($q) => $q->where('empresa_id', $lugar['empresa_id'])
                ->when($lugar['sede_id'], fn ($s, int $id) => $s->where('sede_id', $id))
                ->when($lugar['sucursal_id'], fn ($s, int $id) => $s->where('sucursal_id', $id)))
            ->when($texto !== '', fn ($q) => $q->where(fn ($w) => $w->where('tipo', 'like', '%'.addcslashes($texto, '%_\\').'%')
                ->orWhere('descripcion', 'like', '%'.addcslashes($texto, '%_\\').'%')
                ->orWhereHas('persona', fn ($p) => $p->where('name', 'like', '%'.addcslashes($texto, '%_\\').'%')->orWhere('cedula', 'like', '%'.addcslashes($texto, '%_\\').'%'))))
            // Primero las abiertas y las graves; luego las más recientes
            ->orderByRaw("case estado when 'abierta' then 0 when 'en_seguimiento' then 1 else 2 end")
            ->orderByRaw("case gravedad when 'grave' then 0 when 'leve' then 1 else 2 end")
            ->orderByDesc('fecha')->orderByDesc('id')
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'persona:id,name,cedula', 'registradaPor:id,name', 'cerradaPor:id,name', 'acciones.registradoPor:id,name'])
            ->paginate(20)
            ->withQueryString()
            ->through(fn (NovedadLinea $n) => [
                'id' => $n->id,
                'fecha' => $n->fecha->toDateString(),
                'lugar' => $n->lugar(),
                'personaId' => $n->user_id,
                'persona' => $n->persona?->name,
                'cedula' => $n->persona?->cedula,
                'tipo' => $n->tipo,
                'gravedad' => $n->gravedad,
                'descripcion' => $n->descripcion,
                'estado' => $n->estado,
                'seguimiento' => $n->seguimiento,
                'registradaPor' => $n->registradaPor?->name,
                'registradaEn' => $n->created_at?->toIso8601String(),
                'cerradaPor' => $n->cerradaPor?->name,
                'cerradaEn' => $n->cerrada_en?->toIso8601String(),
                'acciones' => $n->acciones->map(fn (AccionDesempeno $a) => ['id' => $a->id, 'tipo' => $a->tipo->value, 'texto' => $a->tipo->label(), 'fecha' => $a->fecha->toDateString(), 'descripcion' => $a->descripcion, 'registradaPor' => $a->registradoPor?->name])->values(),
            ]);

        $conteo = $base()->selectRaw('estado, count(*) as total')->groupBy('estado')->pluck('total', 'estado');

        return Inertia::render('lineas/novedades', [
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre, 'icono' => $linea->icono],
            'novedades' => $novedades,
            'filtros' => ['estado' => $estado ?? '', 'lugar' => $lugar['clave'] ?? '', 'q' => $texto],
            'conteo' => ['abierta' => (int) ($conteo['abierta'] ?? 0), 'en_seguimiento' => (int) ($conteo['en_seguimiento'] ?? 0), 'cerrada' => (int) ($conteo['cerrada'] ?? 0)],
            'lugares' => $op->lugares()->map(fn ($l) => ['valor' => $l['clave'], 'texto' => $l['nombre'], 'detalle' => $l['detalle']])->values(),
            'personas' => $this->personas($op),
            'tipos' => collect(NovedadLinea::TIPOS)->map(fn ($gravedad, $tipo) => ['valor' => $tipo, 'gravedad' => $gravedad])->values(),
            'gravedades' => collect(NovedadLinea::GRAVEDADES)->map(fn ($texto, $valor) => ['valor' => $valor, 'texto' => $texto])->values(),
            'estados' => collect(NovedadLinea::ESTADOS)->map(fn ($texto, $valor) => ['valor' => $valor, 'texto' => $texto])->values(),
            'tiposAccion' => TipoAccion::opciones(),
            'hoy' => today()->toDateString(),
        ]);
    }

    public function store(Request $request, LineaServicio $linea): RedirectResponse
    {
        $op = OperacionLinea::para($request->user(), $linea, 'novedades.registrar');
        $datos = $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'lugar' => ['required', 'string'],
            'user_id' => ['nullable', 'integer'],
            'tipo' => ['required', 'string', 'max:80'],
            'gravedad' => ['required', Rule::in(array_keys(NovedadLinea::GRAVEDADES))],
            'descripcion' => ['required', 'string', 'max:2000'],
        ], [
            'fecha.before_or_equal' => 'La novedad es de hoy o de un día anterior.',
            'lugar.required' => 'Elige dónde pasó.',
            'tipo.required' => 'Elige el tipo de novedad.',
            'descripcion.required' => 'Cuenta qué pasó.',
        ]);
        $lugar = $op->lugarDe($datos['lugar']);
        if (! $lugar) {
            throw ValidationException::withMessages(['lugar' => 'Elige uno de los lugares de la lista.']);
        }
        if (! empty($datos['user_id']) && ! collect($this->personas($op))->contains(fn ($p) => $p['id'] === (int) $datos['user_id'] && in_array($lugar['clave'], $p['lugares'], true))) {
            throw ValidationException::withMessages(['user_id' => 'Esta persona no trabaja en ese lugar en la línea.']);
        }

        NovedadLinea::create([
            'linea_servicio_id' => $linea->id,
            'fecha' => $datos['fecha'],
            'empresa_id' => $lugar['empresa_id'],
            'sede_id' => $lugar['sede_id'],
            'sucursal_id' => $lugar['sucursal_id'],
            'user_id' => $datos['user_id'] ?? null,
            'tipo' => trim($datos['tipo']),
            'gravedad' => $datos['gravedad'],
            'descripcion' => trim($datos['descripcion']),
            'estado' => 'abierta',
            'registrada_por' => $request->user()->id,
        ]);

        return back()->with('success', 'Novedad registrada: queda abierta hasta que se le dé seguimiento.');
    }

    /** El seguimiento: en qué va, cómo se cerró y, si se toma, la acción de desempeño con la persona. */
    public function seguimiento(Request $request, NovedadLinea $novedad): RedirectResponse
    {
        $yo = $request->user();
        $op = OperacionLinea::para($yo, $novedad->linea, 'novedades.cerrar');
        abort_unless($op->incluye($novedad->empresa_id, $novedad->sede_id, $novedad->sucursal_id), 404);

        $datos = $request->validate([
            'estado' => ['required', Rule::in(array_keys(NovedadLinea::ESTADOS))],
            'seguimiento' => ['nullable', 'string', 'max:2000', 'required_if:estado,cerrada'],
            'accion' => ['nullable', Rule::in(TipoAccion::values())],
            'accion_descripcion' => ['nullable', 'string', 'max:500'],
        ], ['seguimiento.required_if' => 'Para cerrarla, cuenta cómo se resolvió.', 'accion.in' => 'Elige una de las acciones de la lista.']);

        if (! empty($datos['accion'])) {
            if (! $novedad->user_id) {
                throw ValidationException::withMessages(['accion' => 'La novedad no tiene una persona: no se le puede registrar una acción.']);
            }
            if ($novedad->user_id === $yo->id) {
                throw ValidationException::withMessages(['accion' => 'No puedes registrarte acciones a ti mismo.']);
            }
        }

        DB::transaction(function () use ($novedad, $datos, $yo) {
            $cerrada = $datos['estado'] === 'cerrada';
            $novedad->update([
                'estado' => $datos['estado'],
                'seguimiento' => trim((string) ($datos['seguimiento'] ?? '')) ?: null,
                'cerrada_por' => $cerrada ? ($novedad->cerrada_por ?? $yo->id) : null,
                'cerrada_en' => $cerrada ? ($novedad->cerrada_en ?? now()) : null,
            ]);

            if (! empty($datos['accion'])) {
                AccionDesempeno::create([
                    'user_id' => $novedad->user_id,
                    'linea_servicio_id' => $novedad->linea_servicio_id,
                    'novedad_id' => $novedad->id,
                    'fecha' => today(),
                    'tipo' => TipoAccion::from($datos['accion']),
                    'descripcion' => trim((string) ($datos['accion_descripcion'] ?? '')) ?: "Por la novedad «{$novedad->tipo}» del {$novedad->fecha->format('d/m/Y')}.",
                    'notificado' => false,
                    'registrado_por' => $yo->id,
                ]);
            }
        });

        return back()->with('success', match ($datos['estado']) {
            'cerrada' => 'Novedad cerrada.',
            'en_seguimiento' => 'Seguimiento guardado: la novedad queda en seguimiento.',
            default => 'Seguimiento guardado.',
        }.(! empty($datos['accion']) ? ' Se registró la acción de desempeño.' : ''));
    }

    /**
     * Las personas de la línea que ve, con los lugares donde pueden trabajar (para elegir a quién le pasó).
     *
     * @return list<array{id: int, nombre: string, detalle: string, lugares: list<string>}>
     */
    private function personas(OperacionLinea $op): array
    {
        $asignaciones = $op->alcance->filtrarAsignaciones(Asignacion::vigentes()->whereHas('lineas', fn ($q) => $q->whereKey($op->linea->id)))
            ->whereHas('usuario', fn ($q) => $q->where('activo', true))
            ->with('usuario:id,name,cedula,cargo')
            ->get(['id', 'user_id', 'empresa_id', 'sede_id', 'sucursal_id']);
        $lugares = $op->lugares();

        return $asignaciones->groupBy('user_id')->map(function (Collection $suyas) use ($lugares) {
            $u = $suyas->first()->usuario;
            $claves = $lugares->filter(fn ($l) => $suyas->contains(fn (Asignacion $a) => $a->empresa_id === null || ($a->empresa_id === $l['empresa_id']
                && ($l['sede_id'] === null || $a->sede_id === null || $a->sede_id === $l['sede_id'])
                && ($l['sucursal_id'] === null || $a->sucursal_id === null || $a->sucursal_id === $l['sucursal_id']))))->pluck('clave')->values()->all();

            return ['id' => $u->id, 'nombre' => $u->name, 'detalle' => trim(($u->cargo ?? '').($u->cedula ? " · C.C. {$u->cedula}" : ''), ' ·'), 'lugares' => $claves];
        })->sortBy('nombre')->values()->all();
    }
}
