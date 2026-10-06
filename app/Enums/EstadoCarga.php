<?php

namespace App\Enums;

enum EstadoCarga: string
{
    case EnRevision = 'en_revision';
    case Procesada = 'procesada';
    case ConErrores = 'con_errores';
    case Anulada = 'anulada';

    public function label(): string
    {
        return match ($this) {
            self::EnRevision => 'En revisión',
            self::Procesada => 'Importada',
            self::ConErrores => 'Importada con filas omitidas',
            self::Anulada => 'Anulada',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
