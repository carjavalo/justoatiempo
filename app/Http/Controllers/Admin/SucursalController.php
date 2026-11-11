<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SucursalRequest;
use App\Models\Asignacion;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Support\Retiro;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Sucursales de cada sede (Cali Sur, Cañasgordas…) y sucursales propias de Justo a Tiempo. */
class SucursalController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            // Id de una sede, o "propias" para las sucursales de Justo a Tiempo
            'sede' => ['nullable', 'regex:/^(propias|\d+)$/'],
            'estado' => ['nullable', Rule::in(['activas', 'inactivas'])],
        ]);

        $sucursales = Sucursal::query()
            ->with('sede:id,empresa_id,nombre', 'sede.empresa:id,nombre')
            // Quienes trabajan en ella: asignados a la sucursal, a toda su sede o a toda su empresa (como la programa la operación)
            ->addSelect(['usuarios_count' => Asignacion::vigentes()
                ->selectRaw('count(distinct asignaciones.user_id)')
                ->where(fn (Builder $w) => $w->whereColumn('asignaciones.sucursal_id', 'sucursales.id')
                    ->orWhere(fn (Builder $s) => $s->whereColumn('asignaciones.sede_id', 'sucursales.sede_id')->whereNull('asignaciones.sucursal_id'))
                    ->orWhere(fn (Builder $e) => $e->whereNull('asignaciones.sede_id')
                        ->whereIn('asignaciones.empresa_id', DB::table('sedes')->select('empresa_id')->whereColumn('sedes.id', 'sucursales.sede_id')))),
            ])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('nombre', 'like', $like)->orWhere('ciudad', 'like', $like)->orWhere('direccion', 'like', $like)->orWhere('alias_drivin', 'like', $like));
            })
            ->when($filtros['sede'] ?? null, fn (Builder $q, string $sede) => $sede === 'propias'
                ? $q->whereNull('sede_id')
                : $q->where('sede_id', (int) $sede))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activas'))
            // Agrupadas por sede (con su empresa) y las propias al final: la lista las muestra bajo cada una
            ->orderByRaw('sucursales.sede_id is null')
            ->orderBy(DB::table('sedes')->join('empresas', 'empresas.id', '=', 'sedes.empresa_id')->select('empresas.nombre')->whereColumn('sedes.id', 'sucursales.sede_id'))
            ->orderBy(DB::table('sedes')->select('nombre')->whereColumn('sedes.id', 'sucursales.sede_id'))
            ->orderBy('sede_id')
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Sucursal $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'ciudad' => $s->ciudad,
                'direccion' => $s->direccion,
                'aliasDrivin' => $s->alias_drivin,
                'sedeId' => $s->sede_id,
                'sede' => $s->sede?->nombre,
                'empresa' => $s->sede?->empresa?->nombre,
                'activo' => $s->activo,
                'usuarios' => $s->usuarios_count,
            ]);

        return Inertia::render('sucursales/index', [
            'sucursales' => $sucursales,
            'total' => Sucursal::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'sede' => $filtros['sede'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            'sedes' => Sede::with('empresa:id,nombre')->orderBy('nombre')->get(['id', 'empresa_id', 'nombre', 'activo'])
                ->map(fn (Sede $s) => ['id' => $s->id, 'nombre' => $s->nombre, 'activo' => $s->activo, 'empresa' => $s->empresa?->nombre]),
        ]);
    }

    public function store(SucursalRequest $request): RedirectResponse
    {
        $sucursal = Sucursal::create([...$request->datos(), 'activo' => true]);

        return back()->with('success', "Sucursal creada: {$sucursal->nombre}.");
    }

    public function update(SucursalRequest $request, Sucursal $sucursal): RedirectResponse
    {
        $sucursal->update($request->datos());

        return back()->with('success', "Cambios guardados en la sucursal {$sucursal->nombre}.");
    }

    public function estado(Request $request, Sucursal $sucursal): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];
        $sucursal->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "La sucursal {$sucursal->nombre} está activa de nuevo."
            : "La sucursal {$sucursal->nombre} quedó inactiva: no recibirá nuevos usuarios.");
    }

    /**
     * Se elimina sin borrar nada: quienes estaban asignados a ella quedan sin esa asignación (termina ayer y sigue en
     * su historial), su programación por venir se quita, y su operación pasada (órdenes, informes) se conserva.
     */
    public function destroy(Sucursal $sucursal): RedirectResponse
    {
        return $this->eliminarRegistro($sucursal, "la sucursal {$sucursal->nombre}", fn () => Retiro::lugar(fn ($q) => $q->where('sucursal_id', $sucursal->id)));
    }
}
