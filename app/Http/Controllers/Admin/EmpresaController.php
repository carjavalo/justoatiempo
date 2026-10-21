<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\EmpresaRequest;
use App\Models\Empresa;
use App\Models\LineaServicio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Empresas clientes (p. ej. Ditranza): el contrato, con su NIT, su contacto y las líneas que reciben. */
class EmpresaController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'estado' => ['nullable', Rule::in(['activas', 'inactivas'])],
        ]);

        $empresas = Empresa::query()
            ->with('lineas:id')
            // Su personal: quienes tienen hoy una asignación en ella
            ->withCount(['sedes', 'asignaciones as usuarios_count' => fn ($q) => $q->vigentes()->select(DB::raw('count(distinct asignaciones.user_id)'))])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                // El NIT se guarda sin puntos: se buscan también los dígitos escritos con puntos
                $nit = '%'.addcslashes(str_replace(['.', ' '], '', $texto), '%_\\').'%';
                $q->where(fn (Builder $w) => $w
                    ->where('nombre', 'like', $like)
                    ->orWhere('nit', 'like', $nit)
                    ->orWhere('contacto_nombre', 'like', $like)
                    ->orWhere('contacto_email', 'like', $like));
            })
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activas'))
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Empresa $c) => [
                'id' => $c->id,
                'nombre' => $c->nombre,
                'nit' => $c->nit,
                'contactoNombre' => $c->contacto_nombre,
                'contactoEmail' => $c->contacto_email,
                'contactoTelefono' => $c->contacto_telefono,
                'activo' => $c->activo,
                'sedes' => $c->sedes_count,
                'usuarios' => $c->usuarios_count,
                'lineas' => $c->lineas->pluck('id'),
            ]);

        return Inertia::render('empresas/index', [
            'empresas' => $empresas,
            'total' => Empresa::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            // Una línea inactiva solo se muestra en la empresa que ya la recibe
            'lineas' => LineaServicio::ordenadas()->get(['id', 'slug', 'nombre', 'icono', 'activa']),
        ]);
    }

    public function store(EmpresaRequest $request): RedirectResponse
    {
        $empresa = Empresa::create([...$request->datos(), 'activo' => true]);
        $empresa->lineas()->sync($request->lineas());

        return back()->with('success', "Empresa creada: {$empresa->nombre}. Ya puedes registrar sus sedes.");
    }

    public function update(EmpresaRequest $request, Empresa $empresa): RedirectResponse
    {
        $empresa->update($request->datos());
        $empresa->lineas()->sync($request->lineas());

        return back()->with('success', "Cambios guardados en {$empresa->nombre}.");
    }

    public function estado(Request $request, Empresa $empresa): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];
        $empresa->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "{$empresa->nombre} está activa de nuevo."
            : "{$empresa->nombre} quedó inactiva: no recibirá nuevas sedes ni usuarios.");
    }
}
