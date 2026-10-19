@extends('correos.plantilla')

@section('titulo', 'Tu contraseña se cambió')
@section('previo', "La contraseña de {$correo} se cambió el {$fecha} a las {$hora}.")

@section('contenido')
    <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; font-weight:800; color:#12244a;">Tu contraseña se cambió</h1>

    <p style="margin:0 0 16px;">Hola, {{ $nombre }}:</p>
    <p style="margin:0 0 16px;">
        La contraseña de tu cuenta <strong>{{ $correo }}</strong> en la plataforma de Justo a Tiempo SP se cambió
        el {{ $fecha }} a las {{ $hora }} (hora de Colombia). Por seguridad, cerramos las sesiones que estaban
        abiertas en otros equipos.
    </p>
    <p style="margin:0 0 24px;">Si fuiste tú, no tienes que hacer nada.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
            <td style="background-color:#fbe3df; border-left:4px solid #b4432f; border-radius:8px; padding:14px 16px; font-size:15px; line-height:1.6; color:#0f1b33;">
                <strong>¿No fuiste tú?</strong> Comunícate de inmediato con el administrador de la plataforma o con tu
                coordinador para bloquear el acceso a tu cuenta.
            </td>
        </tr>
    </table>
@endsection
