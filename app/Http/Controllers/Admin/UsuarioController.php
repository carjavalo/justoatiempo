<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UsuarioRequest;
use App\Models\Cliente;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UsuarioController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'rol' => ['nullable', Rule::enum(Rol::class)],
            'estado' => ['nullable', Rule::in(['activos', 'inactivos'])],
            'empresa' => ['nullable', 'integer'],
            'sede' => ['nullable', 'integer'],
        ]);

        $usuarios = User::query()
            ->with(['empresa:id,nombre', 'sede:id,nombre'])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->when($filtros['rol'] ?? null, fn (Builder $q, string $rol) => $q->where('rol', $rol))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->when($filtros['empresa'] ?? null, fn (Builder $q, int $id) => $q->where('cliente_id', $id))
            ->when($filtros['sede'] ?? null, fn (Builder $q, int $id) => $q->where('sede_id', $id))
            ->orderByDesc('activo')
            ->orderBy('primer_apellido')
            ->orderBy('segundo_apellido')
            ->orderBy('nombres')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $u) => [
                'id' => $u->id,
                'nombre' => $u->name,
                'nombres' => $u->nombres,
                'primerApellido' => $u->primer_apellido,
                'segundoApellido' => $u->segundo_apellido,
                'email' => $u->email,
                'rol' => $u->rol->value,
                'rolLabel' => $u->rol->label(),
                'empresaId' => $u->cliente_id,
                'empresa' => $u->empresa?->nombre,
                'sedeId' => $u->sede_id,
                'sede' => $u->sede?->nombre,
                'activo' => $u->activo,
                'ultimoAcceso' => $u->ultimo_acceso_en?->toIso8601String(),
                'esUsted' => $u->is($request->user()),
            ]);

        return Inertia::render('usuarios/index', [
            'usuarios' => $usuarios,
            'total' => User::count(),
            'filtros' => [
                'q' => $filtros['q'] ?? '',
                'rol' => $filtros['rol'] ?? '',
                'estado' => $filtros['estado'] ?? '',
                'empresa' => (string) ($filtros['empresa'] ?? ''),
                'sede' => (string) ($filtros['sede'] ?? ''),
            ],
            // Empresa y sede llegan desde los conteos de Empresas y Sedes: se muestran como filtro quitable
            'contexto' => [
                'empresa' => isset($filtros['empresa']) ? Cliente::withTrashed()->whereKey($filtros['empresa'])->value('nombre') : null,
                'sede' => isset($filtros['sede']) ? Sede::withTrashed()->whereKey($filtros['sede'])->value('nombre') : null,
            ],
            'roles' => array_map(fn (Rol $r) => ['valor' => $r->value, 'label' => $r->label(), 'descripcion' => $r->descripcion()], Rol::cases()),
            'empresas' => Cliente::orderBy('nombre')->get(['id', 'nombre', 'activo']),
            'sedes' => Sede::orderBy('nombre')->get(['id', 'nombre', 'ciudad', 'cliente_id', 'activo'])->map(fn (Sede $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'ciudad' => $s->ciudad,
                'empresaId' => $s->cliente_id,
                'activo' => $s->activo,
            ]),
        ]);
    }

    public function store(UsuarioRequest $request): RedirectResponse
    {
        $usuario = User::create([...$request->datos(), 'activo' => true]);
        // Lo crea el administrador: el correo ya se da por verificado
        $usuario->markEmailAsVerified();

        return back()->with('success', "Usuario creado: {$usuario->name} ya puede ingresar con su correo.");
    }

    public function update(UsuarioRequest $request, User $usuario): RedirectResponse
    {
        $datos = $request->datos();
        $usuario->update($datos);

        // Contraseña nueva: las sesiones abiertas con la anterior dejan de valer (menos la de quien edita)
        if (array_key_exists('password', $datos)) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $usuario->id)
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        return back()->with('success', "Cambios guardados en {$usuario->name}.");
    }

    public function estado(Request $request, User $usuario): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];

        if ($usuario->is($request->user())) {
            return back()->with('error', 'No puedes desactivar tu propio usuario.');
        }

        $usuario->update(['activo' => $activo]);

        // Sin esperar a que caduque: quien queda inactivo pierde la sesión abierta
        if (! $activo) {
            DB::table(config('session.table', 'sessions'))->where('user_id', $usuario->id)->delete();
        }

        return back()->with('success', $activo
            ? "{$usuario->name} vuelve a tener acceso a la plataforma."
            : "{$usuario->name} ya no puede ingresar a la plataforma.");
    }
}
