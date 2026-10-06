<?php

namespace App\Enums;

enum EstadoOrden: string
{
    case Aprobada = 'aprobada';
    case Rechazada = 'rechazada';
    case Pendiente = 'pendiente';

    public function label(): string
    {
        return match ($this) {
            self::Aprobada => 'Aprobada',
            self::Rechazada => 'Rechazada',
            self::Pendiente => 'Pendiente',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
