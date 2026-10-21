<?php

namespace App\Http\Controllers;

use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Parametro;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\SolicitudContacto;
use App\Models\Sucursal;
use App\Models\User;
use App\Models\Vehiculo;
use App\Support\Permisos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio después de ingresar: los módulos de la administración que su rol le deja ver y las líneas de servicio
 * (todas, si su rol las ve todas). Quien no administra nada y trabaja en una línea entra directo a ella.
 */
class PanelController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        // Ver todas las líneas pasa por su tablero
        $verTodasLasLineas = $user->puede(Permisos::TODAS_LAS_LINEAS) && $user->puede('tablero.ver');

        // Las líneas en las que trabaja hoy (por sus asignaciones) y cuyo tablero su rol abre
        $misLineas = $user->lineas()->filter(fn (LineaServicio $l) => $user->puedeVerLinea($l))->values();

        if (! $user->administraAlgo() && ! $verTodasLasLineas) {
            // Trabaja en una sola línea: entra directo a ella
            if ($misLineas->count() === 1) {
                return redirect()->route('lineas.show', $misLineas->first());
            }

            // En varias: el panel le muestra sus líneas; en ninguna, dónde está asignado
            return Inertia::render('panel', $misLineas->isNotEmpty()
                ? ['resumen' => (object) [], 'lineas' => $misLineas->map(fn (LineaServicio $l) => $this->tarjetaLinea($l, $user))]
                : ['asignacion' => [
                    'lugares' => $user->vigentes()->map(fn (Asignacion $a) => ['lugar' => $a->lugar(), 'lineas' => $a->lineas->pluck('nombre')]),
                    // Su rol no abre el tablero de la línea: aunque tenga (o le asignen) una, no entra a ella
                    'sinTablero' => ! $user->puede('tablero.ver'),
                ]]);
        }

        // Solo se cuenta lo que se muestra
        $resumen = array_filter([
            'usuarios' => $user->puede('usuarios.ver') ? (function () use ($user) {
                // Solo los que alcanza a ver (los de su empresa, si la tiene fija)
                $u = User::query()->alcanceDe($user)->selectRaw('count(*) as total, sum(activo) as activos')->first();

                return ['total' => (int) $u->total, 'activos' => (int) $u->activos];
            })() : null,
            'asignaciones' => $user->puede('asignaciones.ver') ? (function () use ($user) {
                // Las vigentes que alcanza a ver
                $vigentes = Asignacion::vigentes()->with('lineas:id')->whereIn('user_id', User::query()->alcanceDe($user)->select('users.id'))->get()
                    ->filter(fn (Asignacion $a) => $user->sinLimites() || $user->veAsignacion($a));

                return ['vigentes' => $vigentes->count(), 'personas' => $vigentes->pluck('user_id')->unique()->count()];
            })() : null,
            'roles' => $user->puede('roles.ver') ? ['total' => RolUsuario::count(), 'activos' => RolUsuario::where('activo', true)->count()] : null,
            'servicios' => $user->puede('servicios.ver') ? ['activas' => LineaServicio::activas()->count()] : null,
            'empresas' => $user->puede('empresas.ver') ? (function () {
                $e = Empresa::selectRaw('count(*) as total, sum(activo) as activas')->first();

                return ['total' => (int) $e->total, 'activas' => (int) $e->activas];
            })() : null,
            'sedes' => $user->puede('sedes.ver') ? (function () {
                $s = Sede::selectRaw('count(*) as total, sum(activo) as activas')->first();

                return ['total' => (int) $s->total, 'activas' => (int) $s->activas];
            })() : null,
            'sucursales' => $user->puede('sucursales.ver') ? (function () {
                $s = Sucursal::selectRaw('count(*) as total, sum(activo) as activas, sum(activo = 1 and sede_id is null) as propias')->first();

                return ['total' => (int) $s->total, 'activas' => (int) $s->activas, 'propias' => (int) $s->propias];
            })() : null,
            'solicitudes' => $user->puede('solicitudes.ver')
                ? ['total' => SolicitudContacto::count(), 'pendientes' => SolicitudContacto::where('atendida', false)->count()]
                : null,
            'vehiculos' => $user->puede('vehiculos.ver') ? (function () {
                $v = Vehiculo::selectRaw('count(*) as total, sum(activo) as activos')->first();

                return ['total' => (int) $v->total, 'activos' => (int) $v->activos];
            })() : null,
            'parametros' => $user->puede('parametros.ver')
                ? ['felicitacion' => (float) Parametro::valor('umbral_felicitacion', 100), 'llamado' => (float) Parametro::valor('umbral_llamado_atencion', 70)]
                : null,
        ], fn ($dato) => $dato !== null);

        // Las líneas que ve: todas las activas, o las suyas (si su rol abre su tablero)
        $lineas = ($verTodasLasLineas ? LineaServicio::activas()->ordenadas()->get() : $misLineas)
            ->map(fn (LineaServicio $l) => $this->tarjetaLinea($l, $user))
            ->values();

        return Inertia::render('panel', [
            'resumen' => (object) $resumen,
            'lineas' => $lineas,
        ]);
    }

    /** Una línea con lo que quien mira ve en ella: sus empresas activas y su personal (por asignaciones vigentes). */
    private function tarjetaLinea(LineaServicio $linea, User $user): array
    {
        $alcance = $user->alcanceEn($linea);

        return [
            'slug' => $linea->slug,
            'nombre' => $linea->nombre,
            'icono' => $linea->icono,
            'empresas' => $linea->empresas()->where('activo', true)->when(! $alcance->todo, fn ($q) => $q->whereIn('empresas.id', $alcance->empresas()))->count(),
            'personas' => $alcance->filtrarAsignaciones(Asignacion::vigentes()->whereHas('lineas', fn ($q) => $q->whereKey($linea->id)))
                ->whereHas('usuario', fn ($q) => $q->where('activo', true))
                ->distinct()->count('user_id'),
            'tablero' => $linea->modulo !== null,
        ];
    }
}
