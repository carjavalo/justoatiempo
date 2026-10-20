<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AsignacionRequest;
use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Asignaciones: dónde presta el servicio cada persona (una o varias empresas, con su sede y su sucursal), qué
 * líneas hace allí y por cuánto tiempo. Va aparte de la creación de usuarios; quien asigna solo ve y asigna dentro
 * de lo que su rol le deja ver.
 */
class AsignacionController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'empresa' => ['nullable', 'integer'],
            'linea' => ['nullable', 'integer'],
            'estado' => ['nullable', Rule::in(['vigentes', 'programadas', 'terminadas', 'sin'])],
            'usuario' => ['nullable', 'integer'],
        ]);
        $yo = $request->user();
        $estado = $filtros['estado'] ?? '';

        // Las de la lista: las actuales (vigentes y programadas) o las del estado elegido, con los filtros
        // (recibe una consulta o la relación de cada persona)
        $deLaLista = fn ($q) => $q
            ->tap(fn (Builder $a) => match ($estado) {
                'vigentes' => $a->vigentes(),
                'programadas' => $a->programadas(),
                'terminadas' => $a->terminadas(),
                default => $a->where(fn (Builder $w) => $w->whereNull('asignaciones.fecha_fin')->orWhereDate('asignaciones.fecha_fin', '>=', today()->toDateString())),
            })
            ->when($filtros['empresa'] ?? null, fn (Builder $a, int $id) => $a->where('asignaciones.empresa_id', $id))
            ->when($filtros['linea'] ?? null, fn (Builder $a, int $id) => $a->whereHas('lineas', fn ($l) => $l->whereKey($id)));
        $actuales = fn (Builder $q) => $q->where(fn (Builder $w) => $w->whereNull('asignaciones.fecha_fin')->orWhereDate('asignaciones.fecha_fin', '>=', today()->toDateString()));

        $personas = User::query()
            ->alcanceDe($yo)
            ->with('rolUsuario:id,nombre,clave,permisos,alcance')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('cedula', 'like', $like));
            })
            ->when($filtros['usuario'] ?? null, fn (Builder $q, int $id) => $q->whereKey($id))
            ->when(
                $estado === 'sin',
                // Personas activas que hoy no tienen dónde prestar el servicio
                fn (Builder $q) => $q->where('activo', true)->whereDoesntHave('asignaciones', $actuales),
                fn (Builder $q) => $q->when(! ($filtros['usuario'] ?? null), fn ($p) => $p->whereHas('asignaciones', $deLaLista)),
            )
            ->with(['asignaciones' => fn ($q) => $deLaLista($q)
                ->with(['lineas:id,slug,nombre,orden', 'empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre'])
                ->orderBy('fecha_inicio')])
            ->orderByDesc('activo')
            ->orderBy('primer_apellido')
            ->orderBy('nombres')
            ->paginate(12)
            ->withQueryString()
            ->through(fn (User $u) => [
                'id' => $u->id,
                'nombre' => $u->name,
                'cargo' => $u->cargo ?: $u->nombreRol(),
                'rol' => $u->nombreRol(),
                'activo' => $u->activo,
                // La foto la entrega la administración de usuarios: solo con ese permiso
                'foto' => $u->foto_path && $yo->puede('usuarios.ver') ? route('usuarios.foto', ['usuario' => $u->id]) : null,
                // A quién puede asignar: a quien cubre y nunca a sí mismo (salvo quien lo ve todo)
                'asignable' => $u->activo && $yo->cubreA($u) && (! $u->is($yo) || $yo->sinLimites()) && $yo->puede('asignaciones.crear'),
                // Solo las asignaciones que caben en lo que ve quien mira
                'asignaciones' => $u->asignaciones
                    ->filter(fn (Asignacion $a) => $yo->sinLimites() || $yo->veAsignacion($a))
                    ->values()
                    ->map(fn (Asignacion $a) => $this->fila($a, $yo->cubreA($u) && (! $u->is($yo) || $yo->sinLimites()))),
            ]);

        // Resumen de lo que ve: vigentes, programadas, las que terminan en una semana y quién no tiene asignación
        $visibles = Asignacion::query()
            ->whereIn('user_id', User::query()->alcanceDe($yo)->select('users.id'))
            ->tap($actuales)
            ->with('lineas:id')
            ->get(['id', 'user_id', 'empresa_id', 'sede_id', 'sucursal_id', 'fecha_inicio', 'fecha_fin'])
            ->filter(fn (Asignacion $a) => $yo->sinLimites() || $yo->veAsignacion($a));

        $limites = $this->limites($yo);

        return Inertia::render('asignaciones/index', [
            'personas' => $personas,
            'filtros' => [
                'q' => $filtros['q'] ?? '',
                'empresa' => (string) ($filtros['empresa'] ?? ''),
                'linea' => (string) ($filtros['linea'] ?? ''),
                'estado' => $estado,
                'usuario' => (string) ($filtros['usuario'] ?? ''),
            ],
            'resumen' => [
                'vigentes' => $visibles->filter(fn (Asignacion $a) => $a->estado() === 'vigente')->count(),
                'programadas' => $visibles->filter(fn (Asignacion $a) => $a->estado() === 'programada')->count(),
                'terminanPronto' => $visibles->filter(fn (Asignacion $a) => $a->estado() === 'vigente' && $a->fecha_fin && $a->fecha_fin->lte(today()->addDays(7)))->count(),
                'sinAsignacion' => User::query()->alcanceDe($yo)->where('activo', true)->whereDoesntHave('asignaciones', $actuales)->count(),
            ],
            // Para el formulario: solo lo que quien asigna puede elegir
            'opciones' => [
                'personas' => User::query()->alcanceDe($yo)->where('activo', true)->with('rolUsuario:id,nombre,clave,permisos,alcance')
                    ->orderBy('primer_apellido')->orderBy('nombres')->get()
                    ->filter(fn (User $u) => $yo->cubreA($u) && (! $u->is($yo) || $yo->sinLimites()))
                    ->values()
                    ->map(fn (User $u) => ['id' => $u->id, 'nombre' => $u->name, 'detalle' => $u->cargo ?: $u->nombreRol()]),
                'empresas' => $limites['empresas'],
                'sedes' => $limites['sedes'],
                'sucursales' => $limites['sucursales'],
                'lineas' => $limites['lineas'],
                'sinEmpresa' => $limites['sinEmpresa'],
                'duraciones' => collect(Asignacion::DURACIONES)->map(fn ($texto, $valor) => ['valor' => $valor, 'texto' => $texto])->values(),
            ],
            // Filtros: las empresas y líneas que ve
            'empresasFiltro' => collect($limites['empresas'])->map(fn ($e) => ['id' => $e['id'], 'nombre' => $e['nombre']]),
        ]);
    }

    public function store(AsignacionRequest $request): RedirectResponse
    {
        $persona = User::findOrFail($request->integer('usuario_id'));
        DB::transaction(function () use ($request, $persona) {
            $asignacion = Asignacion::create([...$request->datos(), 'user_id' => $persona->id, 'creada_por' => $request->user()->id]);
            $asignacion->lineas()->sync($request->lineas());
        });

        return back()->with('success', "{$persona->name} quedó asignado. Ya aparece en su carnet mientras la asignación esté vigente.");
    }

    public function update(AsignacionRequest $request, Asignacion $asignacion): RedirectResponse
    {
        DB::transaction(function () use ($request, $asignacion) {
            $asignacion->update($request->datos());
            $asignacion->lineas()->sync($request->lineas());
        });

        return back()->with('success', "Cambios guardados en la asignación de {$asignacion->usuario->name}.");
    }

    /**
     * Termina una asignación: queda hasta ayer. Si aún no empezaba (o empezó hoy), se quita: nunca llegó a aplicar.
     */
    public function terminar(Request $request, Asignacion $asignacion): RedirectResponse
    {
        $yo = $request->user();
        $persona = $asignacion->usuario;
        if (($persona->is($yo) && ! $yo->sinLimites()) || ! $yo->cubreA($persona) || ! $yo->veAsignacion($asignacion->load('lineas'))) {
            return back()->with('error', 'No puedes terminar esta asignación: está fuera de lo que tu rol te deja cambiar.');
        }
        if ($asignacion->estado() === 'terminada') {
            return back()->with('error', 'Esta asignación ya había terminado.');
        }

        if ($asignacion->fecha_inicio->gte(today())) {
            $asignacion->delete();

            return back()->with('success', "Se quitó la asignación de {$persona->name} en {$asignacion->lugar()}: aún no había empezado.");
        }

        $asignacion->update(['fecha_fin' => today()->subDay()->toDateString(), 'duracion' => 'fechas', 'duracion_cantidad' => null]);

        return back()->with('success', "La asignación de {$persona->name} en {$asignacion->lugar()} terminó: ya no aparece en su carnet.");
    }

    /** @return array<string, mixed> */
    private function fila(Asignacion $a, bool $editable): array
    {
        return [
            'id' => $a->id,
            'empresaId' => $a->empresa_id,
            'empresa' => $a->empresa?->nombre,
            'sedeId' => $a->sede_id,
            'sede' => $a->sede?->nombre,
            'sucursalId' => $a->sucursal_id,
            'sucursal' => $a->sucursal?->nombre,
            'lineas' => $a->lineas->map(fn (LineaServicio $l) => ['id' => $l->id, 'slug' => $l->slug, 'nombre' => $l->nombre]),
            'fechaInicio' => $a->fecha_inicio->toDateString(),
            'fechaFin' => $a->fecha_fin?->toDateString(),
            'duracion' => $a->duracion,
            'cantidad' => $a->duracion_cantidad,
            'duracionTexto' => $a->textoDuracion(),
            'estado' => $a->estado(),
            'editable' => $editable,
        ];
    }

    /**
     * Lo que quien asigna puede elegir: las empresas (con sus líneas), sedes y sucursales de lo que ve, las líneas en
     * las que trabaja (o todas) y si puede asignar sin empresa (a toda una línea).
     *
     * @return array{empresas: array, sedes: array, sucursales: array, lineas: array, sinEmpresa: bool}
     */
    private function limites(User $yo): array
    {
        $lineas = LineaServicio::ordenadas()
            ->when(! $yo->rolPermite(Permisos::TODAS_LAS_LINEAS) && ! $yo->sinLimites(), fn ($q) => $q->whereIn('id', $yo->lineasIds()))
            ->get(['id', 'slug', 'nombre']);
        $alcance = $yo->alcanceEn();

        $empresas = Empresa::with('lineas:id')->orderBy('nombre')->get(['id', 'nombre', 'activo'])
            ->filter(fn (Empresa $e) => $alcance->todo || in_array($e->id, $alcance->empresas(), true) || $lineas->contains(fn ($l) => $yo->alcanceEn($l)->todo));
        $sedes = Sede::whereIn('empresa_id', $empresas->pluck('id'))->orderBy('nombre')->get(['id', 'nombre', 'empresa_id', 'activo'])
            ->filter(fn (Sede $s) => $yo->sinLimites() || $lineas->contains(fn ($l) => $yo->alcanceEn($l)->incluye($s->empresa_id, $s->id)) || $alcance->incluye($s->empresa_id, $s->id));
        $sucursales = Sucursal::orderBy('nombre')->get(['id', 'nombre', 'ciudad', 'sede_id', 'activo'])
            ->filter(fn (Sucursal $s) => $s->sede_id === null || $sedes->contains('id', $s->sede_id));

        return [
            'empresas' => $empresas->values()->map(fn (Empresa $e) => ['id' => $e->id, 'nombre' => $e->nombre, 'activo' => $e->activo, 'lineas' => $e->lineas->pluck('id')])->all(),
            'sedes' => $sedes->values()->map(fn (Sede $s) => ['id' => $s->id, 'nombre' => $s->nombre, 'empresaId' => $s->empresa_id, 'activo' => $s->activo])->all(),
            'sucursales' => $sucursales->values()->map(fn (Sucursal $s) => ['id' => $s->id, 'nombre' => $s->nombre, 'ciudad' => $s->ciudad, 'sedeId' => $s->sede_id, 'activo' => $s->activo])->all(),
            'lineas' => $lineas->map(fn (LineaServicio $l) => ['id' => $l->id, 'slug' => $l->slug, 'nombre' => $l->nombre])->all(),
            'sinEmpresa' => $yo->sinLimites() || $lineas->contains(fn ($l) => $yo->alcanceEn($l)->todo),
        ];
    }
}
