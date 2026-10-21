<?php

namespace App\Enums;

/** Cómo le fue a cada persona programada en su turno. */
enum EstadoAsistencia: string
{
    case Asistio = 'asistio';
    case Tarde = 'tarde';
    case Falta = 'falta';
    case Permiso = 'permiso';
    case Incapacidad = 'incapacidad';

    public function label(): string
    {
        return match ($this) {
            self::Asistio => 'Asistió',
            self::Tarde => 'Llegó tarde',
            self::Falta => 'No asistió',
            self::Permiso => 'Permiso',
            self::Incapacidad => 'Incapacidad',
        };
    }

    /** Si estuvo en su turno (aunque llegara tarde): cuenta para la cobertura. */
    public function presente(): bool
    {
        return $this === self::Asistio || $this === self::Tarde;
    }

    /** Si la ausencia está justificada (no es una falta). */
    public function justificada(): bool
    {
        return $this === self::Permiso || $this === self::Incapacidad;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /** @return list<array{valor: string, texto: string}> */
    public static function opciones(): array
    {
        return array_map(fn (self $e) => ['valor' => $e->value, 'texto' => $e->label()], self::cases());
    }
}
