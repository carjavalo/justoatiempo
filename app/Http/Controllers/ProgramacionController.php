<?php

namespace App\Http\Controllers;

use App\Enums\EstadoAsistencia;
use App\Models\LineaServicio;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\InformeLinea\JornadaLinea;
use App\Support\OperacionLinea;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Programación diaria de cada línea de servicio: cuántas personas se requieren en cada empresa, sede o sucursal,
 * quiénes van (con su turno y, en logística, su vehículo y su ruta) y su asistencia.
 */
class ProgramacionController extends Controller
{
    public function index(Request $request, LineaServicio $linea): Response
    {
        $op = OperacionLinea::para($request->user(), $linea, 'programacion.ver');
        $filtros = $request->validate(['fecha' => ['nullable', 'date_format:Y-m-d'], 'lugar' => ['nullable', 'string', 'max:40']]);
        $fecha = Carbon::parse($filtros['fecha'] ?? today());
        $lugar = $op->lugarDe($filtros['lugar'] ?? null);

        $programaciones = $op->filtrar(Programacion::query(), 'programaciones')
            ->where('linea_servicio_id', $linea->id)
            ->whereDate('fecha', $fecha)
            ->when($lugar, fn ($q) => $q->where('empresa_id', $lugar['empresa_id'])
                ->when($lugar['sede_id'], fn ($s, int $id) => $s->where('sede_id', $id))
                ->when($lugar['sucursal_id'], fn ($s, int $id) => $s->where('sucursal_id', $id)))
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'asignaciones.persona:id,name,cedula,cargo', 'asignaciones.vehiculo:id,placa', 'asignaciones.registradaPor:id,name'])
            ->get()
            ->sortBy(fn (Programacion $p) => $p->lugar())
            ->values();

        // A quién se puede programar en cada lugar (y si ya está en otro lugar ese día)
        $enOtroLugar = $programaciones->flatMap(fn (Programacion $p) => $p->asignaciones->map(fn ($a) => [$a->user_id, $p->lugar()]))
            ->groupBy(0)->map(fn ($v) => $v->pluck(1)->all());

        $filas = $programaciones->map(function (Programacion $p) use ($op, $fecha, $enOtroLugar) {
            $personas = $p->asignaciones->sortBy(fn ($a) => ($a->hora_entrada ?? '99').'|'.$a->persona?->name)->values();
            $presentes = $personas->filter(fn ($a) => $a->asistencia?->presente())->count();

            return [
                'id' => $p->id,
                'lugar' => $p->lugar(),
                'clave' => OperacionLinea::clave($p->empresa_id, $p->sede_id, $p->sucursal_id),
                'requeridas' => $p->personas_requeridas,
                'vehiculos' => $p->vehiculos_requeridos,
                'observaciones' => $p->observaciones,
                'presentes' => $presentes,
                'personas' => $personas->map(fn (ProgramacionAsignacion $a) => [
                    'id' => $a->id,
                    'userId' => $a->user_id,
                    'nombre' => $a->persona?->name ?? 'Persona eliminada',
                    'detalle' => trim(($a->persona?->cargo ?? '').($a->persona?->cedula ? " · C.C. {$a->persona->cedula}" : ''), ' ·'),
                    'entrada' => $a->hora_entrada ? substr($a->hora_entrada, 0, 5) : null,
                    'salida' => $a->hora_salida ? substr($a->hora_salida, 0, 5) : null,
                    'vehiculoId' => $a->vehiculo_id,
                    'placa' => $a->vehiculo?->placa,
                    'ruta' => $a->ruta,
                    'asistencia' => $a->asistencia?->value,
                    'llegada' => $a->hora_llegada ? substr($a->hora_llegada, 0, 5) : null,
                    'observacion' => $a->observacion,
                    'registradaPor' => $a->registradaPor?->name,
                    // También programada en otro lugar ese día
                    'otrosLugares' => array_values(array_diff($enOtroLugar[$a->user_id] ?? [], [$p->lugar()])),
                ])->values(),
                'candidatos' => $op->personasEn($p->empresa_id, $p->sede_id, $p->sucursal_id, $fecha)
                    ->reject(fn (User $u) => $p->asignaciones->contains('user_id', $u->id))
                    ->map(fn (User $u) => [
                        'id' => $u->id,
                        'nombre' => $u->name,
                        'detalle' => trim(($u->cargo ?? '').($u->cedula ? " · C.C. {$u->cedula}" : ''), ' ·'),
                        'otrosLugares' => $enOtroLugar[$u->id] ?? [],
                    ])->values(),
            ];
        });

        $todas = $filas->flatMap(fn ($f) => $f['personas']);
        $registradas = $todas->whereNotNull('asistencia');

        // Para copiar: el último día anterior con programación en lo que ve
        $anterior = $op->filtrar(Programacion::query(), 'programaciones')->where('linea_servicio_id', $linea->id)
            ->whereDate('fecha', '<', $fecha)->max('fecha');

        return Inertia::render('lineas/programacion', [
            'linea' => ['id' => $linea->id, 'slug' => $linea->slug, 'nombre' => $linea->nombre, 'icono' => $linea->icono, 'logistica' => $linea->esLogistica()],
            'fecha' => $fecha->toDateString(),
            'esFutura' => $fecha->isAfter(today()),
            'filtros' => ['lugar' => $lugar['clave'] ?? ''],
            'lugares' => $op->lugares()->map(fn ($l) => ['valor' => $l['clave'], 'texto' => $l['nombre'], 'detalle' => $l['detalle']])->values(),
            'programaciones' => $filas,
            'resumen' => [
                'requeridas' => $filas->sum('requeridas'),
                'programadas' => $todas->count(),
                'presentes' => $registradas->filter(fn ($a) => EstadoAsistencia::from($a['asistencia'])->presente())->count(),
                'tarde' => $registradas->where('asistencia', EstadoAsistencia::Tarde->value)->count(),
                'faltas' => $registradas->where('asistencia', EstadoAsistencia::Falta->value)->count(),
                'justificadas' => $registradas->filter(fn ($a) => EstadoAsistencia::from($a['asistencia'])->justificada())->count(),
                'sinRegistrar' => $todas->whereNull('asistencia')->count(),
                'cobertura' => JornadaLinea::cobertura($filas->map(fn ($f) => ['requeridas' => $f['requeridas'], 'programadas' => $f['personas']->count(), 'presentes' => $f['presentes']])),
            ],
            'copiarDe' => $anterior ? Carbon::parse($anterior)->toDateString() : null,
            'estados' => EstadoAsistencia::opciones(),
            'vehiculos' => $linea->esLogistica()
                ? Vehiculo::where('activo', true)->orderBy('placa')->get(['id', 'placa', 'tipo'])->map(fn (Vehiculo $v) => ['valor' => (string) $v->id, 'texto' => $v->placa, 'detalle' => $v->tipo])
                : [],
        ]);
    }

    /** Programa un lugar ese día (o cambia cuántas personas requiere, si ya estaba programado). */
    public function store(Request $request, LineaServicio $linea): RedirectResponse
    {
        $op = OperacionLinea::para($request->user(), $linea, 'programacion.editar');
        $datos = $this->validar($request, $linea) + $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d'],
            'lugar' => ['required', 'string'],
        ], ['lugar.required' => 'Elige dónde se presta el servicio.']);
        $lugar = $op->lugarDe($datos['lugar']);
        if (! $lugar) {
            throw ValidationException::withMessages(['lugar' => 'Elige uno de los lugares de la lista.']);
        }

        $programacion = Programacion::firstOrNew([
            'fecha' => $datos['fecha'], 'linea_servicio_id' => $linea->id,
            'empresa_id' => $lugar['empresa_id'], 'sede_id' => $lugar['sede_id'], 'sucursal_id' => $lugar['sucursal_id'],
        ]);
        $nueva = ! $programacion->exists;
        $programacion->fill([
            'personas_requeridas' => $datos['personas_requeridas'],
            'vehiculos_requeridos' => $datos['vehiculos_requeridos'] ?? 0,
            'observaciones' => $datos['observaciones'],
            'creado_por' => $programacion->creado_por ?? $request->user()->id,
        ])->save();

        return back()->with('success', $nueva ? "{$lugar['nombre']} quedó programado: ahora agrega a las personas." : "Programación de {$lugar['nombre']} actualizada.");
    }

    public function update(Request $request, Programacion $programacion): RedirectResponse
    {
        $this->autorizar($request->user(), $programacion, 'programacion.editar');
        $programacion->update($this->validar($request, $programacion->linea));

        return back()->with('success', "Programación de {$programacion->lugar()} actualizada.");
    }

    public function destroy(Request $request, Programacion $programacion): RedirectResponse
    {
        $this->autorizar($request->user(), $programacion, 'programacion.editar');
        if ($programacion->asignaciones()->whereNotNull('asistencia')->exists()) {
            return back()->with('error', 'Ya tiene asistencia registrada: no se puede quitar. Quita primero a las personas que no fueron.');
        }
        $lugar = $programacion->lugar();
        $programacion->delete();

        return back()->with('success', "Se quitó la programación de {$lugar}.");
    }

    /** Copia la programación de otro día (lugares, personas y turnos; sin la asistencia) en los lugares aún sin programar. */
    public function copiar(Request $request, LineaServicio $linea): RedirectResponse
    {
        $op = OperacionLinea::para($request->user(), $linea, 'programacion.editar');
        $datos = $request->validate([
            'desde' => ['required', 'date_format:Y-m-d'],
            'fecha' => ['required', 'date_format:Y-m-d', 'different:desde'],
        ]);

        $origen = $op->filtrar(Programacion::query(), 'programaciones')->where('linea_servicio_id', $linea->id)
            ->whereDate('fecha', $datos['desde'])->with('asignaciones')->get();
        $yaProgramados = $op->filtrar(Programacion::query(), 'programaciones')->where('linea_servicio_id', $linea->id)
            ->whereDate('fecha', $datos['fecha'])->get()
            ->map(fn (Programacion $p) => OperacionLinea::clave($p->empresa_id, $p->sede_id, $p->sucursal_id));

        $copiadas = 0;
        DB::transaction(function () use ($origen, $yaProgramados, $datos, $linea, $request, $op, &$copiadas) {
            foreach ($origen as $p) {
                $clave = OperacionLinea::clave($p->empresa_id, $p->sede_id, $p->sucursal_id);
                if ($yaProgramados->contains($clave) || ! $op->incluye($p->empresa_id, $p->sede_id, $p->sucursal_id)) {
                    continue;
                }
                $nueva = Programacion::create([
                    ...$p->only(['empresa_id', 'sede_id', 'sucursal_id', 'personas_requeridas', 'vehiculos_requeridos', 'observaciones']),
                    'fecha' => $datos['fecha'], 'linea_servicio_id' => $linea->id, 'creado_por' => $request->user()->id,
                ]);
                // Solo quien aún puede trabajar allí ese día
                $disponibles = $op->personasEn($p->empresa_id, $p->sede_id, $p->sucursal_id, Carbon::parse($datos['fecha']))->pluck('id');
                foreach ($p->asignaciones->whereIn('user_id', $disponibles) as $a) {
                    $nueva->asignaciones()->create($a->only(['user_id', 'hora_entrada', 'hora_salida', 'vehiculo_id', 'ruta']));
                }
                $copiadas++;
            }
        });

        return back()->with($copiadas ? 'success' : 'error', $copiadas
            ? ($copiadas === 1 ? 'Se copió la programación de 1 lugar.' : "Se copió la programación de {$copiadas} lugares.")
            : 'No había nada que copiar: los lugares de ese día ya están programados.');
    }

    /** Agrega personas a la programación de un lugar, con el mismo turno. */
    public function agregarPersonas(Request $request, Programacion $programacion): RedirectResponse
    {
        $op = $this->autorizar($request->user(), $programacion, 'programacion.editar');
        $datos = $request->validate([
            'personas' => ['required', 'array', 'min:1', 'max:200'],
            'personas.*' => ['integer'],
            'hora_entrada' => ['nullable', 'date_format:H:i'],
            'hora_salida' => ['nullable', 'date_format:H:i'],
        ], ['personas.required' => 'Elige al menos una persona.', 'hora_entrada.date_format' => 'Escribe la hora como 07:00.', 'hora_salida.date_format' => 'Escribe la hora como 17:00.']);

        $disponibles = $op->personasEn($programacion->empresa_id, $programacion->sede_id, $programacion->sucursal_id, $programacion->fecha)->pluck('id');
        $elegidas = collect($datos['personas'])->unique()->filter(fn ($id) => $disponibles->contains($id));
        if ($elegidas->isEmpty()) {
            throw ValidationException::withMessages(['personas' => 'Esas personas no trabajan en este lugar en la línea.']);
        }

        foreach ($elegidas as $id) {
            $programacion->asignaciones()->firstOrCreate(['user_id' => $id], ['hora_entrada' => $datos['hora_entrada'] ?? null, 'hora_salida' => $datos['hora_salida'] ?? null]);
        }
        $n = $elegidas->count();

        return back()->with('success', $n === 1 ? 'Se agregó 1 persona a la programación.' : "Se agregaron {$n} personas a la programación.");
    }

    /** Cambia el turno (y en logística el vehículo y la ruta) de una persona programada. */
    public function actualizarPersona(Request $request, ProgramacionAsignacion $fila): RedirectResponse
    {
        $this->autorizar($request->user(), $fila->programacion, 'programacion.editar');
        $logistica = $fila->programacion->linea->esLogistica();
        $datos = $request->validate([
            'hora_entrada' => ['nullable', 'date_format:H:i'],
            'hora_salida' => ['nullable', 'date_format:H:i'],
            'vehiculo_id' => [Rule::excludeIf(! $logistica), 'nullable', 'integer', Rule::exists('vehiculos', 'id')->where('activo', true)],
            'ruta' => [Rule::excludeIf(! $logistica), 'nullable', 'string', 'max:120'],
        ], ['hora_entrada.date_format' => 'Escribe la hora como 07:00.', 'hora_salida.date_format' => 'Escribe la hora como 17:00.', 'vehiculo_id.exists' => 'Elige un vehículo activo de la flota.']);
        $fila->update($datos);

        return back()->with('success', "Turno de {$fila->persona?->name} actualizado.");
    }

    public function quitarPersona(Request $request, ProgramacionAsignacion $fila): RedirectResponse
    {
        $this->autorizar($request->user(), $fila->programacion, 'programacion.editar');
        $nombre = $fila->persona?->name ?? 'La persona';
        $fila->delete();

        return back()->with('success', "{$nombre} ya no está en la programación de este día.");
    }

    /** Registra (o quita) la asistencia de una persona programada. */
    public function asistencia(Request $request, ProgramacionAsignacion $fila): RedirectResponse
    {
        $this->autorizar($request->user(), $fila->programacion, 'programacion.asistencia');
        $this->noEsFutura($fila->programacion);
        $datos = $request->validate([
            'asistencia' => ['nullable', Rule::enum(EstadoAsistencia::class)],
            'hora_llegada' => ['nullable', 'date_format:H:i'],
            'observacion' => ['nullable', 'string', 'max:255'],
        ], ['hora_llegada.date_format' => 'Escribe la hora como 07:20.']);
        $estado = isset($datos['asistencia']) ? EstadoAsistencia::from($datos['asistencia']) : null;

        $fila->update([
            'asistencia' => $estado,
            // La hora de llegada solo dice algo si llegó tarde
            'hora_llegada' => $estado === EstadoAsistencia::Tarde ? ($datos['hora_llegada'] ?? null) : null,
            'observacion' => $estado ? (trim((string) ($datos['observacion'] ?? '')) ?: null) : null,
            'asistencia_por' => $estado ? $request->user()->id : null,
            'asistencia_en' => $estado ? now() : null,
        ]);

        return back()->with('success', $estado ? "{$fila->persona?->name}: {$estado->label()}." : "Se quitó la asistencia de {$fila->persona?->name}.");
    }

    /** Marca como presentes a todas las personas del lugar a las que aún no se les registra la asistencia. */
    public function asistenciaTodos(Request $request, Programacion $programacion): RedirectResponse
    {
        $this->autorizar($request->user(), $programacion, 'programacion.asistencia');
        $this->noEsFutura($programacion);
        $n = $programacion->asignaciones()->whereNull('asistencia')->update([
            'asistencia' => EstadoAsistencia::Asistio->value, 'asistencia_por' => $request->user()->id, 'asistencia_en' => now(),
        ]);

        return back()->with('success', $n === 1 ? '1 persona quedó presente.' : "{$n} personas quedaron presentes.");
    }

    /** @return array<string, mixed> */
    private function validar(Request $request, LineaServicio $linea): array
    {
        $datos = $request->validate([
            'personas_requeridas' => ['required', 'integer', 'min:0', 'max:500'],
            'vehiculos_requeridos' => [Rule::excludeIf(! $linea->esLogistica()), 'nullable', 'integer', 'min:0', 'max:200'],
            'observaciones' => ['nullable', 'string', 'max:500'],
        ], ['personas_requeridas.required' => 'Escribe cuántas personas se requieren.']);
        $datos['observaciones'] = trim((string) ($datos['observaciones'] ?? '')) ?: null;

        return $datos;
    }

    private function autorizar(User $user, Programacion $programacion, string $permiso): OperacionLinea
    {
        $op = OperacionLinea::para($user, $programacion->linea, $permiso);
        abort_unless($op->incluye($programacion->empresa_id, $programacion->sede_id, $programacion->sucursal_id), 404);

        return $op;
    }

    private function noEsFutura(Programacion $programacion): void
    {
        if ($programacion->fecha->isAfter(today())) {
            throw ValidationException::withMessages(['asistencia' => 'Ese día aún no llega: la asistencia se registra el mismo día o después.']);
        }
    }
}
