<?php

namespace App\Services\Pod;

/**
 * Genera pruebas de entrega de ejemplo (PDF con fotos JPEG incrustadas, como el de Drivin)
 * y fotos sueltas. Solo para probar el módulo de auditoría; no depende de librerías de PDF.
 */
class GeneradorPodEjemplo
{
    private const COLORES = [
        'FACHADA' => [70, 96, 140],
        'PRODUCTO SELLADO' => [176, 132, 78],
        'PRODUCTO DESTAPADO' => [92, 128, 96],
        'REMESA FIRMADA' => [214, 214, 206],
        'ROTULO' => [150, 110, 160],
    ];

    /** Foto JPEG de ejemplo con un rótulo grande. */
    public function foto(string $rotulo, int $indice = 1): string
    {
        $base = array_values(array_filter(self::COLORES, fn ($k) => str_starts_with($rotulo, $k), ARRAY_FILTER_USE_KEY))[0] ?? [120, 120, 120];
        $img = imagecreatetruecolor(640, 480);
        $fondo = imagecolorallocate($img, ...$base);
        $claro = imagecolorallocate($img, min(255, $base[0] + 50), min(255, $base[1] + 50), min(255, $base[2] + 50));
        $texto = imagecolorallocate($img, 255, 255, 255);
        $oscuro = imagecolorallocate($img, 20, 30, 50);

        imagefilledrectangle($img, 0, 0, 640, 480, $fondo);
        // Un "objeto" en el centro, distinto en cada foto
        imagefilledrectangle($img, 160 + $indice * 10, 120, 480 - $indice * 6, 360, $claro);
        imagerectangle($img, 160 + $indice * 10, 120, 480 - $indice * 6, 360, $oscuro);
        imagefilledrectangle($img, 0, 420, 640, 480, $oscuro);
        imagestring($img, 5, 20, 440, $rotulo.' '.$indice, $texto);

        ob_start();
        imagejpeg($img, null, 80);
        imagedestroy($img);

        return (string) ob_get_clean();
    }

    /**
     * PDF de prueba de entrega: encabezado con el código y 4 fotos por página.
     *
     * @param  list<string>  $fotos  bytes JPEG
     */
    public function pdf(string $titulo, array $fotos): string
    {
        $objetos = [];
        $nuevo = function (?string $contenido = null) use (&$objetos): int {
            $objetos[] = $contenido;

            return count($objetos);
        };
        $poner = function (int $id, string $contenido) use (&$objetos): void {
            $objetos[$id - 1] = $contenido;
        };

        $catalogo = $nuevo();
        $paginas = $nuevo();
        $fuente = $nuevo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

        $idsImagenes = [];
        foreach ($fotos as $jpeg) {
            [$ancho, $alto] = getimagesizefromstring($jpeg);
            $idsImagenes[] = $nuevo("<< /Type /XObject /Subtype /Image /Width {$ancho} /Height {$alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ".strlen($jpeg)." >>\nstream\n{$jpeg}\nendstream");
        }

        $titulo = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $titulo);
        $hijos = [];
        foreach (array_chunk($idsImagenes, 4, true) ?: [[]] as $p => $lote) {
            $contenido = "BT /F1 16 Tf 40 800 Td ({$titulo}) Tj ET\nBT /F1 10 Tf 40 782 Td (Prueba de entrega - pagina ".($p + 1).") Tj ET\n";
            $recursos = '';
            foreach (array_values($lote) as $i => $idImagen) {
                $x = 40 + ($i % 2) * 265;
                $y = 520 - intdiv($i, 2) * 230;
                // Matriz [ancho 0 0 alto x y]: escala la imagen a 250×188 pt en la posición (x, y)
                $contenido .= "q 250 0 0 188 {$x} {$y} cm /Im{$idImagen} Do Q\n";
                $recursos .= "/Im{$idImagen} {$idImagen} 0 R ";
            }
            $flujo = $nuevo('<< /Length '.strlen($contenido)." >>\nstream\n{$contenido}endstream");
            $hijos[] = $nuevo("<< /Type /Page /Parent {$paginas} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {$fuente} 0 R >> /XObject << {$recursos}>> >> /Contents {$flujo} 0 R >>");
        }

        $poner($paginas, '<< /Type /Pages /Kids ['.implode(' ', array_map(fn ($h) => "{$h} 0 R", $hijos)).'] /Count '.count($hijos).' >>');
        $poner($catalogo, "<< /Type /Catalog /Pages {$paginas} 0 R >>");

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objetos as $i => $contenido) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$contenido}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objetos) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $pdf .= sprintf("%010d 00000 n \n", $o);
        }
        $pdf .= 'trailer << /Size '.(count($objetos) + 1)." /Root {$catalogo} 0 R >>\nstartxref\n{$xref}\n%%EOF\n";

        return $pdf;
    }

    /**
     * Fotos de una entrega según qué tan completo fue el protocolo.
     *
     * @return list<string>
     */
    public function fotosEntrega(bool $fachada, int $sellado, int $destapado, bool $remesa): array
    {
        $fotos = [];
        if ($fachada) {
            $fotos[] = $this->foto('FACHADA');
        }
        for ($i = 1; $i <= $sellado; $i++) {
            $fotos[] = $this->foto('PRODUCTO SELLADO', $i);
        }
        for ($i = 1; $i <= $destapado; $i++) {
            $fotos[] = $this->foto('PRODUCTO DESTAPADO', $i);
        }
        if ($remesa) {
            $fotos[] = $this->foto('REMESA FIRMADA');
        }

        return $fotos;
    }
}
