<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use App\Models\RolUsuario;
use App\Services\ImportadorPersonal;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Importar el Excel del personal (auxiliares, conductores, operarios) en dos pasos: se sube y se revisa qué pasará
 * con cada fila; al confirmar, se registran las personas nuevas sin acceso a la plataforma y se completan los datos
 * de las que ya estaban.
 */
class ImportacionPersonalController extends Controller
{
    private const SESION = 'importacion_personal';

    public function __construct(private ImportadorPersonal $importador) {}

    public function index(Request $request): Response
    {
        $pendiente = $this->pendiente($request);
        $yo = $request->user();
        $revision = null;
        if ($pendiente) {
            try {
                $analisis = $this->importador->analizar($this->importador->leer(Storage::path($pendiente['ruta'])), $yo, $pendiente['empresas'] ?? []);
                // Lo que se confirme debe ser este mismo archivo (no otro que se subió en otra pestaña)
                $revision = ['archivo' => $pendiente['nombre'], 'token' => $this->token($pendiente), ...$analisis];
            } catch (RuntimeException $e) {
                $this->descartarArchivo($request);
                session()->now('error', $e->getMessage());
            }
        }

        $asignables = $this->importador->empresasAsignables($yo);

        return Inertia::render('usuarios/importar', [
            'revision' => $revision,
            // Roles que puede dar quien importa: los activos que su propio rol cubre
            'roles' => RolUsuario::where('activo', true)->orderBy('nombre')->get()
                ->filter(fn (RolUsuario $r) => (bool) $yo->rolUsuario?->cubre($r))
                ->values()
                ->map(fn (RolUsuario $r) => ['id' => $r->id, 'nombre' => $r->nombre, 'resumen' => $r->resumen()]),
            'rolPorDefecto' => RolUsuario::where('clave', 'auxiliar')->value('id'),
            'empresas' => Empresa::where('activo', true)->withCount('lineas')->orderBy('nombre')->get(['id', 'nombre'])
                ->map(fn (Empresa $e) => ['id' => $e->id, 'nombre' => $e->nombre, 'lineas' => $e->lineas_count, 'asignable' => in_array($e->id, $asignables, true)]),
            'puedeAsignar' => $yo->puede('asignaciones.crear'),
        ]);
    }

    /** Sube el archivo y lo deja listo para revisar. */
    public function revisar(Request $request): RedirectResponse
    {
        $request->validate(
            ['archivo' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120']],
            [
                'archivo.required' => 'Elige el archivo del personal.',
                'archivo.mimes' => 'El archivo debe ser un Excel (.xlsx o .xls) o un CSV.',
                'archivo.max' => 'El archivo no puede pesar más de 5 MB.',
                'archivo.uploaded' => 'No se pudo subir el archivo. Intenta de nuevo.',
            ],
        );

        $this->descartarArchivo($request);
        $archivo = $request->file('archivo');
        $ruta = $archivo->storeAs('importaciones', 'personal-'.Str::uuid().'.'.$archivo->getClientOriginalExtension());

        try {
            $this->importador->leer(Storage::path($ruta));
        } catch (RuntimeException $e) {
            Storage::delete($ruta);

            return back()->withErrors(['archivo' => $e->getMessage()]);
        }

        $request->session()->put(self::SESION, ['ruta' => $ruta, 'nombre' => $archivo->getClientOriginalName(), 'empresas' => []]);

        return to_route('usuarios.importar');
    }

    /** A qué empresa corresponde cada "operación" del archivo (se recalcula la revisión). */
    public function empresas(Request $request): RedirectResponse
    {
        $pendiente = $this->pendiente($request);
        abort_unless($pendiente, 404);

        $datos = $request->validate([
            'token' => ['required', 'string'],
            'empresas' => ['present', 'array'],
            'empresas.*' => ['nullable', 'integer', Rule::exists('empresas', 'id')],
        ]);
        if ($datos['token'] !== $this->token($pendiente)) {
            return to_route('usuarios.importar')->with('error', 'El archivo cambió (se subió otro en otra pestaña): revísalo de nuevo.');
        }
        $request->session()->put(self::SESION, [...$pendiente, 'empresas' => array_map(fn ($id) => $id ? (int) $id : null, $datos['empresas'])]);

        return to_route('usuarios.importar');
    }

    public function confirmar(Request $request): RedirectResponse
    {
        $pendiente = $this->pendiente($request);
        if (! $pendiente) {
            return to_route('usuarios.importar')->with('error', 'No hay un archivo por importar: súbelo de nuevo.');
        }

        $yo = $request->user();
        $datos = $request->validate([
            'token' => ['required', 'string'],
            'rol_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('activo', true)],
        ], ['rol_id.required' => 'Elige el rol de las personas nuevas.']);
        if ($datos['token'] !== $this->token($pendiente)) {
            return to_route('usuarios.importar')->with('error', 'El archivo cambió (se subió otro en otra pestaña): revísalo de nuevo antes de importar.');
        }
        $rol = RolUsuario::find($datos['rol_id']);
        if (! $yo->rolUsuario?->cubre($rol)) {
            return back()->withErrors(['rol_id' => 'Este rol tiene permisos que el tuyo no tiene: no puedes darlo.']);
        }

        try {
            $analisis = $this->importador->analizar($this->importador->leer(Storage::path($pendiente['ruta'])), $yo, $pendiente['empresas'] ?? []);
        } catch (RuntimeException $e) {
            $this->descartarArchivo($request);

            return to_route('usuarios.importar')->with('error', $e->getMessage());
        }
        if (collect($analisis['filas'])->whereIn('accion', ['nueva', 'completa'])->isEmpty()) {
            return back()->with('error', 'El archivo no trae personas nuevas ni datos por completar.');
        }

        $r = $this->importador->importar($analisis, $rol, $yo);
        $this->descartarArchivo($request);

        $partes = array_filter([
            $r['nuevas'] ? ($r['nuevas'] === 1 ? '1 persona nueva' : "{$r['nuevas']} personas nuevas") : null,
            $r['completadas'] ? ($r['completadas'] === 1 ? 'se completaron los datos de 1 persona' : "se completaron los datos de {$r['completadas']} personas") : null,
        ]);
        $asignadas = $r['asignadas'] ? ' '.($r['asignadas'] === 1 ? 'Una quedó asignada a su empresa.' : "{$r['asignadas']} quedaron asignadas a su empresa.") : '';
        $asignadas .= $r['sinAsignar'] ? ' '.($r['sinAsignar'] === 1 ? 'Una quedó sin asignar: asígnala en Asignaciones.' : "{$r['sinAsignar']} quedaron sin asignar: asígnalas en Asignaciones.") : '';

        return to_route('usuarios.index', ['acceso' => 'sin'])
            ->with('success', 'Personal importado: '.implode(' y ', $partes).'.'.$asignadas.' Las personas nuevas tienen su carnet y no entran a la plataforma.');
    }

    public function descartar(Request $request): RedirectResponse
    {
        $this->descartarArchivo($request);

        return to_route('usuarios.importar');
    }

    /** Identifica el archivo pendiente (su nombre interno, que cambia con cada archivo subido). */
    private function token(array $pendiente): string
    {
        return pathinfo($pendiente['ruta'], PATHINFO_FILENAME);
    }

    /** @return array{ruta: string, nombre: string, empresas: array<string, int|null>}|null */
    private function pendiente(Request $request): ?array
    {
        $pendiente = $request->session()->get(self::SESION);

        return is_array($pendiente) && Storage::exists($pendiente['ruta'] ?? '') ? $pendiente : null;
    }

    private function descartarArchivo(Request $request): void
    {
        $pendiente = $request->session()->pull(self::SESION);
        if (is_array($pendiente) && isset($pendiente['ruta'])) {
            Storage::delete($pendiente['ruta']);
        }
    }
}
