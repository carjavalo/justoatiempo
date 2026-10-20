<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RolRequest;
use App\Models\RolUsuario;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Roles dentro de la empresa (auxiliar, conductor, supervisor…). Cada uno dice qué puede hacer en la plataforma
 * quien lo tenga: lo mismo que un administrador, un coordinador o un auxiliar.
 */
class RolController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'nivel' => ['nullable', Rule::enum(Rol::class)],
            'estado' => ['nullable', Rule::in(['activos', 'inactivos'])],
        ]);

        $roles = RolUsuario::query()
            ->withCount('usuarios')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $q->where('nombre', 'like', '%'.addcslashes($texto, '%_\\').'%');
            })
            ->when($filtros['nivel'] ?? null, fn (Builder $q, string $nivel) => $q->where('nivel', $nivel))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (RolUsuario $r) => [
                'id' => $r->id,
                'nombre' => $r->nombre,
                'descripcion' => $r->descripcion,
                'nivel' => $r->nivel->value,
                'nivelLabel' => $r->nivel->label(),
                'base' => $r->base,
                'activo' => $r->activo,
                'usuarios' => $r->usuarios_count,
            ]);

        return Inertia::render('roles/index', [
            'roles' => $roles,
            'total' => RolUsuario::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'nivel' => $filtros['nivel'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            'niveles' => array_map(fn (Rol $r) => ['valor' => $r->value, 'label' => $r->label(), 'descripcion' => $r->descripcion()], Rol::cases()),
        ]);
    }

    public function store(RolRequest $request): RedirectResponse
    {
        $rol = RolUsuario::create([...$request->validated(), 'activo' => true]);

        return back()->with('success', "Rol creado: {$rol->nombre}. Ya puedes asignarlo al crear usuarios.");
    }

    public function update(RolRequest $request, RolUsuario $rol): RedirectResponse
    {
        $rol->update($request->validated());

        return back()->with('success', "Cambios guardados en el rol {$rol->nombre}.");
    }

    public function estado(Request $request, RolUsuario $rol): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];

        if ($rol->base && ! $activo) {
            return back()->with('error', 'Es un rol base de la plataforma: no se desactiva.');
        }

        $rol->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "El rol {$rol->nombre} está activo de nuevo."
            : "El rol {$rol->nombre} quedó inactivo: ya no se ofrece al crear usuarios (quienes lo tienen lo conservan).");
    }
}
