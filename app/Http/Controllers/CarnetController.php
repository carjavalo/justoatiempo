<?php

namespace App\Http\Controllers;

use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lo que se ve al escanear el QR de un carnet: si es de alguien del equipo y si sigue vigente. Por ahora solo
 * el nombre, el cargo y la vigencia (lo mismo que ya va impreso en el carnet).
 */
class CarnetController extends Controller
{
    public function verificar(string $codigo): Response
    {
        $usuario = User::where('carnet_codigo', $codigo)->firstOrFail();

        return Inertia::render('carnet/verificar', [
            'nombre' => $usuario->name,
            'cargo' => $usuario->cargo ?: $usuario->rol->label(),
            'vigente' => $usuario->activo,
        ]);
    }
}
