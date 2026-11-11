<?php

namespace App\Enums;

enum TipoEvidencia: string
{
    case Fachada = 'fachada';
    case Sellado = 'sellado';
    case Destapado = 'destapado';
    case Remesa = 'remesa';
    case Rotulo = 'rotulo';
    case PdfPod = 'pdf_pod';
    // Borrosa o ilegible: no cuenta para el protocolo
    case Ilegible = 'ilegible';
    // Copia de otra foto (p. ej. la foto de la pantalla de otro celular): no cuenta dos veces
    case Repetida = 'repetida';
    // La firma del cliente en la app de Drivin, separada del PDF: no es una foto del protocolo
    case Firma = 'firma';
    // Sin clasificar
    case Otro = 'otro';

    public function label(): string
    {
        return match ($this) {
            self::Fachada => 'Fachada',
            self::Sellado => 'Producto sellado',
            self::Destapado => 'Producto destapado',
            self::Remesa => 'Remesa / factura firmada',
            self::Rotulo => 'Rótulo',
            self::PdfPod => 'PDF prueba de entrega',
            self::Ilegible => 'Borrosa o ilegible',
            self::Repetida => 'Repetida',
            self::Firma => 'Firma del cliente',
            self::Otro => 'Sin clasificar',
        };
    }

    /** Los tipos que el auditor le puede dar a una foto (el PDF y la firma no se eligen: se reconocen solos). */
    public static function deFotos(): array
    {
        return array_values(array_filter(self::values(), fn (string $t) => ! in_array($t, [self::PdfPod->value, self::Firma->value], true)));
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
