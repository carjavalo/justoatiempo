<?php

namespace App\Support;

/**
 * NIT colombiano: separa número y dígito de verificación (DV) y calcula el DV con el
 * algoritmo de la DIAN (módulo 11 con pesos primos, de derecha a izquierda).
 */
final class Nit
{
    private const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

    /**
     * Acepta "900.123.456-7", "900123456-7" o solo el número ("900123456").
     *
     * @return array{0: string, 1: int|null}|null [número, DV escrito] o null si el formato no es válido
     */
    public static function partes(string $texto): ?array
    {
        $limpio = preg_replace('/[\s.\x{FEFF}]/u', '', trim($texto)) ?? '';

        if (! preg_match('/^(\d{6,15})(?:-(\d))?$/', $limpio, $m)) {
            return null;
        }

        return [ltrim($m[1], '0') ?: '0', isset($m[2]) ? (int) $m[2] : null];
    }

    public static function digitoVerificacion(string $numero): int
    {
        $suma = 0;
        foreach (str_split(strrev($numero)) as $i => $digito) {
            $suma += (int) $digito * self::PESOS[$i];
        }
        $residuo = $suma % 11;

        return $residuo > 1 ? 11 - $residuo : $residuo;
    }

    /** Forma en que se guarda: número sin puntos, guion y DV ("900123456-7"). */
    public static function normalizar(string $texto): ?string
    {
        $partes = self::partes($texto);

        return $partes ? $partes[0].'-'.self::digitoVerificacion($partes[0]) : null;
    }
}
