<?php

namespace App\Http\Requests\Admin;

/** Recorta espacios de los campos de texto sin forzar a texto lo que no lo es (un arreglo debe fallar la validación). */
trait LimpiaTexto
{
    protected function texto(string $campo): mixed
    {
        $valor = $this->input($campo);

        return is_string($valor) ? trim($valor) : $valor;
    }
}
