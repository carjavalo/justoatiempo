<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SedeRequest;
use App\Models\Empresa;
use App\Models\Parametro;
use App\Models\Sede;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Sedes de cada empresa: los clientes que la empresa atiende (TuGo y Sodimac, de Ditranza). */
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
            ->withCount(['sucursales', 'asignaciones as usuarios_count' => fn ($q) => $q->vigentes()->select(DB::raw('count(distinct asignaciones.user_id)'))])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('nombre', 'like', $like)->orWhere('codigo', 'like', $like));
            })
            ->when($filtros['empresa'] ?? null, fn (Builder $q, int|string $empresa) => $q->where('empresa_id', (int) $empresa))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activas'))
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
}
