<?php

namespace App\Models;

use App\Enums\Rol;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Solicitud de cotización del formulario "Hablemos de su operación" del sitio web. */
class SolicitudContacto extends Model
{
    protected $table = 'solicitudes_contacto';

    protected $fillable = ['nombre', 'empresa', 'email', 'telefono', 'servicio', 'mensaje', 'autoriza_datos_en', 'ip', 'atendida', 'atendida_en', 'atendida_por_id'];

    protected function casts(): array
    {
        return ['atendida' => 'boolean', 'autoriza_datos_en' => 'datetime', 'atendida_en' => 'datetime'];
    }

    public function atendidaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'atendida_por_id');
    }

    /**
     * Quién recibe las solicitudes por correo: los buzones de MAIL_CONTACTO (separados por comas) o, si no se
     * configuró, los administradores activos.
     *
     * @return list<string>
     */
    public static function destinatarios(): array
    {
        $configurados = array_values(array_filter(array_map('trim', explode(',', (string) config('mail.contacto')))));

        return $configurados ?: User::where('rol', Rol::Admin)->where('activo', true)->orderBy('id')->pluck('email')->all();
    }
}
