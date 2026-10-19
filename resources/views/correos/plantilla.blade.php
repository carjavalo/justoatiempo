{{--
    Plantilla de los correos de la plataforma. Escrita con tablas y estilos en línea a propósito: es lo único
    que respetan Gmail, Outlook y los demás lectores de correo. El logo va incrustado en el mensaje (no se
    descarga de internet), así se ve aunque el lector bloquee las imágenes externas.
--}}
@php
    // La letra de la web donde el lector de correo la permite (Apple Mail, iPhone); Gmail y Outlook usan la siguiente
    $fuente = "'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    $logo = isset($message) ? $message->embed(resource_path('images/logo-correo.png')) : asset('images/marca/logo-240.webp');
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>@yield('titulo')</title>
    <link href="https://fonts.bunny.net/css?family=plus-jakarta-sans:400,700,800" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#f5f7fb; -webkit-text-size-adjust:100%;">
    {{-- Texto de vista previa que muestran las bandejas de entrada junto al asunto --}}
    <div style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:#f5f7fb;">@yield('previo')</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fb;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
                    <tr>
                        <td align="center" style="background-color:#12244a; border-radius:16px 16px 0 0; padding:24px 28px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="background-color:#ffffff; border-radius:14px; padding:6px;">
                                        <img src="{{ $logo }}" width="60" height="54" alt="" style="display:block; border:0; outline:none;">
                                    </td>
                                    <td style="padding-left:14px; font-family:{!! $fuente !!}; text-align:left;">
                                        <div style="font-size:17px; line-height:1.3; font-weight:800; color:#ffffff;">Justo a Tiempo SP S.A.S</div>
                                        <div style="font-size:11px; line-height:1.6; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#f4b2a8;">@yield('subtitulo', 'Plataforma de gestión')</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#ffffff; border:1px solid #e3e8f0; border-top:0; border-radius:0 0 16px 16px; padding:36px 32px; font-family:{!! $fuente !!}; font-size:16px; line-height:1.6; color:#0f1b33; text-align:left;">
                            @yield('contenido')
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:24px 16px 8px; font-family:{!! $fuente !!}; font-size:12px; line-height:1.6; color:#5b6577;">
                            Justo a Tiempo SP S.A.S · Cali, Colombia<br>
                            @yield('pie', 'Mensaje automático de la plataforma: por favor no respondas a este correo.')
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
