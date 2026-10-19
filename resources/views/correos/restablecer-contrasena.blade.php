@extends('correos.plantilla')

@section('titulo', 'Restablece tu contraseña')
@section('previo', "Crea una nueva contraseña para {$correo}. El enlace vence en {$minutos} minutos.")

@section('contenido')
    <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; font-weight:800; color:#12244a;">Restablece tu contraseña</h1>

    <p style="margin:0 0 16px;">Hola, {{ $nombre }}:</p>
    <p style="margin:0 0 24px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta <strong>{{ $correo }}</strong>
        en la plataforma de Justo a Tiempo SP. Para crear una nueva, usa este botón:
    </p>

    {{-- Botón hecho con tabla: así se ve como botón también en Outlook --}}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
            <td style="background-color:#1f3a68; border-radius:10px;">
                <a href="{{ $enlace }}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:16px; line-height:1.2; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">Crear nueva contraseña</a>
            </td>
        </tr>
    </table>

    <p style="margin:0 0 16px;">El enlace vence en <strong>{{ $minutos }} minutos</strong> y solo sirve una vez.</p>
    <p style="margin:0 0 28px;">Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.</p>

    <p style="margin:0; padding-top:20px; border-top:1px solid #e3e8f0; font-size:13px; line-height:1.6; color:#5b6577;">
        ¿El botón no funciona? Copia y pega esta dirección en tu navegador:<br>
        <a href="{{ $enlace }}" target="_blank" style="color:#1f3a68; word-break:break-all;">{{ $enlace }}</a>
    </p>
@endsection
