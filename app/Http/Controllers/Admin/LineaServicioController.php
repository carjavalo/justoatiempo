<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LineaServicioRequest;
use App\Models\AccionDesempeno;
use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Programacion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Las líneas de servicio de Justo a Tiempo: las del portafolio y las que se creen. Una línea nueva nace con su
 * tablero, su programación, sus novedades y su informe diario, y se ofrece en las empresas y en las asignaciones
 * mientras esté activa.
 */
class LineaServicioController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $lineas = LineaServicio::query()
            ->withCount([
                'empresas' => fn ($q) => $q->where('activo', true),
                // Su personal: quienes tienen hoy una asignación en ella
                'asignaciones as personas_count' => fn ($q) => $q->vigentes()->select(DB::raw('count(distinct asignaciones.user_id)')),
            ])
            ->orderByDesc('activa')
            ->ordenadas()
            ->get()
            ->map(fn (LineaServicio $l) => [
                'id' => $l->id,
                'slug' => $l->slug,
                'nombre' => $l->nombre,
                'descripcion' => $l->descripcion,
                'icono' => $l->icono,
                'activa' => $l->activa,
                // Logística, con las herramientas de Drivin
                'drivin' => $l->modulo !== null,
                'empresas' => $l->empresas_count,
                'personas' => $l->personas_count,
                'verLinea' => $user->puedeVerLinea($l),
            ]);

        return Inertia::render('servicios/index', ['lineas' => $lineas]);
    }

    public function store(LineaServicioRequest $request): RedirectResponse
    {
        $linea = LineaServicio::create([
            ...$request->validated(),
            'slug' => LineaServicio::slugPara($request->validated('nombre')),
            'orden' => min(255, (int) LineaServicio::max('orden') + 1),
            'activa' => true,
        ]);

        return back()->with('success', "Línea creada: {$linea->nombre}. Ya puedes marcarla en las empresas que la reciben y asignarle personas.");
    }

    public function update(LineaServicioRequest $request, LineaServicio $servicio): RedirectResponse
    {
        $servicio->update($request->validated());

        return back()->with('success', "Cambios guardados en {$servicio->nombre}.");
    }

    public function estado(Request $request, LineaServicio $servicio): RedirectResponse
    {
        $activa = $request->validate(['activo' => ['required', 'boolean']])['activo'];

        if (! $activa) {
            if ($servicio->modulo !== null) {
                return back()->with('error', "{$servicio->nombre} tiene las herramientas de Drivin (tablero, cargas y auditoría): no se desactiva.");
            }
            // Quien trabaja hoy (o empezará) en ella se quedaría sin línea: primero se terminan sus asignaciones
            $personas = Asignacion::whereHas('lineas', fn ($q) => $q->whereKey($servicio->id))
                ->where(fn ($q) => $q->whereNull('fecha_fin')->orWhereDate('fecha_fin', '>=', today()->toDateString()))
                ->distinct()->count('user_id');
            if ($personas > 0) {
                return back()->with('error', "No puedes desactivar {$servicio->nombre}: ".($personas === 1 ? '1 persona tiene asignaciones vigentes o por empezar' : "{$personas} personas tienen asignaciones vigentes o por empezar").' en ella. Termínalas primero en Asignaciones.');
            }
        }

        $servicio->update(['activa' => $activa]);

        return back()->with('success', $activa
            ? "{$servicio->nombre} está activa de nuevo."
            : "{$servicio->nombre} quedó inactiva: ya no se ofrece en las empresas ni en las asignaciones nuevas. Su historial se conserva.");
    }

    /** Solo una línea que nadie usa. La de Drivin no: de ella dependen el tablero, las cargas y la auditoría. */
    public function destroy(LineaServicio $servicio): RedirectResponse
    {
        if ($servicio->modulo !== null) {
            return back()->with('error', "{$servicio->nombre} tiene las herramientas de Drivin (tablero, cargas y auditoría): no se elimina.");
        }
        $enUso = "{$servicio->nombre} tiene empresas, personal u operación registrada: no se puede eliminar. Desactívala para conservar su historial.";
        if ($servicio->empresas()->exists() || $servicio->asignaciones()->exists() || Programacion::where('linea_servicio_id', $servicio->id)->exists()
            || NovedadLinea::where('linea_servicio_id', $servicio->id)->exists() || AccionDesempeno::where('linea_servicio_id', $servicio->id)->exists()) {
            return back()->with('error', $enUso);
        }

        return $this->eliminarRegistro($servicio, "la línea {$servicio->nombre}", $enUso);
    }
}
