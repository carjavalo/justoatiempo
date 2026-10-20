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
            self::Admin => 'Toda la administración (usuarios, roles, empresas, sedes y sucursales) y todas las líneas.',
            self::Coordinador => 'La operación de su línea y su personal (tablero, cargas y auditoría).',
            self::Auxiliar => 'Solo su propia información (su desempeño y su carnet).',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
