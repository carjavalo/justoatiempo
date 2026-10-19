Nueva solicitud de cotización

Llegó desde el formulario del sitio web el {!! $fecha !!} a las {!! $hora !!}.

Nombre: {!! $solicitud->nombre !!}
@if ($solicitud->empresa)
Empresa: {!! $solicitud->empresa !!}
@endif
Correo: {!! $solicitud->email !!}
@if ($solicitud->telefono)
Teléfono: {!! $solicitud->telefono !!}
@endif
Servicio: {!! $solicitud->servicio ?: 'No lo indicó' !!}

Lo que necesita:
{!! $solicitud->mensaje !!}

Ver en la plataforma: {!! $enlace !!}

Para responderle, contesta este correo: la respuesta le llega directamente a {!! $solicitud->nombre !!}.

--
Justo a Tiempo SP S.A.S · Cali, Colombia
Aviso automático del sitio web de Justo a Tiempo SP.
