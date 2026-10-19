<?php

namespace App\Notifications;

use App\Models\SolicitudContacto;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Confirmación a quien escribió desde el sitio web (trato de "usted", como el sitio público).
 * No repite lo que la persona escribió: así el formulario no sirve para mandar textos ajenos a cualquier
 * correo. Solo el servicio, que sale de una lista fija.
 */
class SolicitudRecibida extends Notification
{
    /** @param  list<string>  $equipo  buzones del equipo: si responde el correo, le llega a ellos */
    public function __construct(public SolicitudContacto $solicitud, public array $equipo) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mensaje = (new MailMessage)
            ->subject('Recibimos su solicitud de cotización')
            ->view(['correos.solicitud-recibida', 'correos.solicitud-recibida-texto'], [
                'servicio' => $this->solicitud->servicio !== 'Otro' ? $this->solicitud->servicio : null,
                'puedeResponder' => $this->equipo !== [],
            ]);

        foreach ($this->equipo as $correo) {
            $mensaje->replyTo($correo, 'Justo a Tiempo SP');
        }

        return $mensaje;
    }
}
