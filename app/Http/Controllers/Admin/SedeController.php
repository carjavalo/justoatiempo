<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SedeRequest;
use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\Parametro;
use App\Models\Sede;
use App\Support\Retiro;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Sedes de cada empresa: los clientes que la empresa atiende (TuGo y Sodimac, de Ditransa). */
class SedeController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'empresa' => ['nullable', 'integer'],
            'estado' => ['nullable', Rule::in(['activas', 'inactivas'])],
        ]);

        $sedes = Sede::query()
            ->with('empresa:id,nombre')
            ->withCount('sucursales')
            // Quienes trabajan en ella: asignados a la sede o a toda su empresa (como la programa la operación)
            ->addSelect(['usuarios_count' => Asignacion::vigentes()
                ->selectRaw('count(distinct asignaciones.user_id)')
                ->where(fn (Builder $w) => $w->whereColumn('asignaciones.sede_id', 'sedes.id')
                    ->orWhere(fn (Builder $e) => $e->whereColumn('asignaciones.empresa_id', 'sedes.empresa_id')->whereNull('asignaciones.sede_id'))),
            ])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('nombre', 'like', $like)->orWhere('codigo', 'like', $like));
            })
            ->when($filtros['empresa'] ?? null, fn (Builder $q, int|string $empresa) => $q->where('empresa_id', (int) $empresa))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activas'))
            // Agrupadas por empresa: la lista las muestra bajo el nombre de cada una
            ->orderBy(DB::table('empresas')->select('nombre')->whereColumn('empresas.id', 'sedes.empresa_id'))
            ->orderBy('empresa_id')
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Sede $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'empresaId' => $s->empresa_id,
                'empresa' => $s->empresa?->nombre,
                'codigo' => $s->codigo,
                'meta' => (float) $s->meta_efectividad,
                'activo' => $s->activo,
                'sucursales' => $s->sucursales_count,
                'usuarios' => $s->usuarios_count,
            ]);

        return Inertia::render('sedes/index', [
            'sedes' => $sedes,
            'total' => Sede::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'empresa' => (string) ($filtros['empresa'] ?? ''), 'estado' => $filtros['estado'] ?? ''],
            'empresas' => Empresa::orderBy('nombre')->get(['id', 'nombre', 'activo']),
            // La meta con la que nace una sede nueva (Parámetros)
            'metaPorDefecto' => (float) Parametro::valor('meta_efectividad_global', 95),
        ]);
    }

    public function store(SedeRequest $request): RedirectResponse
    {
        $sede = Sede::create([...$request->datos(), 'empresa_id' => $request->empresa()->id, 'activo' => true]);

        return back()->with('success', "Sede creada: {$sede->nombre}. Ya puedes registrar sus sucursales.");
    }

    public function update(SedeRequest $request, Sede $sede): RedirectResponse
    {
        $empresa = $request->empresa();
        $traslado = $empresa->id !== $sede->empresa_id;

        DB::transaction(function () use ($request, $sede, $empresa) {
            $sede->update($request->datos());
            // Si cambia de empresa, su personal pasa con ella
            $sede->trasladarA($empresa);
        });

        return back()->with('success', $traslado
            ? "La sede {$sede->nombre} ahora es de {$empresa->nombre}, con sus sucursales y su personal."
            : "Cambios guardados en la sede {$sede->nombre}.");
    }

    public function estado(Request $request, Sede $sede): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];
        $sede->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "La sede {$sede->nombre} está activa de nuevo."
            : "La sede {$sede->nombre} quedó inactiva: no recibirá nuevas sucursales ni usuarios.");
    }

    /**
     * Se elimina sin borrar nada, con sus sucursales: quienes estaban asignados a la sede (o a una de sus sucursales)
     * quedan sin esa asignación, su programación por venir se quita y su operación pasada se conserva.
     */
    public function destroy(Sede $sede): RedirectResponse
    {
        return $this->eliminarRegistro($sede, "la sede {$sede->nombre}", function () use ($sede) {
            $sucursales = $sede->sucursales()->get();
            $sucursales->each->delete();

            return [...Retiro::lugar(fn ($q) => $q->where('sede_id', $sede->id)), 'sucursales_eliminadas' => $sucursales->pluck('id')->all()];
        });
    }
}
