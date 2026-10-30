<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UsuarioRequest;
use App\Models\AccionDesempeno;
use App\Models\Asignacion;
use App\Models\AuditoriaPod;
use App\Models\Bitacora;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\Evidencia;
use App\Models\InformeDiario;
use App\Models\InformeLinea;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Orden;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\SolicitudContacto;
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
            'acceso' => ['nullable', Rule::in(['con', 'sin'])],
            'empresa' => ['nullable', 'integer'],
            'sede' => ['nullable', 'integer'],
            'sucursal' => ['nullable', 'integer'],
            'linea' => ['nullable', 'integer'],
        ]);

        $yo = $request->user();
        // Filtros desde los conteos de empresas, sedes, sucursales y líneas: quien tiene ahí una asignación vigente
        $enLugar = fn (string $columna, int $id) => fn (Builder $q) => $q->whereHas('asignacionesVigentes', fn ($a) => $columna === 'linea'
            ? $a->whereHas('lineas', fn ($l) => $l->whereKey($id))
            : $a->where("asignaciones.{$columna}", $id));

        $usuarios = User::query()
            ->alcanceDe($yo)
            ->with(['rolUsuario:id,nombre,clave,permisos,alcance,base,nivel'])
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('cedula', 'like', $like));
            })
            ->when($filtros['rol'] ?? null, fn (Builder $q, int|string $rol) => $q->where('rol_id', (int) $rol))
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->when($filtros['acceso'] ?? null, fn (Builder $q, string $acceso) => $q->where('acceso', $acceso === 'con'))
            ->when($filtros['empresa'] ?? null, fn (Builder $q, int $id) => $q->tap($enLugar('empresa_id', $id)))
            ->when($filtros['sede'] ?? null, fn (Builder $q, int $id) => $q->tap($enLugar('sede_id', $id)))
            ->when($filtros['sucursal'] ?? null, fn (Builder $q, int $id) => $q->tap($enLugar('sucursal_id', $id)))
            ->when($filtros['linea'] ?? null, fn (Builder $q, int $id) => $q->tap($enLugar('linea', $id)))
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
                'acceso' => $u->acceso,
                'tieneContrasena' => filled($u->password),
                // Aún con la contraseña inicial (su cédula)
                'contrasenaInicial' => $u->acceso && $u->debe_cambiar_contrasena,
                'telefono' => $u->telefono,
                'ciudad' => $u->ciudad,
                'fechaNacimiento' => $u->fecha_nacimiento?->toDateString(),
                'fechaIngreso' => $u->fecha_ingreso?->toDateString(),
                // Su rol dentro de la empresa
                'rolId' => $u->rol_id,
                'rolNombre' => $u->nombreRol(),
                'todasLasLineas' => $u->rolPermite(Permisos::TODAS_LAS_LINEAS),
                // Dónde presta el servicio hoy (sus asignaciones vigentes que quien mira alcanza a ver)
                'asignaciones' => $u->vigentes()
                    ->filter(fn (Asignacion $a) => $yo->sinLimites() || $yo->veAsignacion($a))
                    ->values()
                    ->map(fn (Asignacion $a) => ['lugar' => $a->lugar(), 'lineas' => $a->lineas->pluck('nombre')]),
                'foto' => $this->direccionFoto($u),
                'arl' => $this->direccionArl($u),
                'arlEsPdf' => Carnet::esPdf($u->arl_path),
                'activo' => $u->activo,
                'ultimoAcceso' => $u->ultimo_acceso_en?->toIso8601String(),
                'esUsted' => $u->is($request->user()),
                // Solo se edita o desactiva a quien tiene, como mucho, los mismos permisos que uno
                'editable' => $request->user()->cubreA($u),
            ]);

        return Inertia::render('usuarios/index', [
            'usuarios' => $usuarios,
            'total' => User::query()->alcanceDe($yo)->count(),
            'filtros' => [
                'q' => $filtros['q'] ?? '',
                'rol' => (string) ($filtros['rol'] ?? ''),
                'estado' => $filtros['estado'] ?? '',
                'acceso' => $filtros['acceso'] ?? '',
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
                'asignable' => (bool) $yo->rolUsuario?->cubre($r),
                'activo' => $r->activo,
            ]),
            'lineas' => LineaServicio::ordenadas()->get(['id', 'slug', 'nombre']),
        ]);
    }

    public function store(UsuarioRequest $request): RedirectResponse
    {
        $usuario = User::create([...$request->datos(), 'activo' => true]);
        // Lo crea el administrador: el correo ya se da por verificado
        if ($usuario->email) {
            $usuario->markEmailAsVerified();
        }
        $this->guardarArchivos($request, $usuario);

        // Lo siguiente es decir dónde presta el servicio: se abre Asignaciones con la persona elegida
        if ($request->user()->puede('asignaciones.crear') && $request->user()->cubreA($usuario)) {
            return to_route('asignaciones.index', ['usuario' => $usuario->id, 'nueva' => 1])
                ->with('success', "Persona registrada: {$usuario->name}. Ahora elige dónde presta el servicio y qué líneas hace.");
        }

        return back()->with('success', $usuario->acceso
            ? "Usuario creado: {$usuario->name} ya puede ingresar con su correo."
            : "Persona registrada: {$usuario->name}, con su carnet y sin acceso a la plataforma.");
    }

    public function update(UsuarioRequest $request, User $usuario): RedirectResponse
    {
        $datos = $request->datos();
        $usuario->update($datos);
        $this->guardarArchivos($request, $usuario);

        // Contraseña nueva (o sin acceso): las sesiones abiertas con la anterior dejan de valer (menos la de quien edita)
        if (array_key_exists('password', $datos)) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $usuario->id)
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        return back()->with('success', "Cambios guardados en {$usuario->name}.");
    }

    /** Foto de una persona que quien mira alcanza a ver (cada quien ve la suya en Mi carnet). */
    public function foto(Request $request, User $usuario): StreamedResponse
    {
        abort_unless($request->user()->alcanza($usuario), 404);

        return Carnet::respuestaFoto($usuario);
    }

    /** Certificado de ARL de una persona que quien mira alcanza a ver. */
    public function arl(Request $request, User $usuario): StreamedResponse
    {
        abort_unless($request->user()->alcanza($usuario), 404);

        return Carnet::respuestaArl($usuario);
    }

    /** El carnet de la persona, armado con su foto y sus datos sobre el diseño de la empresa. */
    public function carnet(Request $request, User $usuario): Response
    {
        abort_unless($request->user()->alcanza($usuario), 404);

        return Inertia::render('carnet/ver', [
            'persona' => Carnet::datos($usuario, $this->direccionFoto($usuario), $this->direccionArl($usuario)),
            'propio' => false,
            // Si quien mira puede completarle lo que falte
            'editable' => $request->user()->puede('usuarios.editar') && $request->user()->cubreA($usuario),
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
            return back()->with('error', "{$usuario->name} tiene más acceso que tu rol: no puedes cambiar su acceso.");
        }
        if (! $activo && ($error = $this->unicoAdministrador($usuario))) {
            return back()->with('error', $error);
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

    /**
     * Elimina a una persona registrada por error: solo si nunca ha operado. Con historial (entregas, programación o lo
     * que hizo en la plataforma) se desactiva, porque esos registros dicen quién los hizo. Sus asignaciones se van con ella.
     */
    public function destroy(Request $request, User $usuario): RedirectResponse
    {
        if ($usuario->is($request->user())) {
            return back()->with('error', 'No puedes eliminar tu propio usuario.');
        }
        if (! $request->user()->cubreA($usuario)) {
            return back()->with('error', "{$usuario->name} tiene más acceso que tu rol: no puedes eliminarlo.");
        }
        if ($error = $this->unicoAdministrador($usuario)) {
            return back()->with('error', $error);
        }
        $enUso = "{$usuario->name} tiene historial en la operación: no se puede eliminar. Desactívalo para conservarlo.";
        if ($this->tieneHistorial($usuario)) {
            return back()->with('error', $enUso);
        }

        $archivos = array_filter([$usuario->foto_path, $usuario->arl_path]);
        $id = $usuario->id;

        return $this->eliminarRegistro($usuario, $usuario->name, $enUso, function () use ($archivos, $id) {
            Storage::disk('local')->delete($archivos);
            DB::table(config('session.table', 'sessions'))->where('user_id', $id)->delete();
        });
    }

    /** Siempre queda al menos una persona activa, con acceso, con el rol Administrador: el aviso si esta es la última. */
    private function unicoAdministrador(User $usuario): ?string
    {
        $administrador = RolUsuario::administrador();
        if (! $administrador || $usuario->rol_id !== $administrador->id
            || User::where('rol_id', $administrador->id)->where('activo', true)->where('acceso', true)->whereKeyNot($usuario->id)->exists()) {
            return null;
        }

        return "{$usuario->name} es la única persona con el rol {$administrador->nombre} que puede entrar a la plataforma: dáselo antes a otra persona.";
    }

    /** Sus entregas, su programación, lo que le pasó y lo que hizo en la plataforma. */
    private function tieneHistorial(User $usuario): bool
    {
        $referencias = [
            [Orden::class, 'auxiliar_id'], [InformeLinea::class, 'auxiliar_id'], [ProgramacionAsignacion::class, 'user_id'], [ProgramacionAsignacion::class, 'asistencia_por'],
            [Programacion::class, 'creado_por'], [AccionDesempeno::class, 'user_id'], [AccionDesempeno::class, 'registrado_por'], [NovedadLinea::class, 'user_id'],
            [NovedadLinea::class, 'registrada_por'], [NovedadLinea::class, 'cerrada_por'], [Carga::class, 'cargado_por'], [Carga::class, 'anulada_por'],
            [AuditoriaPod::class, 'auditado_por'], [Evidencia::class, 'subido_por'], [InformeDiario::class, 'cerrado_por'], [SolicitudContacto::class, 'atendida_por_id'],
            [Bitacora::class, 'user_id'],
        ];

        return collect($referencias)->contains(fn (array $r) => $r[0]::where($r[1], $usuario->id)->exists());
    }
}
