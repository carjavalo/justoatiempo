<?php

namespace App\Enums;

enum Rol: string
{
    case Admin = 'admin';
    case Coordinador = 'coordinador';
    case Auxiliar = 'auxiliar';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Administrador',
            self::Coordinador => 'Coordinador / Supervisor',
            self::Auxiliar => 'Auxiliar / Conductor',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
