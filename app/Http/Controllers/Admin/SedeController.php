<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SedeRequest;
use App\Models\Cliente;
use App\Models\Sede;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Sedes de las empresas clientes y sedes propias de Justo a Tiempo. */
class SedeController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            // Id de una empresa, o "propias" para las sedes de Justo a Tiempo
            'empresa' => ['nullable', 'regex:/^(propias|\d+)$/'],
            'estado' => ['nullable', Rule::in(['activas', 'inactivas'])],
        ]);

        $sedes = Sede::query()
            ->with('cliente:id,nombre')
            ->withCount('usuarios')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('nombre', 'like', $like)->orWhere('ciudad', 'like', $like)->orWhere('direccion', 'like', $like));
            })
            ->when($filtros['empresa'] ?? null, fn (Builder $q, string $empresa) => $empresa === 'propias'
                ? $q->whereNull('cliente_id')
                : $q->where('cliente_id', (int) $empresa))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activas'))
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Sede $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'ciudad' => $s->ciudad,
                'direccion' => $s->direccion,
                'empresaId' => $s->cliente_id,
                'empresa' => $s->cliente?->nombre,
                'activo' => $s->activo,
                'usuarios' => $s->usuarios_count,
            ]);

        return Inertia::render('sedes/index', [
            'sedes' => $sedes,
            'total' => Sede::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'empresa' => $filtros['empresa'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            'empresas' => Cliente::orderBy('nombre')->get(['id', 'nombre', 'activo']),
        ]);
    }

    public function store(SedeRequest $request): RedirectResponse
    {
        $sede = Sede::create([...$request->datos(), 'activo' => true]);

        return back()->with('success', "Sede creada: {$sede->nombre}.");
    }

    public function update(SedeRequest $request, Sede $sede): RedirectResponse
    {
        $sede->update($request->datos());

        return back()->with('success', "Cambios guardados en la sede {$sede->nombre}.");
    }

    public function estado(Request $request, Sede $sede): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];
        $sede->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "La sede {$sede->nombre} está activa de nuevo."
            : "La sede {$sede->nombre} quedó inactiva: no recibirá nuevos usuarios.");
    }
}
