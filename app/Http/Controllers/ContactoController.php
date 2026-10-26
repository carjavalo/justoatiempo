<?php

namespace App\Http\Controllers;

use App\Models\SolicitudContacto;
use App\Notifications\NuevaSolicitudContacto;
use App\Notifications\SolicitudRecibida;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

use function Illuminate\Support\defer;

/** Solicitudes de cotización desde la página principal. */
class ContactoController extends Controller
{
    /** Debe coincidir con las líneas de servicio de resources/js/lib/portafolio.ts. */
    public const SERVICIOS = [
        'Servicios logísticos',
        'Suministro de personal operativo',
        'Aseo general',
        'Aseo industrial',
        'Limpieza de obra y posobra',
        'Mantenimiento de zonas verdes y jardines',
        'Limpieza y mantenimiento de espacios públicos',
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

        $solicitud = SolicitudContacto::create([
            ...collect($datos)->except('autoriza_datos')->all(),
            'autoriza_datos_en' => now(),
            'ip' => $request->ip(),
        ]);

        // Los correos salen después de responder: quien escribe no espera al servidor de correo
        defer(fn () => $this->avisar($solicitud));

        return back()->with('contacto_enviado', true);
    }

    /**
     * Avisa al equipo (al responder ese correo, la respuesta le llega a quien escribió) y le confirma a la persona
     * que la recibimos. Un correo que falla no impide el otro y el error queda en el registro: la solicitud ya
     * está guardada y se ve en la plataforma.
     */
    private function avisar(SolicitudContacto $solicitud): void
    {
        $equipo = SolicitudContacto::destinatarios();

        if ($equipo === []) {
            Log::warning('Llegó una solicitud de cotización y no hay a quién avisarle: configure MAIL_CONTACTO o un administrador activo.', ['solicitud' => $solicitud->id]);
        } else {
            try {
                Notification::route('mail', $equipo)->notify(new NuevaSolicitudContacto($solicitud));
            } catch (Throwable $e) {
                report($e);
            }
        }

        // Máximo 3 confirmaciones por hora a un mismo correo: el formulario no sirve para llenar buzones ajenos
        $clave = 'confirmacion-contacto|'.sha1(Str::lower($solicitud->email));
        if (RateLimiter::tooManyAttempts($clave, 3)) {
            return;
        }
        RateLimiter::hit($clave, 3600);

        try {
            Notification::route('mail', $solicitud->email)->notify(new SolicitudRecibida($solicitud, $equipo));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
