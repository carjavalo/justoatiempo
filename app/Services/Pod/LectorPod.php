<?php

namespace App\Services\Pod;

use Illuminate\Support\Str;
use Smalot\PdfParser\Page;
use Smalot\PdfParser\Parser;
use Smalot\PdfParser\XObject\Image;

/**
 * Lee el PDF de prueba de entrega de Drivin, sin IA: lo que dice (sus órdenes, unidades entregadas, hora y ventana,
 * intento, comentario, si el cliente firmó) y sus fotos, una por una.
 *
 * Además de las fotos, el PDF trae el logo del cliente, el sello de Drivin y la firma del cliente. El logo se reconoce
 * por su tamaño, el sello por su transparencia y la firma porque va después del título «Firma». Un PDF sin esas
 * secciones (p. ej. armado a mano) se toma entero como fotos.
 *
 * @phpstan-type Lectura array{codigos: list<string>, datos: array<string, mixed>, fotos: list<array{bytes: string, pagina: int}>, firma: ?array{bytes: string, pagina: int}}
 */
class LectorPod
{
    /** El lado corto mínimo de una foto, en píxeles: lo menor es un logo o un ícono. */
    private const LADO_MINIMO = 200;

    /** @return Lectura|null null si el archivo no se puede leer como PDF */
    public function leer(string $ruta): ?array
    {
        try {
            $paginas = (new Parser)->parseFile($ruta)->getPages();
        } catch (\Throwable) {
            return null;
        }

        $texto = '';
        foreach ($paginas as $pagina) {
            try {
                $texto .= $pagina->getText()."\n";
            } catch (\Throwable) {
                // Una página que no se deja leer no impide leer las demás
            }
        }

        [$fotos, $firma, $hayFirma, $sinSeparar] = $this->imagenes($paginas, str_contains(self::normalizar($texto), 'fotograf'));

        return [
            'codigos' => $this->codigos($texto),
            'datos' => [
                ...$this->datos($texto),
                // Las órdenes que nombra su tabla (con las terminaciones posibles): vacío si no trae la tabla de Drivin
                'ordenes' => $this->tabla($texto) !== null ? $this->codigos($texto) : [],
                // Las fotos de la entrega: las separadas y las que no se pudieron separar (siguen en el PDF)
                'fotos' => count($fotos) + $sinSeparar,
                'sin_separar' => $sinSeparar,
                'firma' => $hayFirma,
            ],
            'fotos' => $fotos,
            'firma' => $firma,
        ];
    }

    /**
     * Los posibles códigos de orden del PDF ("PDVT000242599"), de la tabla "Detalle de órdenes" si la trae. El texto se
     * lee sin espacios porque la tabla parte el código en dos renglones; así las letras pueden quedar pegadas al
     * encabezado ("ENTREGASPDVT0002…"), y por eso salen todas las terminaciones posibles: cuál es una orden lo dice la
     * base de datos.
     *
     * @return list<string>
     */
    private function codigos(string $texto): array
    {
        $tabla = $this->tabla($texto) ?? $texto;
        preg_match_all('/([A-Z]{2,})(\d{4,})/', preg_replace('/\s+/u', '', $tabla), $m, PREG_SET_ORDER);

        $codigos = [];
        foreach ($m as [, $letras, $numeros]) {
            for ($largo = 2; $largo <= min(8, strlen($letras)); $largo++) {
                $codigos[] = substr($letras, -$largo).$numeros;
            }
        }

        return array_values(array_unique($codigos));
    }

    /** La tabla de órdenes: entre "Detalle de órdenes" y "Fotografías". */
    private function tabla(string $texto): ?string
    {
        return preg_match('/Detalle de .rdenes(.*?)(?:Fotograf|\z)/su', $texto, $m) ? $m[1] : null;
    }

    /** @return array<string, mixed> */
    private function datos(string $texto): array
    {
        // Las etiquetas con tilde se buscan con comodín: el texto del PDF no siempre trae la tilde bien
        $campo = fn (string $patron) => preg_match($patron, $texto, $m) ? (trim($m[1]) ?: null) : null;
        $tabla = $this->tabla($texto) ?? '';

        // Unidades entregadas de cada producto, "1.0 / 1.0": se suman
        $unidades = null;
        if (preg_match_all('/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/', $tabla, $u, PREG_SET_ORDER)) {
            $numero = fn (string $n) => (float) str_replace(',', '.', $n);
            $unidades = [
                'entregadas' => array_sum(array_map(fn ($x) => $numero($x[1]), $u)),
                'pedidas' => array_sum(array_map(fn ($x) => $numero($x[2]), $u)),
            ];
        }

        $intento = $campo('/N.mero de intento:\s*(\d+)/u');

        return [
            'vehiculo' => $campo('/Veh.culo:[ \t]*([^\n]+)/u'),
            'conductor' => $campo('/Conductor:[ \t]*([^\n]+)/u'),
            'ruta' => $campo('/C.digo de ruta:[ \t]*([^\n]+)/u'),
            'fecha' => $campo('/Fecha de entrega:\s*(\d{4}-\d{2}-\d{2})/u'),
            'hora' => self::hora($campo('/Hora de entrega:\s*(\d{1,2}:\d{2})/u')),
            'ventana' => preg_match('/Ventana horaria:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/u', $texto, $v) ? [self::hora($v[1]), self::hora($v[2])] : null,
            'intento' => $intento !== null ? (int) $intento : null,
            'coordenadas' => preg_match('/Coordenadas:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/u', $texto, $c) ? [(float) $c[1], (float) $c[2]] : null,
            // El estado de la orden es el primero de la tabla (después viene el de cada producto)
            'estado' => preg_match('/\b(Aprobada|Rechazada|Pendiente|Parcial|Cancelada|Fallida)\b/u', $tabla, $e) ? $e[1] : null,
            'unidades' => $unidades,
            'comentario' => $this->comentario($texto),
        ];
    }

    /** Lo que escribió el conductor: después del último título "Comentario", hasta el pie de Drivin. */
    private function comentario(string $texto): ?string
    {
        $partes = preg_split('/^\s*Comentario\s*$/mu', $texto);
        if (count($partes) < 2) {
            return null;
        }
        $comentario = preg_split('/\n\s*Drivin\s+\d{4}/u', end($partes))[0];
        $comentario = trim(preg_replace('/\s+/u', ' ', $comentario));

        return $comentario !== '' ? Str::limit($comentario, 1000, '…') : null;
    }

    /**
     * Las imágenes del PDF en el orden en que se dibujan. El texto leído hasta cada una dice en qué sección va:
     * antes de "Fotografías" (encabezado), entre "Fotografías" y "Firma" (fotos), después de "Firma" (la firma) o
     * después de "Comentario".
     *
     * @param  list<Page>  $paginas
     * @return array{0: list<array{bytes: string, pagina: int}>, 1: ?array{bytes: string, pagina: int}, 2: bool, 3: int}
     */
    private function imagenes(array $paginas, bool $conSecciones): array
    {
        $fotos = [];
        $firma = null;
        $hayFirma = false;
        $sinSeparar = 0;
        $vistas = [];
        $leido = '';

        foreach ($paginas as $n => $pagina) {
            try {
                // Un texto por cada orden de escribir (Tj, TJ…), en el mismo orden que los comandos
                $textos = array_map(fn ($t) => (string) ($t[1] ?? ''), $pagina->getDataTm());
                $comandos = $pagina->extractDecodedRawData();
            } catch (\Throwable) {
                continue;
            }

            $k = 0;
            foreach ($comandos as $comando) {
                if (in_array($comando['o'], ['Tj', 'TJ', "'", '"'], true)) {
                    $leido .= self::normalizar($textos[$k++] ?? '');

                    continue;
                }
                if ($comando['o'] !== 'Do') {
                    continue;
                }

                $imagen = $pagina->getXObject(ltrim(trim((string) $comando['c']), '/'));
                if (! $imagen instanceof Image) {
                    continue;
                }
                $seccion = $conSecciones ? self::seccion($leido) : 'fotos';

                if ($seccion === 'firma') {
                    $hayFirma = true;
                    $bytes = $firma === null ? self::jpeg($imagen) : null;
                    $firma ??= $bytes !== null ? ['bytes' => $bytes, 'pagina' => $n + 1] : null;

                    continue;
                }

                // El sello de Drivin trae transparencia y el logo es pequeño: ninguno es una foto
                $cabecera = $imagen->getHeader();
                $lado = min((int) $cabecera->get('Width')->getContent(), (int) $cabecera->get('Height')->getContent());
                if ($seccion !== 'fotos' || $cabecera->has('SMask') || $lado < self::LADO_MINIMO) {
                    continue;
                }

                $bytes = self::jpeg($imagen);
                if ($bytes === null) {
                    $sinSeparar++; // una foto que no viene en JPEG: se ve en el PDF

                    continue;
                }
                // La misma imagen dibujada dos veces es una sola foto
                if (isset($vistas[$huella = sha1($bytes)])) {
                    continue;
                }
                $vistas[$huella] = true;
                $fotos[] = ['bytes' => $bytes, 'pagina' => $n + 1];
            }
        }

        return [$fotos, $firma, $hayFirma, $sinSeparar];
    }

    private static function seccion(string $leido): string
    {
        $fotos = strpos($leido, 'fotograf');
        if ($fotos === false) {
            return 'encabezado';
        }
        $firma = strpos($leido, 'firma', $fotos);
        if ($firma === false) {
            return 'fotos';
        }

        return strpos($leido, 'comentario', $firma) === false ? 'firma' : 'final';
    }

    /** Los bytes de la imagen si es un JPEG (así vienen las fotos de Drivin); si no, null. */
    private static function jpeg(Image $imagen): ?string
    {
        try {
            $bytes = $imagen->getContent();
        } catch (\Throwable) {
            return null;
        }

        return str_starts_with($bytes, "\xFF\xD8\xFF") ? $bytes : null;
    }

    /** "7:00" → "07:00", para comparar horas como texto. */
    private static function hora(?string $hora): ?string
    {
        return $hora === null ? null : str_pad($hora, 5, '0', STR_PAD_LEFT);
    }

    /** Solo letras, sin tildes ni mayúsculas: "Fotografías de la dirección" → "fotografiasdeladireccion". */
    private static function normalizar(string $texto): string
    {
        return preg_replace('/[^a-z]/', '', Str::lower(Str::ascii($texto)));
    }
}
