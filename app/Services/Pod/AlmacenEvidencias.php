<?php

namespace App\Services\Pod;

use App\Enums\TipoEvidencia;
use App\Models\Evidencia;
use App\Models\Orden;
use App\Services\Drivin\MapeoColumnas;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Guarda las evidencias de una orden: el PDF de prueba de entrega que genera Drivin o fotos sueltas.
 * - El mismo archivo no se guarda dos veces en la misma orden (hash).
 * - El PDF se lee (LectorPod): lo que dice queda en la evidencia y sus fotos se separan, cada una como evidencia
 *   propia sin clasificar, para revisarlas una por una. La firma del cliente también se separa.
 * - Una foto suelta se preclasifica por su nombre (fachada, sellado, destapado, remesa, rótulo).
 */
class AlmacenEvidencias
{
    public const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    private const PALABRAS = [
        'fachada' => TipoEvidencia::Fachada,
        'sellad' => TipoEvidencia::Sellado,
        'destap' => TipoEvidencia::Destapado,
        'remesa' => TipoEvidencia::Remesa,
        'factura' => TipoEvidencia::Remesa,
        'rotulo' => TipoEvidencia::Rotulo,
    ];

    public function __construct(private LectorPod $lector) {}

    /**
     * @param  array<string, mixed>|null  $lectura  la del PDF, si ya se leyó (para no leerlo dos veces)
     * @return array{0: Evidencia, 1: bool} la evidencia y si es nueva
     */
    public function guardar(Orden $orden, UploadedFile $archivo, ?int $usuarioId = null, ?array $lectura = null): array
    {
        $hash = hash_file('sha256', $archivo->getRealPath());

        if ($existente = $orden->evidencias()->where('hash', $hash)->first()) {
            return [$existente, false];
        }

        $mime = $archivo->getMimeType();
        $esPdf = $mime === 'application/pdf';
        $extension = $esPdf ? 'pdf' : (strtolower($archivo->guessExtension() ?: $archivo->getClientOriginalExtension()) ?: 'jpg');
        $lectura = $esPdf ? ($lectura ?? $this->lector->leer($archivo->getRealPath())) : null;

        $carpeta = $this->carpeta($orden);
        $ruta = $archivo->storeAs($carpeta, $hash.'.'.$extension, 'local');

        $evidencia = DB::transaction(function () use ($orden, $archivo, $usuarioId, $lectura, $esPdf, $mime, $ruta, $hash, $carpeta) {
            $evidencia = $orden->evidencias()->create([
                'tipo' => $esPdf ? TipoEvidencia::PdfPod : $this->tipoPorNombre($archivo->getClientOriginalName()),
                'path' => $ruta,
                'hash' => $hash,
                'nombre_original' => mb_substr($archivo->getClientOriginalName(), 0, 255),
                'mime' => $mime,
                'tamano_bytes' => $archivo->getSize(),
                // Las fotos de la entrega (sin el logo, el sello ni la firma). null si el PDF no se pudo leer: igual se guarda
                'imagenes' => $lectura['datos']['fotos'] ?? null,
                'datos' => $lectura['datos'] ?? null,
                'subido_por' => $usuarioId,
            ]);

            if ($lectura) {
                foreach ($lectura['fotos'] as $i => $foto) {
                    $this->separar($orden, $evidencia, $foto, TipoEvidencia::Otro, $evidencia->nombre_original.' · foto '.($i + 1), $carpeta);
                }
                if ($lectura['firma']) {
                    $this->separar($orden, $evidencia, $lectura['firma'], TipoEvidencia::Firma, $evidencia->nombre_original.' · firma', $carpeta);
                }
            }

            return $evidencia;
        });

        return [$evidencia, true];
    }

    /** No se borra nada: la evidencia (y lo que se separó de ella, si es un PDF) queda marcada y su archivo se conserva. */
    public function eliminar(Evidencia $evidencia): void
    {
        DB::transaction(function () use ($evidencia) {
            $evidencia->separadas()->get()->each->delete();
            $evidencia->delete();
        });
    }

    public function tipoPorNombre(string $nombre): TipoEvidencia
    {
        $n = MapeoColumnas::normalizar($nombre);
        foreach (self::PALABRAS as $palabra => $tipo) {
            if (str_contains($n, $palabra)) {
                return $tipo;
            }
        }

        return TipoEvidencia::Otro;
    }

    private function carpeta(Orden $orden): string
    {
        return 'evidencias/'.$orden->fecha_operacion->format('Y-m-d').'/'.preg_replace('/[^A-Za-z0-9_-]/', '', $orden->codigo_orden);
    }

    /**
     * Una imagen separada del PDF, como evidencia propia ligada a él. Si la orden ya la tiene (p. ej. la misma foto
     * subida suelta), no se repite.
     *
     * @param  array{bytes: string, pagina: int}  $imagen
     */
    private function separar(Orden $orden, Evidencia $pdf, array $imagen, TipoEvidencia $tipo, string $nombre, string $carpeta): void
    {
        $hash = hash('sha256', $imagen['bytes']);
        if ($orden->evidencias()->where('hash', $hash)->exists()) {
            return;
        }

        $ruta = "{$carpeta}/{$hash}.jpg";
        Storage::disk('local')->put($ruta, $imagen['bytes']);

        $orden->evidencias()->create([
            'tipo' => $tipo,
            'path' => $ruta,
            'hash' => $hash,
            'nombre_original' => mb_substr($nombre, 0, 255),
            'mime' => 'image/jpeg',
            'tamano_bytes' => strlen($imagen['bytes']),
            'pagina_pdf' => $imagen['pagina'],
            'origen_id' => $pdf->id,
            'subido_por' => $pdf->subido_por,
        ]);
    }
}
