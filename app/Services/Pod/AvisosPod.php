<?php

namespace App\Services\Pod;

use App\Enums\TipoEvidencia;
use App\Models\Evidencia;
use App\Models\Orden;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

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

        // ¿Es el PDF de esta orden? La orden que nombra y la fecha de la entrega deben ser las de la carga de Drivin
        if (($ordenes = $datos['ordenes'] ?? []) && ! in_array(strtoupper($orden->codigo_orden), $ordenes, true)) {
            $aviso('atencion', 'El PDF no nombra esta orden: puede ser el de otra entrega');
        }
        if (($fecha = $datos['fecha'] ?? null) && $orden->fecha_operacion && $fecha !== $orden->fecha_operacion->toDateString()) {
            $aviso('atencion', 'El PDF es de una entrega del '.Carbon::parse($fecha)->translatedFormat('j \d\e F').' y esta orden es del '
                .$orden->fecha_operacion->translatedFormat('j \d\e F').': revisa que sea su PDF');
        }

        if ($u = $datos['unidades'] ?? null) {
            $pedidas = self::numero($u['pedidas']);
            $completa = $u['entregadas'] >= $u['pedidas'];
            $aviso($completa ? 'bien' : 'atencion', 'Entregó '.self::numero($u['entregadas'])." de {$pedidas} ".((float) $u['pedidas'] === 1.0 ? 'unidad' : 'unidades'));
        }

        $estado = $datos['estado'] ?? null;
        if ($estado && mb_strtolower($estado) !== $orden->estado->value) {
            $aviso('atencion', "El PDF dice que la orden quedó «{$estado}»");
        }

        [$hora, $ventana] = [$orden->hora_entrega?->format('H:i') ?? $datos['hora'] ?? null, $datos['ventana'] ?? null];
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

    /**
     * Lo que propuso la IA de las fotos (RevisorIa), para el auditor: posibles daños con el número de la foto, qué dice
     * la remesa y cuántas fotos son copias. Es una propuesta: el auditor la confirma mirando las fotos.
     *
     * @param  Collection<int, Evidencia>  $fotos  en el orden en que se muestran (su posición es "Foto n")
     * @return list<array{nivel: 'bien'|'atencion'|'info', texto: string}>
     */
    public static function deIa(Collection $fotos): array
    {
        $avisos = [];
        $producto = $fotos->filter(fn (Evidencia $f) => in_array($f->tipo, [TipoEvidencia::Sellado, TipoEvidencia::Destapado], true) && isset($f->ia['revision']));

        foreach ($producto as $i => $f) {
            if (($f->ia['revision']['estado'] ?? null) === 'posible_dano') {
                $avisos[] = ['nivel' => 'atencion', 'texto' => 'Foto '.($i + 1).': posible daño'.(($d = $f->ia['revision']['detalle'] ?? null) ? " ({$d})" : '')];
            }
        }
        $sanas = $producto->filter(fn (Evidencia $f) => ($f->ia['revision']['estado'] ?? null) === 'bien')->count();
        if ($sanas && $sanas === $producto->count()) {
            $avisos[] = ['nivel' => 'bien', 'texto' => $sanas === 1 ? 'El producto se ve en buen estado en la foto revisada' : "El producto se ve en buen estado en las {$sanas} fotos revisadas"];
        }

        $remesas = $fotos->filter(fn (Evidencia $f) => $f->tipo === TipoEvidencia::Remesa && isset($f->ia['remesa']));
        if ($remesas->isNotEmpty()) {
            $avisos[] = $remesas->contains(fn (Evidencia $f) => $f->ia['remesa']['firmada'])
                ? ['nivel' => 'bien', 'texto' => 'La remesa está firmada']
                : ['nivel' => 'atencion', 'texto' => 'La remesa no parece firmada: revísala'];
            if ($remesas->contains(fn (Evidencia $f) => $f->ia['remesa']['sin_destapar'])) {
                $avisos[] = ['nivel' => 'info', 'texto' => 'La remesa dice que el cliente recibe sin destapar'];
            }
            foreach ($remesas->filter(fn (Evidencia $f) => $f->ia['remesa']['novedad']) as $f) {
                $avisos[] = ['nivel' => 'atencion', 'texto' => 'En la remesa marcaron una novedad'.(($d = $f->ia['revision']['detalle'] ?? null) ? ": «{$d}»" : '')];
            }
        }

        $copias = $fotos->filter(fn (Evidencia $f) => ($f->ia['clasificacion']['copia'] ?? false) && $f->tipo === TipoEvidencia::Repetida)->count();
        if ($copias) {
            $avisos[] = ['nivel' => 'info', 'texto' => ($copias === 1 ? '1 foto es copia de otra' : "{$copias} fotos son copias de otras").' (foto de la pantalla de un celular): quedaron como repetidas'];
        }

        return $avisos;
    }

    /** 1.0 → "1"; 1.5 → "1,5". */
    private static function numero(float|int $n): string
    {
        return rtrim(rtrim(number_format((float) $n, 2, ',', '.'), '0'), ',');
    }
}
