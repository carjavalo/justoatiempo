<?php

namespace App\Services\Pod;

use App\Models\AuditoriaPod;

/**
 * Reglas del protocolo de prueba de entrega (RF-09 y RF-10) y sugerencia de novedad y concepto.
 * La decisión "cumple / no cumple" es la misma de AuditoriaPod::evaluarProtocolo().
 */
class EvaluadorProtocolo
{
    /**
     * Las fotos sellado y destapado son las que se ven bien: las borrosas o ilegibles (fotos_ilegibles) no cuentan, pero
     * dejan su novedad.
     *
     * @param  array{foto_fachada: bool, fotos_sellado: int, fotos_destapado: int, foto_remesa: bool, recibe_sin_destapar: bool, sin_evidencia: bool, fotos_ilegibles?: int}  $c
     * @return array{cumple: bool, faltantes: list<string>, novedad: string, concepto: string}
     */
    public static function evaluar(array $c): array
    {
        if ($c['sin_evidencia']) {
            return [
                'cumple' => false,
                'faltantes' => ['todas las evidencias'],
                'novedad' => 'Sin evidencia',
                'concepto' => 'La entrega no tiene evidencias cargadas.',
            ];
        }

        $ilegibles = (int) ($c['fotos_ilegibles'] ?? 0);
        $notaIlegibles = $ilegibles > 0
            ? ' '.($ilegibles === 1 ? '1 foto borrosa o ilegible no se tuvo' : "{$ilegibles} fotos borrosas o ilegibles no se tuvieron").' en cuenta.'
            : '';
        $minSellado = AuditoriaPod::MIN_FOTOS_SELLADO;
        $minDestapado = AuditoriaPod::MIN_FOTOS_DESTAPADO;
        $faltaFachada = ! $c['foto_fachada'];
        $faltaRemesa = ! $c['foto_remesa'];
        $faltaSellado = $c['fotos_sellado'] < $minSellado;
        $faltaDestapado = ! $c['recibe_sin_destapar'] && $c['fotos_destapado'] < $minDestapado;

        $faltantes = array_values(array_filter([
            $faltaFachada ? 'foto de fachada' : null,
            $faltaSellado ? "fotos del producto sellado ({$c['fotos_sellado']} de {$minSellado})" : null,
            $faltaDestapado ? "fotos del producto destapado ({$c['fotos_destapado']} de {$minDestapado})" : null,
            $faltaRemesa ? 'remesa firmada' : null,
        ]));

        if ($faltantes === []) {
            return [
                'cumple' => true,
                'faltantes' => [],
                // Cumple con las que se ven bien, pero hubo fotos que no sirvieron
                'novedad' => $ilegibles > 0 ? 'Buen protocolo de entrega pero puede mejorar' : ($c['recibe_sin_destapar'] ? 'Entregado sin destapar con nota en remesa' : 'Buen protocolo de entrega'),
                'concepto' => ($c['recibe_sin_destapar']
                    ? 'Buen protocolo: fachada, producto sellado y remesa con la nota "Recibe sin destapar a conformidad".'
                    : 'Buen protocolo de entrega: fachada, producto sellado y destapado, y remesa firmada.').$notaIlegibles,
            ];
        }

        // La novedad principal es la omisión más grave; el concepto las detalla todas. Si lo que falta son fotos del
        // producto y hubo fotos que no se pudieron ver, la causa son esas fotos
        $novedad = match (true) {
            $faltaFachada && $faltaRemesa => 'Falta foto de fachada y remesa firmada',
            $faltaRemesa => 'Falta remesa firmada',
            $faltaFachada => 'Falta foto de fachada',
            $ilegibles > 0 => 'Fotos borrosas o ilegibles',
            $faltaSellado => 'Faltan fotos de producto sellado',
            default => 'Faltan fotos de producto destapado',
        };

        return [
            'cumple' => false,
            'faltantes' => $faltantes,
            'novedad' => $novedad,
            'concepto' => 'Falta: '.self::enumerar($faltantes).'.'.$notaIlegibles,
        ];
    }

    /** @param list<string> $items */
    private static function enumerar(array $items): string
    {
        if (count($items) <= 1) {
            return $items[0] ?? '';
        }

        return implode(', ', array_slice($items, 0, -1)).' y '.end($items);
    }
}
