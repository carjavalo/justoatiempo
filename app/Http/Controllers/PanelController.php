<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Inicio después de ingresar: las opciones de administración (o la asignación de quien no es administrador). */
class PanelController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        if (! $user->esAdmin()) {
            return Inertia::render('panel', [
                'asignacion' => [
                    'empresa' => $user->empresa?->nombre,
                    'sede' => $user->sede?->nombre,
                ],
            ]);
        }

        $usuarios = User::selectRaw('count(*) as total, sum(activo) as activos')->first();
        $sedes = Sede::selectRaw('count(*) as total, sum(activo) as activas, sum(activo = 1 and cliente_id is null) as propias')->first();
        $empresas = Cliente::selectRaw('count(*) as total, sum(activo) as activas')->first();

        return Inertia::render('panel', [
            'resumen' => [
                'usuarios' => ['total' => (int) $usuarios->total, 'activos' => (int) $usuarios->activos],
                'sedes' => ['total' => (int) $sedes->total, 'activas' => (int) $sedes->activas, 'propias' => (int) $sedes->propias],
                'empresas' => ['total' => (int) $empresas->total, 'activas' => (int) $empresas->activas],
            ],
        ]);
    }
}
