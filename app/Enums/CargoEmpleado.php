<?php

namespace App\Enums;

enum CargoEmpleado: string
{
    case Auxiliar = 'auxiliar';
    case Conductor = 'conductor';
    case Coordinador = 'coordinador';
    case Supervisor = 'supervisor';
    case Otro = 'otro';

    public function label(): string
    {
        return match ($this) {
            self::Auxiliar => 'Auxiliar de reparto',
            self::Conductor => 'Conductor',
            self::Coordinador => 'Coordinador',
            self::Supervisor => 'Supervisor',
            self::Otro => 'Otro',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
