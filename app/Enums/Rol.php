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
            self::Auxiliar => 'Auxiliar operativo',
        };
    }

    public function descripcion(): string
    {
        return match ($this) {
            self::Admin => 'Crea usuarios, empresas y sedes.',
            self::Coordinador => 'Supervisa la operación y al personal de sus sedes.',
            self::Auxiliar => 'Personal en campo: consulta su propia información.',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
