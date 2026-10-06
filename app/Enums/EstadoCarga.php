<?php

namespace App\Enums;

enum EstadoCarga: string
{
    case Procesando = 'procesando';
    case Procesada = 'procesada';
    case ConErrores = 'con_errores';
    case Anulada = 'anulada';

    public function label(): string
    {
        return match ($this) {
            self::Procesando => 'Procesando',
            self::Procesada => 'Procesada',
            self::ConErrores => 'Con errores',
            self::Anulada => 'Anulada',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
