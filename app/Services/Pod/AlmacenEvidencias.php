<?php

namespace App\Services\Pod;

use App\Enums\TipoEvidencia;
use App\Models\Evidencia;
use App\Models\Orden;
use App\Services\Drivin\MapeoColumnas;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

/**
 * Guarda las evidencias de una orden: el PDF de prueba de entrega que genera Drivin o fotos sueltas.
 * - El mismo archivo no se guarda dos veces en la misma orden (hash).
 * - En el PDF se cuentan las fotos que trae, como pista para la auditoría.
 * - Una foto se preclasifica por su nombre (fachada, sellado, destapado, remesa, rótulo).
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

    /** @return array{0: Evidencia, 1: bool} la evidencia y si es nueva */
    public function guardar(Orden $orden, UploadedFile $archivo, ?int $usuarioId = null): array
    {
        $hash = hash_file('sha256', $archivo->getRealPath());

        if ($existente = $orden->evidencias()->where('hash', $hash)->first()) {
            return [$existente, false];
        }

        $mime = $archivo->getMimeType();
        $esPdf = $mime === 'application/pdf';
        $extension = $esPdf ? 'pdf' : (strtolower($archivo->guessExtension() ?: $archivo->getClientOriginalExtension()) ?: 'jpg');

        $carpeta = 'evidencias/'.$orden->fecha_operacion->format('Y-m-d').'/'.preg_replace('/[^A-Za-z0-9_-]/', '', $orden->codigo_orden);
        $ruta = $archivo->storeAs($carpeta, $hash.'.'.$extension, 'local');

        $evidencia = $orden->evidencias()->create([
            'tipo' => $esPdf ? TipoEvidencia::PdfPod : $this->tipoPorNombre($archivo->getClientOriginalName()),
            'path' => $ruta,
            'hash' => $hash,
            'nombre_original' => mb_substr($archivo->getClientOriginalName(), 0, 255),
            'mime' => $mime,
            'tamano_bytes' => $archivo->getSize(),
            'imagenes' => $esPdf ? $this->contarImagenes(Storage::disk('local')->path($ruta)) : null,
            'subido_por' => $usuarioId,
        ]);

        return [$evidencia, true];
    }

    public function eliminar(Evidencia $evidencia): void
    {
        Storage::disk('local')->delete($evidencia->path);
        $evidencia->delete();
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

    /** Fotos incrustadas en el PDF. null si el PDF no se pudo analizar (no impide guardarlo). */
    private function contarImagenes(string $ruta): ?int
    {
        try {
            return count((new Parser)->parseFile($ruta)->getObjectsByType('XObject', 'Image'));
        } catch (\Throwable) {
            return null;
        }
    }
}
