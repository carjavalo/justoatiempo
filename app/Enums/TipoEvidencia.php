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
            self::Otro => 'Otro',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
