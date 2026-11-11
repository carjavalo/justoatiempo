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

        return $this->ensamblar($objetos, $catalogo);
    }

    /**
     * PDF como el de Drivin: los datos de la entrega, la tabla de la orden (con el código partido en dos renglones),
     * las fotos después de "Fotografías de la dirección", la firma del cliente y el comentario, en la misma página
     * de las últimas fotos. Trae también el logo del cliente y el sello de Drivin (con transparencia), que no son
     * fotos y se dibujan al final de la primera página, como en el real.
     *
     * @param  list<string>  $fotos  bytes JPEG
     * @param  array{fecha?: string, hora?: string, ventana?: string, intento?: int, unidades?: string, estado?: string, comentario?: ?string, firma?: bool}  $o
     */
    public function pdfDrivin(string $codigo, array $fotos, array $o = []): string
    {
        $o += ['fecha' => '2026-10-05', 'hora' => '10:00', 'ventana' => '07:00 - 17:00', 'intento' => 1, 'unidades' => '1.0 / 1.0', 'estado' => 'Aprobada', 'comentario' => 'Entrega exitosa, el cliente revisa y está en buen estado', 'firma' => true];

        $objetos = [];
        $nuevo = function (?string $contenido = null) use (&$objetos): int {
            $objetos[] = $contenido;

            return count($objetos);
        };
        $imagen = fn (string $jpeg, string $extra = '') => $nuevo('<< /Type /XObject /Subtype /Image /Width '.getimagesizefromstring($jpeg)[0].' /Height '.getimagesizefromstring($jpeg)[1]." /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode{$extra} /Length ".strlen($jpeg)." >>\nstream\n{$jpeg}\nendstream");
        // Una línea de texto por orden de escribir, en WinAnsi (las tildes)
        $linea = fn (string $texto, int $x, int $y, int $tamano = 9) => "BT /F1 {$tamano} Tf {$x} {$y} Td (".str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], mb_convert_encoding($texto, 'Windows-1252', 'UTF-8')).") Tj ET\n";

        $catalogo = $nuevo();
        $paginas = $nuevo();
        $fuente = $nuevo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

        $logo = $imagen($this->lienzo(150, 70, [40, 40, 40]));
        $mascara = $nuevo("<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 4 >>\nstream\n\xFF\x00\x00\xFF\nendstream");
        $sello = $imagen($this->lienzo(480, 480, [0, 190, 210]), " /SMask {$mascara} 0 R");
        $idsFotos = array_map($imagen, $fotos);
        $firma = $o['firma'] ? $imagen($this->lienzo(320, 240, [252, 252, 252])) : null;

        // Página 1: datos, tabla y las dos primeras fotos; después, de a cuatro por página
        $primera = '';
        $y = 800;
        foreach (array_filter([
            'Informe de prueba de entrega', 'Información general', 'Nombre dirección: CLIENTE DE PRUEBA', 'Vehículo: abc123',
            'Conductor: CONDUCTOR DE PRUEBA', 'Código de ruta: 1000001', "Ventana horaria: {$o['ventana']}", "Fecha de entrega: {$o['fecha']}",
            "Hora de entrega: {$o['hora']}", "Número de intento: {$o['intento']}", 'Detalle de órdenes',
            'Código de orden', 'Estado', 'Código ítem', 'Descripción', 'Unidades entregadas', 'ENTRGE', 'AS',
            substr($codigo, 0, 9), substr($codigo, 9), $o['estado'], '3068813', 'SOFACAMA GRIS', $o['unidades'], 'Aprobada',
            'Fotografías de la dirección',
        ], fn (string $t) => $t !== '') as $texto) {
            $primera .= $linea($texto, 40, $y);
            $y -= 12;
        }

        $grupos = [array_slice($idsFotos, 0, 2), ...array_chunk(array_slice($idsFotos, 2), 4)];
        $hijos = [];
        foreach ($grupos as $p => $grupo) {
            $contenido = $p === 0 ? $primera : '';
            $recursos = '';
            foreach ($grupo as $i => $id) {
                $contenido .= 'q 200 0 0 150 '.(40 + ($i % 2) * 260).' '.(($p === 0 ? 300 : 620) - intdiv($i, 2) * 170)." cm /Im{$id} Do Q\n".$linea(' ', 40, 40);
                $recursos .= "/Im{$id} {$id} 0 R ";
            }
            // La firma y el comentario, en la página de las últimas fotos
            if ($p === count($grupos) - 1) {
                $contenido .= $linea('Firma', 40, 250, 12);
                if ($firma) {
                    $contenido .= "q 80 0 0 60 40 180 cm /Im{$firma} Do Q\n";
                    $recursos .= "/Im{$firma} {$firma} 0 R ";
                }
                $contenido .= $linea('Comentario', 40, 150, 12).($o['comentario'] ? $linea($o['comentario'], 40, 130) : '').$linea('Drivin 2026 | Todos los derechos reservados.', 200, 40, 7);
            }
            // El logo y el sello se dibujan al final de la primera página
            if ($p === 0) {
                $contenido .= "q 100 0 0 47 250 790 cm /Im{$logo} Do Q\nq 120 0 0 120 440 680 cm /Im{$sello} Do Q\n";
                $recursos .= "/Im{$logo} {$logo} 0 R /Im{$sello} {$sello} 0 R ";
            }
            $flujo = $nuevo('<< /Length '.strlen($contenido)." >>\nstream\n{$contenido}endstream");
            $hijos[] = $nuevo("<< /Type /Page /Parent {$paginas} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 {$fuente} 0 R >> /XObject << {$recursos}>> >> /Contents {$flujo} 0 R >>");
        }

        $objetos[$paginas - 1] = '<< /Type /Pages /Kids ['.implode(' ', array_map(fn ($h) => "{$h} 0 R", $hijos)).'] /Count '.count($hijos).' >>';
        $objetos[$catalogo - 1] = "<< /Type /Catalog /Pages {$paginas} 0 R >>";

        return $this->ensamblar($objetos, $catalogo);
    }

    /** Un JPEG de un color, del tamaño dado (el logo, el sello, la firma). */
    private function lienzo(int $ancho, int $alto, array $color): string
    {
        $img = imagecreatetruecolor($ancho, $alto);
        imagefilledrectangle($img, 0, 0, $ancho, $alto, imagecolorallocate($img, ...$color));
        imageline($img, 10, $alto - 20, $ancho - 10, 20, imagecolorallocate($img, 20, 20, 20));
        ob_start();
        imagejpeg($img, null, 80);
        imagedestroy($img);

        return (string) ob_get_clean();
    }

    /** @param  list<?string>  $objetos */
    private function ensamblar(array $objetos, int $catalogo): string
    {
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
