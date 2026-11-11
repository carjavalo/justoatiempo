<?php

namespace App\Services\Pod;

/**
 * Junta varias fotos en una sola imagen, cada una con su número grande en una esquina. Groq cobra cada imagen igual
 * (2048 tokens) sin importar su tamaño, así que un mosaico de 16 fotos cuesta lo mismo que una sola foto: la IA las ve
 * más pequeñas, pero alcanza para decir qué muestra cada una.
 */
class Mosaico
{
    /**
     * @param  array<int, string>  $fotos  número => bytes de la imagen (JPEG, PNG o WebP)
     * @return string bytes JPEG del mosaico
     */
    public function armar(array $fotos, int $columnas, int $lado): string
    {
        $filas = max(1, (int) ceil(count($fotos) / $columnas));
        $lienzo = imagecreatetruecolor($columnas * $lado, $filas * $lado);
        imagefilledrectangle($lienzo, 0, 0, $columnas * $lado, $filas * $lado, imagecolorallocate($lienzo, 32, 32, 32));

        $i = 0;
        foreach ($fotos as $numero => $bytes) {
            $x = ($i % $columnas) * $lado;
            $y = intdiv($i, $columnas) * $lado;
            $i++;

            $foto = @imagecreatefromstring($bytes);
            if ($foto !== false) {
                // Entera dentro de su casilla, sin recortar, con un borde que separa las fotos
                [$ancho, $alto] = [imagesx($foto), imagesy($foto)];
                $escala = min(($lado - 6) / $ancho, ($lado - 6) / $alto);
                $w = max(1, (int) round($ancho * $escala));
                $h = max(1, (int) round($alto * $escala));
                imagecopyresampled($lienzo, $foto, $x + intdiv($lado - $w, 2), $y + intdiv($lado - $h, 2), 0, 0, $w, $h, $ancho, $alto);
                imagedestroy($foto);
            }

            $this->numero($lienzo, $x + 4, $y + 4, (string) $numero, max(2, intdiv($lado, 110)));
        }

        ob_start();
        imagejpeg($lienzo, null, 82);
        imagedestroy($lienzo);

        return (string) ob_get_clean();
    }

    /**
     * Una sola foto, reducida a un lado máximo y con su número (p. ej. la remesa, que se lee mejor grande), girada en el
     * sentido del reloj los grados dados para que el texto quede derecho.
     */
    public function sola(int $numero, string $bytes, int $lado, int $girar = 0): string
    {
        if (in_array($girar, [90, 180, 270], true) && ($foto = @imagecreatefromstring($bytes)) !== false) {
            // imagerotate gira en contra del reloj
            $girada = imagerotate($foto, 360 - $girar, 0);
            imagedestroy($foto);
            ob_start();
            imagejpeg($girada, null, 90);
            imagedestroy($girada);
            $bytes = (string) ob_get_clean();
        }

        return $this->armar([$numero => $bytes], 1, $lado);
    }

    /** El número en blanco sobre un recuadro rojo, ampliado desde la letra del sistema (no hace falta una fuente). */
    private function numero(\GdImage $lienzo, int $x, int $y, string $texto, int $escala): void
    {
        $w = strlen($texto) * imagefontwidth(5) + 6;
        $h = imagefontheight(5) + 4;
        $chico = imagecreatetruecolor($w, $h);
        imagefilledrectangle($chico, 0, 0, $w, $h, imagecolorallocate($chico, 200, 30, 30));
        imagestring($chico, 5, 3, 2, $texto, imagecolorallocate($chico, 255, 255, 255));
        imagecopyresized($lienzo, $chico, $x, $y, 0, 0, $w * $escala, $h * $escala, $w, $h);
        imagedestroy($chico);
    }
}
