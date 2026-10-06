<?php

namespace Database\Seeders;

use App\Models\MotivoRechazo;
use App\Models\Parametro;
use App\Models\TipoNovedad;
use Illuminate\Database\Seeder;

/** Catálogos base tomados de la operación actual (preliquidación Drivin e informe diario). */
class CatalogosSeeder extends Seeder
{
    public function run(): void
    {
        $motivos = [
            ['Cliente reprograma fecha de entrega', false],
            ['Cliente ausente en domicilio', false],
            ['Cliente no contesta llamadas', false],
            ['Dirección errada o incompleta', false],
            ['Cliente rechaza el producto', false],
            ['Producto averiado', true],
            ['Producto incompleto / faltante', false],
            ['No alcanzó tiempo en ruta', true],
            ['Otro', false],
        ];

        foreach ($motivos as [$nombre, $imputable]) {
            MotivoRechazo::updateOrCreate(['nombre' => $nombre], ['imputable_operacion' => $imputable]);
        }

        $novedades = [
            ['Sin novedad', 'ninguna'],
            ['Sin revisar', 'ninguna'],
            ['Buen protocolo de entrega', 'ninguna'],
            ['Buen protocolo de entrega pero puede mejorar', 'leve'],
            ['Entregado sin destapar con nota en remesa', 'ninguna'],
            ['Falta foto de fachada', 'leve'],
            ['Faltan fotos de producto sellado', 'leve'],
            ['Faltan fotos de producto destapado', 'leve'],
            ['Falta remesa firmada', 'grave'],
            ['Falta foto de fachada y remesa firmada', 'grave'],
            ['Sin evidencia', 'grave'],
        ];

        foreach ($novedades as [$nombre, $severidad]) {
            TipoNovedad::updateOrCreate(['nombre' => $nombre], ['severidad' => $severidad]);
        }

        $parametros = [
            ['meta_efectividad_global', '95', 'Porcentaje de efectividad objetivo por defecto'],
            ['umbral_felicitacion', '100', 'Efectividad mínima para sugerir felicitación'],
            ['umbral_llamado_atencion', '70', 'Efectividad por debajo de la cual se sugiere llamado de atención'],
            ['hora_corte_informe', '10:00', 'Hora de entrega del informe diario'],
            ['max_filas_carga', '1000', 'Máximo de filas por archivo de preliquidación'],
        ];

        foreach ($parametros as [$clave, $valor, $descripcion]) {
            Parametro::updateOrCreate(['clave' => $clave], ['valor' => $valor, 'descripcion' => $descripcion]);
        }
    }
}
