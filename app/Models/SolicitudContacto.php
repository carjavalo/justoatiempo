<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SolicitudContacto extends Model
{
    protected $table = 'solicitudes_contacto';

    protected $fillable = ['nombre', 'empresa', 'email', 'telefono', 'servicio', 'mensaje', 'autoriza_datos_en', 'ip', 'atendida'];

    protected function casts(): array
    {
        return ['atendida' => 'boolean', 'autoriza_datos_en' => 'datetime'];
    }
}
