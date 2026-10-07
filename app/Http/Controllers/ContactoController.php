<?php

namespace App\Http\Controllers;

use App\Models\SolicitudContacto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Solicitudes de cotización desde la página principal. */
class ContactoController extends Controller
{
    /** Debe coincidir con las líneas de servicio de resources/js/lib/portafolio.ts. */
    public const SERVICIOS = [
        'Servicios logísticos',
        'Suministro de personal operativo',
        'Aseo general',
        'Aseo industrial',
        'Aseo de construcción y postobra',
        'Mantenimiento de zonas verdes',
        'Limpieza y mantenimiento de espacios públicos',
        'Apoyo operativo para plantas y centros logísticos',
        'Otro',
    ];

    public function store(Request $request): RedirectResponse
    {
        // Campo trampa: invisible para personas; si viene lleno es un robot y se descarta en silencio
        if ($request->filled('sitio_web')) {
            return back()->with('contacto_enviado', true);
        }

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:120'],
            'empresa' => ['nullable', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150'],
            'telefono' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{7,30}$/'],
            'servicio' => ['nullable', 'string', 'in:'.implode(',', self::SERVICIOS)],
            'mensaje' => ['required', 'string', 'min:10', 'max:2000'],
            'autoriza_datos' => ['accepted'],
        ], [
            // La página pública trata de "usted"; los mensajes generales del CRM tutean
            'required' => 'Complete este campo.',
            'email' => 'Escriba un correo electrónico válido.',
            'in' => 'Elija una opción de la lista.',
            'max' => 'Use como máximo :max caracteres.',
            'telefono.regex' => 'Escriba un teléfono válido (solo números, espacios y +).',
            'mensaje.min' => 'Cuéntenos un poco más sobre lo que necesita (mínimo 10 caracteres).',
            'autoriza_datos.accepted' => 'Necesitamos su autorización para tratar sus datos y responderle.',
        ]);

        SolicitudContacto::create([
            ...collect($datos)->except('autoriza_datos')->all(),
            'autoriza_datos_en' => now(),
            'ip' => $request->ip(),
        ]);

        return back()->with('contacto_enviado', true);
    }
}
