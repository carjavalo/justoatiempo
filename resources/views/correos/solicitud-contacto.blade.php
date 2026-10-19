@extends('correos.plantilla')

@section('titulo', 'Nueva solicitud de cotización')
@section('previo', "{$solicitud->nombre}".($solicitud->empresa ? " ({$solicitud->empresa})" : '').' escribió desde el sitio web.')
@section('subtitulo', 'Sitio web')
@section('pie', 'Aviso automático del sitio web de Justo a Tiempo SP.')

@php
    $etiqueta = 'padding:10px 12px 10px 0; width:120px; vertical-align:top; font-size:13px; font-weight:700; color:#5b6577; border-bottom:1px solid #e3e8f0;';
    $valor = 'padding:10px 0; vertical-align:top; font-size:15px; color:#0f1b33; border-bottom:1px solid #e3e8f0;';
@endphp

@section('contenido')
    <h1 style="margin:0 0 8px; font-size:22px; line-height:1.3; font-weight:800; color:#12244a;">Nueva solicitud de cotización</h1>
    <p style="margin:0 0 24px; color:#5b6577; font-size:15px;">Llegó desde el formulario del sitio web el {{ $fecha }} a las {{ $hora }}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
            <td style="{{ $etiqueta }}">Nombre</td>
            <td style="{{ $valor }}"><strong>{{ $solicitud->nombre }}</strong></td>
        </tr>
        @if ($solicitud->empresa)
            <tr>
                <td style="{{ $etiqueta }}">Empresa</td>
                <td style="{{ $valor }}">{{ $solicitud->empresa }}</td>
            </tr>
        @endif
        <tr>
            <td style="{{ $etiqueta }}">Correo</td>
            <td style="{{ $valor }}"><a href="mailto:{{ $solicitud->email }}" style="color:#1f3a68;">{{ $solicitud->email }}</a></td>
        </tr>
        @if ($solicitud->telefono)
            <tr>
                <td style="{{ $etiqueta }}">Teléfono</td>
                <td style="{{ $valor }}"><a href="tel:{{ preg_replace('/[^0-9+]/', '', $solicitud->telefono) }}" style="color:#1f3a68;">{{ $solicitud->telefono }}</a></td>
            </tr>
        @endif
        <tr>
            <td style="{{ $etiqueta }}">Servicio</td>
            <td style="{{ $valor }}">{{ $solicitud->servicio ?: 'No lo indicó' }}</td>
        </tr>
    </table>

    <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#5b6577;">Lo que necesita</p>
    <div style="margin:0 0 28px; padding:16px; background-color:#f5f7fb; border-radius:10px; font-size:15px; line-height:1.6; color:#0f1b33;">{!! nl2br(e($solicitud->mensaje)) !!}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
            <td style="background-color:#1f3a68; border-radius:10px;">
                <a href="{{ $enlace }}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:16px; line-height:1.2; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">Ver en la plataforma</a>
            </td>
        </tr>
    </table>

    <p style="margin:0; padding-top:20px; border-top:1px solid #e3e8f0; font-size:13px; line-height:1.6; color:#5b6577;">
        Para responderle, contesta este correo: la respuesta le llega directamente a {{ $solicitud->nombre }}.
        Cuando la atiendan, márquenla como atendida en la plataforma.
    </p>
@endsection
