<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Rol;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UsuarioRequest;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
            'sucursal' => ['nullable', 'integer'],
            'linea' => ['nullable', 'integer'],
        ]);

        $usuarios = User::query()
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'linea:id,nombre'])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->when($filtros['rol'] ?? null, fn (Builder $q, string $rol) => $q->where('rol', $rol))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->when($filtros['empresa'] ?? null, fn (Builder $q, int $id) => $q->where('empresa_id', $id))
            ->when($filtros['sede'] ?? null, fn (Builder $q, int $id) => $q->where('sede_id', $id))
            ->when($filtros['sucursal'] ?? null, fn (Builder $q, int $id) => $q->where('sucursal_id', $id))
            ->when($filtros['linea'] ?? null, fn (Builder $q, int $id) => $q->where('linea_servicio_id', $id))
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
                'empresaId' => $u->empresa_id,
                'empresa' => $u->empresa?->nombre,
                'sedeId' => $u->sede_id,
                'sede' => $u->sede?->nombre,
                'sucursalId' => $u->sucursal_id,
                'sucursal' => $u->sucursal?->nombre,
                // La versión en la dirección evita que el navegador muestre el carnet anterior tras reemplazarlo
                'carnet' => $u->carnet_path ? route('usuarios.carnet', ['usuario' => $u->id, 'v' => substr(md5($u->carnet_path), 0, 8)]) : null,
                'lineaId' => $u->linea_servicio_id,
                'linea' => $u->linea?->nombre,
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
                'sucursal' => (string) ($filtros['sucursal'] ?? ''),
                'linea' => (string) ($filtros['linea'] ?? ''),
            ],
            // Empresa, sede y sucursal llegan desde los conteos de sus páginas: se muestran como filtro quitable
            'contexto' => [
                'empresa' => isset($filtros['empresa']) ? Empresa::withTrashed()->whereKey($filtros['empresa'])->value('nombre') : null,
                'sede' => isset($filtros['sede']) ? Sede::withTrashed()->whereKey($filtros['sede'])->value('nombre') : null,
                'sucursal' => isset($filtros['sucursal']) ? Sucursal::withTrashed()->whereKey($filtros['sucursal'])->value('nombre') : null,
                'linea' => isset($filtros['linea']) ? LineaServicio::whereKey($filtros['linea'])->value('nombre') : null,
            ],
            'roles' => array_map(fn (Rol $r) => ['valor' => $r->value, 'label' => $r->label(), 'descripcion' => $r->descripcion()], Rol::cases()),
            // Cada empresa con las líneas que recibe: el formulario solo ofrece las de la línea elegida
            'empresas' => Empresa::with('lineas:id')->orderBy('nombre')->get(['id', 'nombre', 'activo'])->map(fn (Empresa $c) => [
                'id' => $c->id,
                'nombre' => $c->nombre,
                'activo' => $c->activo,
                'lineas' => $c->lineas->pluck('id'),
            ]),
            'lineas' => LineaServicio::ordenadas()->get(['id', 'slug', 'nombre']),
            'sedes' => Sede::orderBy('nombre')->get(['id', 'nombre', 'empresa_id', 'activo'])->map(fn (Sede $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'empresaId' => $s->empresa_id,
                'activo' => $s->activo,
            ]),
            // Sin sede son las sucursales propias de Justo a Tiempo
            'sucursales' => Sucursal::orderBy('nombre')->get(['id', 'nombre', 'ciudad', 'sede_id', 'activo'])->map(fn (Sucursal $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'ciudad' => $s->ciudad,
                'sedeId' => $s->sede_id,
                'activo' => $s->activo,
            ]),
        ]);
    }

    public function store(UsuarioRequest $request): RedirectResponse
    {
        $usuario = User::create([...$request->datos(), 'activo' => true]);
        // Lo crea el administrador: el correo ya se da por verificado
        $usuario->markEmailAsVerified();
        $this->guardarCarnet($request, $usuario);

        return back()->with('success', "Usuario creado: {$usuario->name} ya puede ingresar con su correo.");
    }

    public function update(UsuarioRequest $request, User $usuario): RedirectResponse
    {
        $datos = $request->datos();
        $usuario->update($datos);
        $this->guardarCarnet($request, $usuario);

        // Contraseña nueva: las sesiones abiertas con la anterior dejan de valer (menos la de quien edita)
        if (array_key_exists('password', $datos)) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $usuario->id)
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        return back()->with('success', "Cambios guardados en {$usuario->name}.");
    }

    /** Imagen del carnet, solo para la administración (no hay dirección pública para estos archivos). */
    public function carnet(User $usuario): StreamedResponse
    {
        abort_unless($usuario->carnet_path && Storage::disk('local')->exists($usuario->carnet_path), 404);

        $nombre = 'carnet-'.Str::slug($usuario->name).'.'.pathinfo($usuario->carnet_path, PATHINFO_EXTENSION);

        return Storage::disk('local')->response($usuario->carnet_path, $nombre, [
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Guarda el carnet nuevo o lo quita; el archivo anterior se borra una vez guardado el cambio. */
    private function guardarCarnet(UsuarioRequest $request, User $usuario): void
    {
        $anterior = $usuario->carnet_path;

        if ($request->hasFile('carnet')) {
            $usuario->update(['carnet_path' => $request->file('carnet')->store("carnets/{$usuario->id}", 'local')]);
        } elseif ($request->boolean('quitar_carnet')) {
            $usuario->update(['carnet_path' => null]);
        } else {
            return;
        }

        if ($anterior && $anterior !== $usuario->carnet_path) {
            Storage::disk('local')->delete($anterior);
        }
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
