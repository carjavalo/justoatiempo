<?php

namespace App\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso de seguridad después de restablecer la contraseña: si no fue la persona, se entera de inmediato
 * y sabe a quién acudir.
 */
class ContrasenaCambiada extends Notification
{
    public function __construct(public CarbonInterface $cuando) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // La plataforma se usa en Colombia: la hora se dice en la de aquí, sin importar la del servidor
        $hora = $this->cuando->copy()->timezone('America/Bogota')->locale('es');

        return (new MailMessage)
            ->subject('Tu contraseña se cambió')
            ->view(['correos.contrasena-cambiada', 'correos.contrasena-cambiada-texto'], [
                'nombre' => $notifiable->nombreDePila(),
                'correo' => $notifiable->email,
                'fecha' => $hora->translatedFormat('j \d\e F \d\e Y'),
                'hora' => $hora->format('g:i a'),
            ]);
    }
}
