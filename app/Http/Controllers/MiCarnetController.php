<?php

namespace App\Http\Controllers;

use App\Services\Carnet;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** El carnet de quien ingresó: cada persona ve y descarga el suyo (y solo el suyo), con su ARL. */
class MiCarnetController extends Controller
{
    public function show(Request $request): Response
    {
        $usuario = $request->user();

        return Inertia::render('carnet/ver', [
            'persona' => Carnet::datos(
                $usuario,
                $usuario->foto_path ? route('mi-carnet.foto', ['v' => Carnet::version($usuario->foto_path)]) : null,
                $usuario->arl_path ? route('mi-carnet.arl', ['v' => Carnet::version($usuario->arl_path)]) : null,
            ),
            'propio' => true,
        ]);
    }

    public function foto(Request $request): StreamedResponse
    {
        return Carnet::respuestaFoto($request->user());
    }

    public function arl(Request $request): StreamedResponse
    {
        return Carnet::respuestaArl($request->user());
    }
}
