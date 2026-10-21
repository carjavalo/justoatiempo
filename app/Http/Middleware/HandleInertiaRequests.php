<?php

namespace App\Http\Middleware;

use App\Models\Orden;
use App\Support\Menu;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        // Las líneas que ve y su inicio, una sola vez: los usan la miga de inicio y el menú
        $lineas = $user?->lineasVisibles();
        $inicio = $user?->inicio($lineas);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            // Código de seguridad de esta sesión: el navegador lo envía en X-CSRF-TOKEN en cada envío. No depende de
            // la cookie XSRF-TOKEN, que otra app Laravel abierta en la misma dirección (otro puerto) puede sobrescribir.
            // Siempre incluido, también en las recargas parciales.
            'csrf' => Inertia::always(fn () => csrf_token()),
            'auth' => [
                'user' => $user ? [
                    ...$user->only(['id', 'name', 'nombres', 'primer_apellido', 'segundo_apellido', 'email', 'email_verified_at', 'created_at', 'updated_at']),
                    // El rol dentro de la empresa ("Conductor")
                    'rol_label' => $user->nombreRol(),
                    // Destino de la miga raíz: el panel o la línea en la que trabaja
                    'inicio' => $inicio,
                    // Las líneas en las que trabaja hoy (por sus asignaciones vigentes)
                    'lineas' => $user->lineas()->map(fn ($l) => ['slug' => $l->slug, 'nombre' => $l->nombre])->values(),
                    // Si cambia sus nombres y su correo en "Mi cuenta" (quien ve solo lo suyo, no: sus datos los lleva el carnet)
                    'editaPerfil' => ! $user->soloLoSuyo(),
                    // Si tiene entregas de Drivin a su nombre (para ofrecerle "Mis entregas")
                    'entregas' => $user->puede('entregas.ver') && Orden::where('auxiliar_id', $user->id)->exists(),
                ] : null,
                // Lo que puede hacer (los permisos de su rol que le aplican): las pantallas muestran solo eso
                'permisos' => $user ? $user->permisos() : [],
            ],
            // El menú lateral (null con una sola opción) y si quedó abierto o contraído la última vez
            'menu' => fn () => $user ? Menu::para($user, $lineas, $inicio) : null,
            'menuAbierto' => $request->cookie('menu_lateral') !== 'false',
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'contactoEnviado' => fn () => (bool) $request->session()->get('contacto_enviado'),
            ],
        ];
    }
}
