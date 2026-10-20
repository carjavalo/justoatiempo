<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Carnet;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lo que se abre al escanear el QR de un carnet (público: lo usa, por ejemplo, la portería de un cliente): si la
 * persona hace parte del equipo, su información y su certificado de ARL. El código del QR es aleatorio y solo
 * lo tiene quien tiene el carnet.
 */
class CarnetController extends Controller
{
    public function verificar(string $codigo): Response
    {
        return Inertia::render('carnet/verificar', Carnet::verificacion($this->persona($codigo)));
    }

    public function foto(string $codigo): StreamedResponse
    {
        return Carnet::respuestaFoto($this->persona($codigo, vigente: true));
    }

    public function arl(string $codigo): StreamedResponse
    {
        return Carnet::respuestaArl($this->persona($codigo, vigente: true));
    }

    /** Los archivos de quien ya no está activo no se entregan a nadie por esta vía. */
    private function persona(string $codigo, bool $vigente = false): User
    {
        return User::where('carnet_codigo', $codigo)->when($vigente, fn ($q) => $q->where('activo', true))->firstOrFail();
    }
}
