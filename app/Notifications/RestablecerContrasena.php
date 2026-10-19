<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/** Correo de "¿Olvidaste tu contraseña?": el enlace para crear una nueva, que vence y sirve una sola vez. */
class RestablecerContrasena extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $minutos = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Restablece tu contraseña')
            ->view(['correos.restablecer-contrasena', 'correos.restablecer-contrasena-texto'], [
                'nombre' => $notifiable->nombreDePila(),
                'correo' => $notifiable->getEmailForPasswordReset(),
                'enlace' => $this->resetUrl($notifiable),
                'minutos' => $minutos,
            ]);
    }
}
