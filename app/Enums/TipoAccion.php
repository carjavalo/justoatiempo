<?php

namespace App\Enums;

/** Lo que se hace con una persona después de revisar su operación (columna "Acción / Seguimiento" del informe). */
enum TipoAccion: string
{
    case Felicitacion = 'felicitacion';
    case Retroalimentacion = 'retroalimentacion';
    case LlamadoAtencion = 'llamado_atencion';
    case LlamadoEscrito = 'llamado_escrito';

    public function label(): string
    {
        return match ($this) {
            self::Felicitacion => 'Felicitación',
            self::Retroalimentacion => 'Retroalimentación operativa',
            self::LlamadoAtencion => 'Llamado de atención verbal',
            self::LlamadoEscrito => 'Llamado de atención escrito',
        };
    }

    /** Si es un llamado de atención (verbal o escrito). */
    public function esLlamado(): bool
    {
        return $this === self::LlamadoAtencion || $this === self::LlamadoEscrito;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /** @return list<array{valor: string, texto: string}> */
    public static function opciones(): array
    {
        return array_map(fn (self $t) => ['valor' => $t->value, 'texto' => $t->label()], self::cases());
    }
}
