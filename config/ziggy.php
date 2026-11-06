<?php

/**
 * Rutas que llegan al navegador. Quien no ha iniciado sesión (sitio web, ingreso y recuperación) recibe solo el grupo
 * "publico": menos peso en el teléfono y sin el mapa de la plataforma. Con sesión iniciada llegan todas
 * (resources/views/app.blade.php); al ingresar, la plataforma se carga completa para recibirlas.
 */
return [
    'groups' => [
        'publico' => ['home', 'login', 'logout', 'password.*', 'verification.*'],
    ],
];
