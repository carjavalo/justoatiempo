<?php

namespace App\Console\Commands;

use App\Enums\EstadoOrden;
use App\Models\Orden;
use App\Services\Pod\GeneradorPodEjemplo;
use Illuminate\Console\Command;

/**
 * Genera pruebas de entrega de ejemplo (como las descarga Drivin) para las entregas aprobadas
 * de una jornada, con casos variados que la auditoría debe detectar.
 */
class GenerarPodEjemplo extends Command
{
    protected $signature = 'drivin:pod-ejemplo {fecha? : Jornada (AAAA-MM-DD); por defecto, la última importada}';

    protected $description = 'Genera PDF de prueba de entrega y fotos de ejemplo para auditar una jornada';

    public function handle(GeneradorPodEjemplo $generador): int
    {
        $fecha = $this->argument('fecha') ?? Orden::max('fecha_operacion');
        if (! $fecha) {
            $this->components->error('No hay órdenes importadas.');

            return self::FAILURE;
        }
        $fecha = substr((string) $fecha, 0, 10);

        $ordenes = Orden::query()
            ->whereDate('fecha_operacion', $fecha)
            ->where('estado', EstadoOrden::Aprobada)
            ->orderBy('codigo_orden')
            ->get();

        $carpeta = storage_path('app/ejemplos/pod_'.$fecha);
        if (! is_dir($carpeta)) {
            mkdir($carpeta, 0775, true);
        }
        array_map('unlink', glob($carpeta.'/*') ?: []);

        mt_srand((int) str_replace('-', '', $fecha));
        $conteo = ['completas' => 0, 'sin_destapar' => 0, 'incompletas' => 0, 'fotos_sueltas' => 0, 'sin_evidencia' => 0];

        foreach ($ordenes as $o) {
            $tiro = mt_rand(1, 100);
            $sufijo = str_replace('-', '', $fecha);

            if ($tiro <= 6) {
                $conteo['sin_evidencia']++; // el auxiliar no subió nada

                continue;
            }

            if ($tiro <= 14) {
                // Fotos sueltas con el tipo en el nombre: se preclasifican solas
                $fotos = ['fachada' => 1, 'sellado' => 4, 'destapado' => 4, 'remesa' => 1];
                foreach ($fotos as $tipo => $n) {
                    for ($i = 1; $i <= $n; $i++) {
                        $rotulo = ['fachada' => 'FACHADA', 'sellado' => 'PRODUCTO SELLADO', 'destapado' => 'PRODUCTO DESTAPADO', 'remesa' => 'REMESA FIRMADA'][$tipo];
                        file_put_contents("{$carpeta}/{$o->codigo_orden}_{$tipo}_{$i}.jpg", $generador->foto($rotulo, $i));
                    }
                }
                $conteo['fotos_sueltas']++;

                continue;
            }

            [$fachada, $sellado, $destapado, $remesa, $caso] = match (true) {
                $tiro <= 26 => [true, 4, 0, true, 'sin_destapar'],
                $tiro <= 34 => [false, 4, 4, true, 'incompletas'],
                $tiro <= 40 => [true, 2, 4, true, 'incompletas'],
                $tiro <= 45 => [true, 4, 4, false, 'incompletas'],
                default => [true, mt_rand(4, 5), 4, true, 'completas'],
            };

            $pdf = $generador->pdf("POD {$o->codigo_orden}", $generador->fotosEntrega($fachada, $sellado, $destapado, $remesa));
            file_put_contents("{$carpeta}/POD_{$o->codigo_orden}_{$sufijo}.pdf", $pdf);
            $conteo[$caso]++;
        }

        $this->components->info("Evidencias de ejemplo para {$ordenes->count()} entregas aprobadas del {$fecha}.");
        $this->components->bulletList([
            "{$conteo['completas']} PDF con el protocolo completo",
            "{$conteo['sin_destapar']} PDF sin fotos del producto destapado (para probar la nota «Recibe sin destapar»)",
            "{$conteo['incompletas']} PDF con fotos faltantes",
            "{$conteo['fotos_sueltas']} entregas con fotos sueltas (se clasifican por el nombre)",
            "{$conteo['sin_evidencia']} entregas sin ninguna evidencia",
        ]);
        $this->line('  '.$carpeta);

        return self::SUCCESS;
    }
}
