<?php

/**
 * Datos de contacto, legales y el tiempo de respuesta que muestra la página principal. Vienen del .env para no publicar
 * nada sin confirmar: lo que no esté definido no se muestra. Con EMPRESA_DATOS_DE_PRUEBA=true la página marca los datos
 * como de prueba (para revisarla antes de tener los reales).
 */
return [
    'telefono' => env('EMPRESA_TELEFONO'),
    'whatsapp' => env('EMPRESA_WHATSAPP'),
    'correo' => env('EMPRESA_CORREO'),
    'direccion' => env('EMPRESA_DIRECCION'),
    'ciudad' => env('EMPRESA_CIUDAD'),
    'nit' => env('EMPRESA_NIT'),
    'politica_datos' => env('EMPRESA_POLITICA_DATOS_URL'),
    // En cuánto se responde una solicitud de cotización, p. ej. "24 horas hábiles"
    'tiempo_respuesta' => env('EMPRESA_TIEMPO_RESPUESTA'),

    'datos_de_prueba' => (bool) env('EMPRESA_DATOS_DE_PRUEBA', false),
];
