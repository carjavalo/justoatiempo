<?php

namespace App\Enums;

enum TipoAccion: string
{
    case Felicitacion = 'felicitacion';
    case Retroalimentacion = 'retroalimentacion';
    case LlamadoAtencion = 'llamado_atencion';

    public function label(): string
    {
        return match ($this) {
            self::Felicitacion => 'Felicitación',
            self::Retroalimentacion => 'Retroalimentación operativa',
            self::LlamadoAtencion => 'Llamado de atención verbal',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
