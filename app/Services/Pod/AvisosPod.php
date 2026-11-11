<?php

namespace App\Services\Pod;

use App\Models\Orden;

/**
 * Lo que Drivin dice de una entrega (el PDF de prueba de entrega y el comentario del conductor), en frases para el
 * auditor: lo que está bien y lo que hay que mirar. Sin IA: solo lo que está escrito.
 */
class AvisosPod
{
    /** Palabras de un producto en mal estado. */
    private const DANO = '/\b(golpe\w*|rot[oa]s?|rotura\w*|partid[oa]s?|quebrad[oa]s?|rayad[oa]s?|ray[oó]n\w*|abollad[oa]s?|aver[ií]\w*|da[ñn]ad[oa]s?|da[ñn]os?|h[uú]med[oa]s?|humedad|mojad[oa]s?|mal estado|defectuos[oa]s?|hundid[oa]s?|rasgad[oa]s?|manchad[oa]s?|incomplet[oa]s?)\b/iu';

    /** Lo que niega la palabra que sigue: "sin daños", "no hay golpes", "ningún rayón" (no "sin novedad, rayado"). */
    private const NEGACION = '/\b(sin|no|ni|cero|ning[uú]n[oa]?)\s+(?:[^\s,.;:]+\s+)?$/iu';

    /** El comentario dice que el cliente recibió sin destapar (la excepción del protocolo, que se confirma en la remesa). */
    public static function recibeSinDestapar(?string $comentario): bool
    {
        return $comentario !== null && preg_match('/sin\s+destapar|no\s+(?:se\s+)?destap/iu', $comentario) === 1;
    }

    /** La primera palabra del comentario que habla de un daño, si no está negada. */
    public static function posibleDano(?string $comentario): ?string
    {
        if (! $comentario || ! preg_match_all(self::DANO, $comentario, $m, PREG_OFFSET_CAPTURE)) {
            return null;
        }
        foreach ($m[1] as [$palabra, $posicion]) {
            if (! preg_match(self::NEGACION, mb_substr(substr($comentario, 0, $posicion), -30))) {
                return mb_strtolower($palabra);
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $datos  lo que leyó LectorPod del PDF
     * @param  string|null  $firma  la dirección de la imagen de la firma, que acompaña al aviso de que firmó
     * @return list<array{nivel: 'bien'|'atencion'|'info', texto: string, imagen?: string}>
     */
    public static function de(array $datos, Orden $orden, ?string $comentario, ?string $firma = null): array
    {
        $avisos = [];
        $aviso = function (string $nivel, string $texto, ?string $imagen = null) use (&$avisos) {
            $avisos[] = ['nivel' => $nivel, 'texto' => $texto, ...($imagen ? ['imagen' => $imagen] : [])];
        };

        if ($u = $datos['unidades'] ?? null) {
            $pedidas = self::numero($u['pedidas']);
            $completa = $u['entregadas'] >= $u['pedidas'];
            $aviso($completa ? 'bien' : 'atencion', 'Entregó '.self::numero($u['entregadas'])." de {$pedidas} ".((float) $u['pedidas'] === 1.0 ? 'unidad' : 'unidades'));
        }

        $estado = $datos['estado'] ?? null;
        if ($estado && mb_strtolower($estado) !== $orden->estado->value) {
            $aviso('atencion', "El PDF dice que la orden quedó «{$estado}»");
        }

        [$hora, $ventana] = [$datos['hora'] ?? null, $datos['ventana'] ?? null];
        if ($hora && $ventana) {
            $aTiempo = $hora >= $ventana[0] && $hora <= $ventana[1];
            $aviso($aTiempo ? 'bien' : 'atencion', "A las {$hora}, ".($aTiempo ? 'dentro' : 'fuera')." de la ventana de {$ventana[0]} a {$ventana[1]}");
        }

        if (($intento = $datos['intento'] ?? null) !== null) {
            $intento <= 1 ? $aviso('bien', 'En el primer intento') : $aviso('atencion', "En el intento n.° {$intento}");
        }

        if (array_key_exists('firma', $datos)) {
            $datos['firma'] ? $aviso('bien', 'El cliente firmó en la app', $firma) : $aviso('info', 'El cliente no firmó en la app');
        }

        if ($palabra = self::posibleDano($comentario)) {
            $aviso('atencion', "El comentario habla de un posible daño («{$palabra}»): revisa las fotos del producto");
        }
        if (self::recibeSinDestapar($comentario)) {
            $aviso('info', 'El comentario dice que el cliente recibió sin destapar: confírmalo en la remesa');
        }

        if ($sinSeparar = (int) ($datos['sin_separar'] ?? 0)) {
            $aviso('atencion', ($sinSeparar === 1 ? '1 foto del PDF no se pudo separar: mírala' : "{$sinSeparar} fotos del PDF no se pudieron separar: míralas").' en el PDF');
        }

        return $avisos;
    }

    /** 1.0 → "1"; 1.5 → "1,5". */
    private static function numero(float|int $n): string
    {
        return rtrim(rtrim(number_format((float) $n, 2, ',', '.'), '0'), ',');
    }
}
