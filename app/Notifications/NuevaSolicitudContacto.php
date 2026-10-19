<?php

namespace App\Notifications;

use App\Models\SolicitudContacto;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Aviso al equipo: llegó una solicitud de cotización desde el sitio web. Al responder el correo, la respuesta
 * le llega directamente a quien la envió.
 */
class NuevaSolicitudContacto extends Notification
{
    public function __construct(public SolicitudContacto $solicitud) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->solicitud;
        $hora = $s->created_at->copy()->timezone('America/Bogota')->locale('es');

        return (new MailMessage)
            ->subject(Str::limit('Nueva solicitud de cotización: '.($s->empresa ?: $s->nombre), 110))
            ->replyTo($s->email, $s->nombre)
            ->view(['correos.solicitud-contacto', 'correos.solicitud-contacto-texto'], [
                'solicitud' => $s,
                'fecha' => $hora->translatedFormat('j \d\e F \d\e Y'),
                'hora' => $hora->format('g:i a'),
                'enlace' => route('solicitudes.index'),
            ]);
    }
}
