<?php

/*
 * Mensajes de validación en español. Los atributos van en minúscula con su artículo
 * ("la contraseña") y se capitalizan con :Attribute cuando abren la frase, para que
 * ningún mensaje quede como "La confirmación de La contraseña" o "La contraseña es obligatorio".
 */
return [
    'accepted' => 'Debes aceptar :attribute.',
    'confirmed' => 'La confirmación no coincide con :attribute.',
    'current_password' => 'La contraseña no es correcta.',
    'date' => ':Attribute no es una fecha válida.',
    'email' => 'Escribe un correo electrónico válido.',
    'exists' => 'El valor elegido para :attribute no es válido.',
    'file' => 'Adjunta un archivo.',
    'image' => 'El archivo debe ser una imagen.',
    'in' => 'El valor elegido para :attribute no es válido.',
    'integer' => ':Attribute debe ser un número entero.',
    'lowercase' => ':Attribute debe estar en minúsculas.',
    'max' => [
        'file' => 'El archivo no debe pesar más de :max kilobytes.',
        'numeric' => ':Attribute no debe ser mayor que :max.',
        'string' => ':Attribute no debe tener más de :max caracteres.',
    ],
    'mimes' => 'El archivo debe ser de tipo: :values.',
    'min' => [
        'numeric' => ':Attribute debe ser al menos :min.',
        'string' => ':Attribute debe tener al menos :min caracteres.',
    ],
    'numeric' => ':Attribute debe ser un número.',
    'password' => [
        'letters' => ':Attribute debe contener al menos una letra.',
        'mixed' => ':Attribute debe contener mayúsculas y minúsculas.',
        'numbers' => ':Attribute debe contener al menos un número.',
        'symbols' => ':Attribute debe contener al menos un símbolo.',
        'uncompromised' => 'Esta contraseña apareció en una filtración de datos. Elige otra.',
    ],
    'required' => 'Completa este campo.',
    'string' => ':Attribute debe ser texto.',
    'unique' => 'Ya existe un registro con ese valor de :attribute.',

    'custom' => [
        'password' => [
            'confirmed' => 'Las contraseñas no coinciden.',
        ],
    ],

    'attributes' => [
        'email' => 'el correo electrónico',
        'password' => 'la contraseña',
        'current_password' => 'la contraseña actual',
        'password_confirmation' => 'la confirmación de la contraseña',
        'name' => 'el nombre',
        'cedula' => 'la cédula',
        'placa' => 'la placa',
        'archivo' => 'el archivo',
    ],
];
