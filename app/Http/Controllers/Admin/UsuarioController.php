<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UsuarioRequest;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Models\User;
use App\Services\Carnet;
use App\Support\Permisos;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            'rol' => ['nullable', 'integer'],
            'estado' => ['nullable', Rule::in(['activos', 'inactivos'])],
            'empresa' => ['nullable', 'integer'],
            'sede' => ['nullable', 'integer'],
            'sucursal' => ['nullable', 'integer'],
            'linea' => ['nullable', 'integer'],
        ]);

        $usuarios = User::query()
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'linea:id,nombre', 'rolUsuario:id,nombre,permisos,alcance,base,nivel'])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('cedula', 'like', $like));
            })
            ->when($filtros['rol'] ?? null, fn (Builder $q, int|string $rol) => $q->where('rol_id', (int) $rol))
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
                'cedula' => $u->cedula,
                'cargo' => $u->cargo,
                'email' => $u->email,
                // Su rol dentro de la empresa; sin línea, si su rol las ve todas
                'rolId' => $u->rol_id,
                'rolNombre' => $u->nombreRol(),
                'todasLasLineas' => $u->rolPermite(Permisos::TODAS_LAS_LINEAS),
                'empresaId' => $u->empresa_id,
                'empresa' => $u->empresa?->nombre,
                'sedeId' => $u->sede_id,
                'sede' => $u->sede?->nombre,
                'sucursalId' => $u->sucursal_id,
                'sucursal' => $u->sucursal?->nombre,
                'foto' => $this->direccionFoto($u),
                'arl' => $this->direccionArl($u),
                'arlEsPdf' => Carnet::esPdf($u->arl_path),
                'lineaId' => $u->linea_servicio_id,
                'linea' => $u->linea?->nombre,
                'activo' => $u->activo,
                'ultimoAcceso' => $u->ultimo_acceso_en?->toIso8601String(),
                'esUsted' => $u->is($request->user()),
                // Solo se edita o desactiva a quien tiene, como mucho, los mismos permisos que uno
                'editable' => $request->user()->cubreA($u),
            ]);

        return Inertia::render('usuarios/index', [
            'usuarios' => $usuarios,
            'total' => User::count(),
            'filtros' => [
                'q' => $filtros['q'] ?? '',
                'rol' => (string) ($filtros['rol'] ?? ''),
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
            // Roles de la empresa con lo que permite cada uno; solo se asignan los que el propio rol cubre
            'roles' => RolUsuario::orderBy('nombre')->get()->map(fn (RolUsuario $r) => [
                'id' => $r->id,
                'nombre' => $r->nombre,
                'resumen' => $r->resumen(),
                'alcance' => Permisos::alcances()[$r->alcance] ?? '',
                'todasLasLineas' => $r->permite(Permisos::TODAS_LAS_LINEAS),
                'asignable' => (bool) $request->user()->rolUsuario?->cubre($r),
                'activo' => $r->activo,
            ]),
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
        $this->guardarArchivos($request, $usuario);

        return back()->with('success', "Usuario creado: {$usuario->name} ya puede ingresar con su correo.");
    }

    public function update(UsuarioRequest $request, User $usuario): RedirectResponse
    {
        $datos = $request->datos();
        $usuario->update($datos);
        $this->guardarArchivos($request, $usuario);

        // Contraseña nueva: las sesiones abiertas con la anterior dejan de valer (menos la de quien edita)
        if (array_key_exists('password', $datos)) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $usuario->id)
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        return back()->with('success', "Cambios guardados en {$usuario->name}.");
    }

    /** Foto de cualquier persona, para la administración (cada quien ve la suya en Mi carnet). */
    public function foto(User $usuario): StreamedResponse
    {
        return Carnet::respuestaFoto($usuario);
    }

    /** Certificado de ARL de cualquier persona, para la administración. */
    public function arl(User $usuario): StreamedResponse
    {
        return Carnet::respuestaArl($usuario);
    }

    /** El carnet de la persona, armado con su foto y sus datos sobre el diseño de la empresa. */
    public function carnet(User $usuario): Response
    {
        return Inertia::render('carnet/ver', [
            'persona' => Carnet::datos($usuario, $this->direccionFoto($usuario), $this->direccionArl($usuario)),
            'propio' => false,
        ]);
    }

    private function direccionFoto(User $usuario): ?string
    {
        return $usuario->foto_path ? route('usuarios.foto', ['usuario' => $usuario->id, 'v' => Carnet::version($usuario->foto_path)]) : null;
    }

    private function direccionArl(User $usuario): ?string
    {
        return $usuario->arl_path ? route('usuarios.arl', ['usuario' => $usuario->id, 'v' => Carnet::version($usuario->arl_path)]) : null;
    }

    /** La foto y el certificado de ARL que vengan en el formulario (nuevos o para quitar). */
    private function guardarArchivos(UsuarioRequest $request, User $usuario): void
    {
        $this->guardarArchivo($request, $usuario, 'foto', 'foto_path', 'fotos');
        if ($this->guardarArchivo($request, $usuario, 'arl', 'arl_path', 'arl')) {
            $usuario->update(['arl_subida_en' => $usuario->arl_path ? now() : null]);
        }
    }

    /**
     * Guarda el archivo nuevo de un campo o lo quita; el anterior se borra una vez guardado el cambio.
     * Devuelve si hubo cambio.
     */
    private function guardarArchivo(UsuarioRequest $request, User $usuario, string $campo, string $columna, string $carpeta): bool
    {
        $anterior = $usuario->{$columna};

        if ($request->hasFile($campo)) {
            $usuario->update([$columna => $request->file($campo)->store("{$carpeta}/{$usuario->id}", 'local')]);
        } elseif ($request->boolean("quitar_{$campo}")) {
            $usuario->update([$columna => null]);
        } else {
            return false;
        }

        if ($anterior && $anterior !== $usuario->{$columna}) {
            Storage::disk('local')->delete($anterior);
        }

        return true;
    }

    public function estado(Request $request, User $usuario): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];

        if ($usuario->is($request->user())) {
            return back()->with('error', 'No puedes desactivar tu propio usuario.');
        }
        if (! $request->user()->cubreA($usuario)) {
            return back()->with('error', "{$usuario->name} tiene permisos que tu rol no tiene: no puedes cambiar su acceso.");
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
