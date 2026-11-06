<?php

/**
 * Datos de contacto, legales y el tiempo de respuesta que muestra la página principal. Los que confirmó la empresa
 * (noviembre de 2026) van aquí por defecto, así que se publican con el código; una variable EMPRESA_* con valor en el
 * .env los reemplaza (vacía, se usa el de aquí). Lo que no tenga valor no se muestra: nada se publica sin confirmar.
 * Con EMPRESA_DATOS_DE_PRUEBA=true la página marca los datos como de prueba.
 *
 * Los teléfonos llevan el indicativo del país (+57): de ahí salen los enlaces para llamar y para WhatsApp.
 */
return [
    'telefono' => env('EMPRESA_TELEFONO') ?: '+57 300 645 7341',
    'whatsapp' => env('EMPRESA_WHATSAPP') ?: '+57 300 645 7341',
    'correo' => env('EMPRESA_CORREO') ?: 'justoatiemposp@gmail.com',
    // La sede principal
    'direccion' => env('EMPRESA_DIRECCION') ?: 'Cra 97 N° 42-46',
    'ciudad' => env('EMPRESA_CIUDAD') ?: 'Cali, Valle del Cauca',
    'nit' => env('EMPRESA_NIT') ?: null,
    'politica_datos' => env('EMPRESA_POLITICA_DATOS_URL') ?: null,
    // En cuánto se responde una solicitud de cotización, p. ej. "24 horas hábiles"
    'tiempo_respuesta' => env('EMPRESA_TIEMPO_RESPUESTA') ?: null,

    'datos_de_prueba' => (bool) env('EMPRESA_DATOS_DE_PRUEBA', false),
];
