<?php

namespace App\Enums;

enum EstadoInforme: string
{
    case Borrador = 'borrador';
    case Seguimiento = 'seguimiento';
    case Cerrado = 'cerrado';

    public function label(): string
    {
        return match ($this) {
            self::Borrador => 'Borrador',
            self::Seguimiento => 'Seguimiento',
            self::Cerrado => 'Cerrado',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
