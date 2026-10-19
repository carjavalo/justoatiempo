@extends('correos.plantilla')

@section('titulo', 'Recibimos su solicitud')
@section('previo', 'Un asesor de nuestro equipo le contactará pronto.')
@section('subtitulo', 'Soluciones operativas integrales')
@section('pie', $puedeResponder ? 'Si quiere agregar algo a su solicitud, responda este correo.' : 'Mensaje automático: por favor no responda a este correo.')

@php
    $pasos = [
        ['Analizamos su operación', 'Definimos perfiles, cantidad de personal y procesos.'],
        ['Recibe una propuesta a la medida', 'Lista para revisarla con su equipo.'],
    ];
@endphp

@section('contenido')
    <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; font-weight:800; color:#12244a;">Recibimos su solicitud</h1>

    <p style="margin:0 0 28px;">
        Gracias por escribirnos. Su solicitud de cotización{!! $servicio ? ' de <strong>'.e($servicio).'</strong>' : '' !!} ya está
        con nuestro equipo: un asesor le contactará pronto al correo o al teléfono que nos dejó para entender su necesidad.
    </p>

    <p style="margin:0 0 14px; font-size:13px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#12244a;">Cómo seguimos</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        @foreach ($pasos as $i => [$paso, $detalle])
            <tr>
                <td style="width:44px; padding:0 0 16px; vertical-align:top;">
                    <div style="width:32px; height:32px; line-height:32px; border-radius:9px; background-color:#12244a; color:#ffffff; font-size:15px; font-weight:800; text-align:center;">{{ $i + 1 }}</div>
                </td>
                <td style="padding:0 0 16px; vertical-align:top;">
                    <div style="font-size:15px; font-weight:700; color:#0f1b33;">{{ $paso }}</div>
                    <div style="font-size:14px; color:#5b6577;">{{ $detalle }}</div>
                </td>
            </tr>
        @endforeach
    </table>
@endsection
