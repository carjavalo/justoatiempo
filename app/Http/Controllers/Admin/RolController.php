<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RolRequest;
use App\Models\RolUsuario;
use App\Support\Permisos;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Roles dentro de la empresa (auxiliar, conductor, supervisor…). Cada uno dice qué módulos ve quien lo tenga, qué
 * puede hacer en cada uno y qué alcance tiene de la operación (App\Support\Permisos).
 */
class RolController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'alcance' => ['nullable', Rule::in(array_keys(Permisos::alcances()))],
            'estado' => ['nullable', Rule::in(['activos', 'inactivos'])],
        ]);
        $miRol = $request->user()->rolUsuario;

        $roles = RolUsuario::query()
            ->withCount('usuarios')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $q->where('nombre', 'like', '%'.addcslashes($texto, '%_\\').'%');
            })
            ->when($filtros['alcance'] ?? null, fn (Builder $q, string $alcance) => $q->where('alcance', $alcance))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (RolUsuario $r) => [
                'id' => $r->id,
                'nombre' => $r->nombre,
                'descripcion' => $r->descripcion,
                'permisos' => $r->permisos ?? [],
                'alcance' => $r->alcance,
                'resumen' => $r->resumen(),
                'base' => $r->base,
                // El Administrador de la plataforma siempre lo puede todo: sus permisos no se cambian
                'fijo' => $r->esAdministradorBase(),
                'activo' => $r->activo,
                'usuarios' => $r->usuarios_count,
                // Solo se cambia un rol con, como mucho, los mismos permisos que el propio
                'editable' => (bool) $miRol?->cubre($r),
            ]);

        return Inertia::render('roles/index', [
            'roles' => $roles,
            'total' => RolUsuario::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'alcance' => $filtros['alcance'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            'catalogo' => Permisos::CATALOGO,
            'todasLasLineas' => Permisos::TODAS_LAS_LINEAS,
            'alcances' => array_map(
                fn (string $valor, string $label) => ['valor' => $valor, 'label' => $label, 'descripcion' => Permisos::descripcionAlcances()[$valor]],
                array_keys(Permisos::alcances()),
                Permisos::alcances(),
            ),
            // Lo que quien edita puede dar: los permisos y el alcance de su propio rol
            'miRol' => ['id' => $miRol?->id, 'permisos' => $miRol?->permisos ?? [], 'alcance' => $miRol?->alcance ?? Permisos::ALCANCE_PROPIO],
            // Para empezar un rol copiando los permisos de otro
            'modelos' => RolUsuario::orderBy('nombre')->get(['id', 'nombre', 'permisos', 'alcance'])->map(fn (RolUsuario $r) => [
                'id' => $r->id,
                'nombre' => $r->nombre,
                'permisos' => $r->permisos ?? [],
                'alcance' => $r->alcance,
            ]),
        ]);
    }

    public function store(RolRequest $request): RedirectResponse
    {
        $rol = RolUsuario::create([...$request->datos(), 'activo' => true]);

        return back()->with('success', "Rol creado: {$rol->nombre}. Ya puedes asignarlo al crear usuarios.");
    }

    public function update(RolRequest $request, RolUsuario $rol): RedirectResponse
    {
        $rol->update($request->datos());
        $personas = $rol->usuarios()->count();

        return back()->with('success', $personas > 0
            ? "Cambios guardados en el rol {$rol->nombre}: ya aplican a ".($personas === 1 ? 'la persona que lo tiene.' : "las {$personas} personas que lo tienen.")
            : "Cambios guardados en el rol {$rol->nombre}.");
    }

    public function estado(Request $request, RolUsuario $rol): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];

        if ($rol->base && ! $activo) {
            return back()->with('error', 'Es un rol base de la plataforma: no se desactiva.');
        }
        if (! $request->user()->rolUsuario?->cubre($rol)) {
            return back()->with('error', 'Este rol tiene permisos que el tuyo no tiene: no puedes cambiarlo.');
        }

        $rol->update(['activo' => $activo]);

        return back()->with('success', $activo
            ? "El rol {$rol->nombre} está activo de nuevo."
            : "El rol {$rol->nombre} quedó inactivo: ya no se ofrece al crear usuarios (quienes lo tienen lo conservan).");
    }

    /** Solo un rol que no es de la plataforma y que nadie tiene. */
    public function destroy(Request $request, RolUsuario $rol): RedirectResponse
    {
        if ($rol->base) {
            return back()->with('error', 'Es un rol base de la plataforma: no se elimina.');
        }
        if (! $request->user()->rolUsuario?->cubre($rol)) {
            return back()->with('error', 'Este rol tiene permisos que el tuyo no tiene: no puedes eliminarlo.');
        }
        $enUso = "El rol {$rol->nombre} lo tienen personas de la plataforma: dales otro rol antes de eliminarlo, o desactívalo.";
        if ($rol->usuarios()->exists()) {
            return back()->with('error', $enUso);
        }

        return $this->eliminarRegistro($rol, "el rol {$rol->nombre}", $enUso);
    }
}
