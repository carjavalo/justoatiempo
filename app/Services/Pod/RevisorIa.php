<?php

namespace App\Services\Pod;

use App\Enums\TipoEvidencia;
use App\Models\Evidencia;
use App\Models\Orden;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * La IA de visión (Groq) revisa las fotos de una orden y PROPONE qué muestra cada una, cuáles son copias de otras, si
 * el producto se ve bien y si la remesa está firmada. El auditor confirma: la IA solo le pone tipo a las fotos que
 * siguen sin clasificar, y lo que propuso queda aparte (evidencias.ia).
 *
 * Va por pasos, una consulta por llamada a avanzar(), porque el plan gratis de Groq deja pocas imágenes por minuto: el
 * navegador repite hasta terminar y espera cuando Groq lo pide.
 *  1. Clasificar: todas las fotos en mosaicos de 16 (hasta 32 por consulta), para que la IA vea juntas las copias.
 *  2. Revisar: el producto (sellado y destapado) en mosaicos de 4, más grande, para ver daños; la remesa, sola.
 */
class RevisorIa
{
    /** Imágenes por consulta: cada una cuenta 2048 tokens y el plan gratis permite 8.000 por minuto. */
    private const IMAGENES = 2;

    private const CLASIFICAR = ['columnas' => 4, 'por_imagen' => 16, 'lado' => 320];

    private const REVISAR = ['columnas' => 2, 'por_imagen' => 4, 'lado' => 640, 'remesa' => 1280];

    private const TIPOS = ['fachada', 'sellado', 'destapado', 'remesa', 'rotulo', 'ilegible', 'otro'];

    private const ESTADOS = ['bien', 'posible_dano', 'no_se_ve'];

    public function __construct(private Mosaico $mosaico) {}

    public function disponible(): bool
    {
        return filled(config('services.groq.key'));
    }

    /**
     * Las fotos de la orden, en el orden en que llegaron: su posición es el número con que la IA y la pantalla las
     * nombran ("Foto 23"). Sin el PDF ni la firma.
     *
     * @return Collection<int, Evidencia>
     */
    public static function fotos(Collection $evidencias): Collection
    {
        return $evidencias->reject(fn (Evidencia $e) => $e->esPdf() || $e->tipo === TipoEvidencia::Firma)->sortBy('id')->values();
    }

    /** Cuántas fotos le faltan a la IA: por clasificar o, las del producto y la remesa, por revisar. */
    public function pendientes(Collection $fotos): int
    {
        return $this->porClasificar($fotos)->count() + $this->porRevisar($fotos)->count();
    }

    /**
     * Un paso: una consulta a la IA con las siguientes fotos pendientes.
     *
     * @return array{listo: bool, revisadas: int, mensaje: string}
     *
     * @throws LimiteIa si Groq pide esperar
     * @throws \RuntimeException si la IA no responde o no responde bien
     */
    public function avanzar(Orden $orden): array
    {
        $fotos = self::fotos($orden->evidencias()->get());
        $revisadas = 0;

        if (($lote = $this->porClasificar($fotos)->take(self::IMAGENES * self::CLASIFICAR['por_imagen']))->isNotEmpty()) {
            $revisadas = $this->clasificar($fotos, $lote);
        } elseif (($grupos = $this->gruposPorRevisar($fotos)) !== []) {
            $revisadas = $this->revisar($fotos, $grupos);
        }

        $quedan = $this->pendientes(self::fotos($orden->evidencias()->get()));

        return [
            'listo' => $quedan === 0,
            'revisadas' => $revisadas,
            'mensaje' => $quedan === 0 ? 'La IA terminó.' : ($quedan === 1 ? 'Falta 1 foto.' : "Faltan {$quedan} fotos."),
        ];
    }

    /** @return Collection<int, Evidencia> */
    private function porClasificar(Collection $fotos): Collection
    {
        return $fotos->filter(fn (Evidencia $f) => ! isset($f->ia['clasificacion']));
    }

    /** El producto y la remesa ya clasificados (por la IA o por el auditor) que la IA aún no ha revisado. */
    private function porRevisar(Collection $fotos): Collection
    {
        return $fotos->filter(fn (Evidencia $f) => isset($f->ia['clasificacion']) && ! isset($f->ia['revision'])
            && in_array($f->tipo, [TipoEvidencia::Sellado, TipoEvidencia::Destapado, TipoEvidencia::Remesa], true));
    }

    /**
     * Las imágenes de la siguiente consulta de revisión: la remesa sola (se lee mejor grande) y el producto de a 4.
     *
     * @return list<list<Evidencia>>
     */
    private function gruposPorRevisar(Collection $fotos): array
    {
        $grupos = [];
        $producto = [];
        foreach ($this->porRevisar($fotos) as $foto) {
            if ($foto->tipo === TipoEvidencia::Remesa) {
                $grupos[] = [$foto];

                continue;
            }
            $producto[] = $foto;
            if (count($producto) === self::REVISAR['por_imagen']) {
                $grupos[] = $producto;
                $producto = [];
            }
        }
        if ($producto) {
            $grupos[] = $producto;
        }

        return array_slice($grupos, 0, self::IMAGENES);
    }

    /** Paso 1: qué muestra cada foto y cuáles son copias de otras. */
    private function clasificar(Collection $fotos, Collection $lote): int
    {
        $numero = fn (Evidencia $f) => $fotos->search(fn (Evidencia $x) => $x->id === $f->id) + 1;
        $imagenes = $lote->chunk(self::CLASIFICAR['por_imagen'])
            ->map(fn (Collection $grupo) => $this->mosaico->armar($grupo->mapWithKeys(fn (Evidencia $f) => [$numero($f) => $this->bytes($f)])->all(), self::CLASIFICAR['columnas'], self::CLASIFICAR['lado']))
            ->values()->all();
        $numeros = $lote->map($numero)->values()->all();

        $respuesta = $this->consultar(sprintf(<<<'TXT'
            Eres auditor de entregas a domicilio (muebles y electrodomésticos). Cada imagen es un mosaico con fotos de UNA entrega; cada foto tiene su número en un recuadro rojo. Para cada número (%s) responde:
            - tipo: "fachada" (frente de la casa o edificio, portería o aviso del conjunto: muestra la dirección), "sellado" (el producto en su empaque cerrado: caja o plástico), "destapado" (el producto fuera del empaque, o la caja abierta mostrando el producto), "remesa" (documento en papel: remesa, factura o acta de recibido), "rotulo" (etiqueta pegada en la caja), "ilegible" (borrosa, oscura o no se distingue) u "otro".
            - pantalla: true si es una foto tomada a la pantalla de otro celular o computador: la foto aparece como un recuadro dentro de una pantalla (casi siempre con fondo blanco alrededor), se ve el borde o el marco del teléfono, dedos sosteniéndolo, la barra de hora y batería, el título de una galería ("Imágenes"), reflejos o rayas de la pantalla.
            - copia_de: el número de otra foto de esta consulta que muestra la misma toma (por ejemplo, la foto de la pantalla que muestra esa foto); 0 si no hay.
            - girar: en las remesas y los rótulos, cuántos grados hay que girar la foto en el sentido del reloj para leer el texto derecho ("0", "90", "180" o "270"); "0" en las demás.
            Clasifica lo que se ve aunque sea una foto de pantalla. Responde solo el JSON.
            TXT, implode(', ', $numeros)), $imagenes, [
            'n' => ['type' => 'integer'],
            'tipo' => ['type' => 'string', 'enum' => self::TIPOS],
            'pantalla' => ['type' => 'boolean'],
            'copia_de' => ['type' => 'integer'],
            'girar' => ['type' => 'string', 'enum' => ['0', '90', '180', '270']],
        ]);

        $pantalla = $respuesta->map(fn ($x) => (bool) ($x['pantalla'] ?? false));
        $tipoDe = fn (int $n) => in_array($respuesta->get($n)['tipo'] ?? null, self::TIPOS, true) ? $respuesta->get($n)['tipo'] : null;

        // De cada par de copias que vio la IA, la copia es la foto de la pantalla; si las dos lo son (o ninguna), la que
        // llegó después
        $copias = [];
        foreach ($respuesta as $n => $x) {
            $otra = (int) ($x['copia_de'] ?? 0);
            if ($otra === $n || ! in_array($otra, $numeros, true)) {
                continue;
            }
            $copias[] = $pantalla[$n] !== $pantalla->get($otra, false) ? ($pantalla[$n] ? $n : $otra) : max($n, $otra);
        }

        // Una foto de la pantalla de otro celular repite una que ya está: si hay fotos tomadas directamente de lo mismo
        // (fachada, producto, remesa…), la de la pantalla queda como repetida, para no contar dos veces la misma escena
        // (mejor que el auditor sume una que aprobar con fotos dobles)
        $directas = $fotos->toBase()->filter(fn (Evidencia $f) => isset($f->ia['clasificacion']) && ! $f->ia['clasificacion']['pantalla'])->map(fn (Evidencia $f) => $f->ia['clasificacion']['tipo'])
            ->merge($respuesta->reject(fn ($x, $n) => $pantalla[$n])->keys()->map($tipoDe))
            ->filter()->unique()->all();
        foreach ($pantalla->filter() as $n => $_) {
            if (in_array($tipoDe($n), $directas, true)) {
                $copias[] = $n;
            }
        }

        foreach ($lote as $foto) {
            $n = $numero($foto);
            $x = $respuesta->get($n);
            $tipo = $tipoDe($n);
            $esCopia = in_array($n, $copias, true);

            $foto->ia = [...($foto->ia ?? []), 'modelo' => config('services.groq.modelo'), 'fecha' => now()->toIso8601String(),
                'clasificacion' => ['tipo' => $tipo, 'pantalla' => (bool) ($x['pantalla'] ?? false), 'copia' => $esCopia, 'girar' => (int) ($x['girar'] ?? 0)]];
            // Solo se llena lo que sigue sin clasificar: lo que eligió el auditor no se toca
            if ($foto->tipo === TipoEvidencia::Otro && ($esCopia || $tipo)) {
                $foto->tipo = $esCopia ? TipoEvidencia::Repetida : TipoEvidencia::from($tipo);
            }
            $foto->save();
        }

        return $lote->count();
    }

    /**
     * Paso 2: si el producto se ve bien y qué dice la remesa.
     *
     * @param  list<list<Evidencia>>  $grupos
     */
    private function revisar(Collection $fotos, array $grupos): int
    {
        $numero = fn (Evidencia $f) => $fotos->search(fn (Evidencia $x) => $x->id === $f->id) + 1;
        $lote = collect($grupos)->flatten(1);
        $remesas = $lote->filter(fn (Evidencia $f) => $f->tipo === TipoEvidencia::Remesa)->map($numero)->values()->all();
        $producto = $lote->reject(fn (Evidencia $f) => $f->tipo === TipoEvidencia::Remesa)->map($numero)->values()->all();

        $imagenes = array_map(fn (array $grupo) => count($grupo) === 1 && $grupo[0]->tipo === TipoEvidencia::Remesa
            ? $this->mosaico->sola($numero($grupo[0]), $this->bytes($grupo[0]), self::REVISAR['remesa'], (int) ($grupo[0]->ia['clasificacion']['girar'] ?? 0))
            : $this->mosaico->armar(collect($grupo)->mapWithKeys(fn (Evidencia $f) => [$numero($f) => $this->bytes($f)])->all(), self::REVISAR['columnas'], self::REVISAR['lado']), $grupos);

        $respuesta = $this->consultar(sprintf(<<<'TXT'
            Eres auditor de entregas a domicilio (muebles y electrodomésticos). Cada foto tiene su número en un recuadro rojo. Fotos del producto: %s. Remesas: %s.
            - Para cada foto del producto: estado "bien" si el producto y su empaque se ven en buen estado, "posible_dano" si se ve un golpe, rotura, abolladura, rayón, humedad o el empaque roto o aplastado, "no_se_ve" si no se alcanza a ver el producto; detalle: qué daño ves, en pocas palabras (vacío si está bien).
            - pantalla (en todas): true si es una foto tomada a la pantalla de otro celular o computador: la foto aparece como un recuadro dentro de una pantalla (casi siempre con fondo blanco alrededor), se ve el borde o el marco del teléfono, dedos sosteniéndolo, la barra de hora y batería, el título de una galería ("Imágenes"), reflejos o rayas de la pantalla.
            - Para cada remesa: estado "bien" si se puede leer o "no_se_ve" si no; firmada: si tiene la firma o el nombre y la cédula de quien recibe; sin_destapar: si dice que recibe sin destapar o sin revisar; novedad: si marcaron o escribieron un problema (abolladuras, rotura, faltantes, devolución); detalle: lo que escribió el cliente sobre la entrega, si se lee (sin números de cédula ni de teléfono).
            En las fotos del producto, firmada, sin_destapar y novedad van en false. Responde solo el JSON.
            TXT, $producto ? implode(', ', $producto) : 'ninguna', $remesas ? implode(', ', $remesas) : 'ninguna'), $imagenes, [
            'n' => ['type' => 'integer'],
            'estado' => ['type' => 'string', 'enum' => self::ESTADOS],
            'detalle' => ['type' => 'string'],
            'firmada' => ['type' => 'boolean'],
            'sin_destapar' => ['type' => 'boolean'],
            'novedad' => ['type' => 'boolean'],
            'pantalla' => ['type' => 'boolean'],
        ]);

        // Más grandes, se ve mejor si una foto es de la pantalla de otro celular: si hay fotos directas de lo mismo, es
        // una copia (la primera mirada, con las fotos pequeñas, a veces no lo nota)
        $pantalla = fn (Evidencia $f) => ($respuesta->get($numero($f))['pantalla'] ?? false) || ($f->ia['clasificacion']['pantalla'] ?? false);
        $directas = $fotos->toBase()->reject(fn (Evidencia $f) => $lote->contains('id', $f->id) ? $pantalla($f) : ($f->ia['clasificacion']['pantalla'] ?? true))
            ->reject(fn (Evidencia $f) => $f->tipo === TipoEvidencia::Repetida)->map(fn (Evidencia $f) => $f->tipo)->unique();

        foreach ($lote as $foto) {
            $x = $respuesta->get($numero($foto));
            if (($x['pantalla'] ?? false) && ! ($foto->ia['clasificacion']['copia'] ?? false) && $directas->contains($foto->tipo)) {
                $foto->ia = [...$foto->ia, 'clasificacion' => [...$foto->ia['clasificacion'], 'pantalla' => true, 'copia' => true]];
                // Solo si el tipo es el que propuso la IA: lo que eligió el auditor no se toca
                if ($foto->tipo->value === ($foto->ia['clasificacion']['tipo'] ?? null)) {
                    $foto->tipo = TipoEvidencia::Repetida;
                }
            }
            $estado = in_array($x['estado'] ?? null, self::ESTADOS, true) ? $x['estado'] : null;
            $foto->ia = [...($foto->ia ?? []), 'revision' => ['estado' => $estado, 'detalle' => Str::limit(trim((string) ($x['detalle'] ?? '')), 200, '…') ?: null]];
            if ($foto->tipo === TipoEvidencia::Remesa) {
                $foto->ia = [...$foto->ia, 'remesa' => ['firmada' => (bool) ($x['firmada'] ?? false), 'sin_destapar' => (bool) ($x['sin_destapar'] ?? false), 'novedad' => (bool) ($x['novedad'] ?? false)]];
            }
            $foto->save();
        }

        return $lote->count();
    }

    /**
     * Una consulta a Groq con las imágenes y la respuesta en JSON (con esquema estricto), por número de foto.
     *
     * @param  list<string>  $imagenes  bytes JPEG
     * @param  array<string, array<string, mixed>>  $campos  los de cada foto en la respuesta
     * @return Collection<int, array<string, mixed>>
     */
    private function consultar(string $instrucciones, array $imagenes, array $campos): Collection
    {
        $contenido = [['type' => 'text', 'text' => $instrucciones]];
        foreach ($imagenes as $jpeg) {
            $contenido[] = ['type' => 'image_url', 'image_url' => ['url' => 'data:image/jpeg;base64,'.base64_encode($jpeg)]];
        }

        $peticion = fn (float $temperatura) => Http::withToken((string) config('services.groq.key'))->acceptJson()->timeout(120)
            ->post(rtrim((string) config('services.groq.url'), '/').'/chat/completions', [
                'model' => config('services.groq.modelo'),
                'messages' => [['role' => 'user', 'content' => $contenido]],
                'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'fotos', 'strict' => true, 'schema' => [
                    'type' => 'object',
                    'properties' => ['fotos' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => $campos, 'required' => array_keys($campos), 'additionalProperties' => false]]],
                    'required' => ['fotos'],
                    'additionalProperties' => false,
                ]]],
                'reasoning_effort' => 'none',
                'temperature' => $temperatura,
                'max_completion_tokens' => 1800,
            ]);

        try {
            $r = $peticion(0.2);
            // A veces el modelo se enreda armando el JSON ("failed_generation"): una segunda vez, un poco más suelto
            if ($r->status() === 400 && (data_get($r->json(), 'error.code') === 'json_validate_failed' || str_contains((string) data_get($r->json(), 'error.message', ''), 'Failed to generate JSON'))) {
                $r = $peticion(0.5);
            }
        } catch (ConnectionException) {
            throw new \RuntimeException('No hubo conexión con la IA. Revisa el internet e inténtalo de nuevo.');
        }

        if ($r->status() === 429) {
            throw new LimiteIa(max(1, (int) ceil((float) ($r->header('retry-after') ?: 30))));
        }
        if ($r->status() === 401) {
            throw new \RuntimeException('Groq no aceptó la clave: revisa GROQ_API_KEY en el .env.');
        }
        if (! $r->successful()) {
            throw new \RuntimeException('La IA respondió con un error ('.$r->status().'). '.Str::limit((string) data_get($r->json(), 'error.message', ''), 200));
        }

        $json = json_decode((string) data_get($r->json(), 'choices.0.message.content'), true);
        if (! is_array($json['fotos'] ?? null)) {
            throw new \RuntimeException('La IA no respondió en el formato esperado. Inténtalo de nuevo.');
        }

        return collect($json['fotos'])->filter(fn ($x) => is_array($x) && isset($x['n']))->keyBy(fn ($x) => (int) $x['n']);
    }

    private function bytes(Evidencia $foto): string
    {
        return (string) Storage::disk('local')->get($foto->path);
    }
}
