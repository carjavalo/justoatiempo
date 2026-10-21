<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los catálogos con los que trabaja la operación logística, ahora editables en Parámetros: motivos de rechazo de
 * Drivin, tipos de novedad de la auditoría y los parámetros del informe. Solo se agrega lo que falte (en producción
 * pudieron no cargarse nunca); lo que ya existe no se toca.
 */
return new class extends Migration
{
    private const MOTIVOS = [
        ['Cliente reprograma fecha de entrega', false],
        ['Cliente reprograma fecha de recibo', false],
        ['Cliente ausente en domicilio', false],
        ['Cliente no contesta llamadas', false],
        ['Dirección errada o incompleta', false],
        ['Cliente rechaza el producto', false],
        ['Producto averiado', true],
        ['Producto incompleto / faltante', false],
        ['No alcanzó tiempo en ruta', true],
        ['Otro', false],
    ];

    private const NOVEDADES = [
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

    private const PARAMETROS = [
        ['meta_efectividad_global', '95', 'Meta de efectividad por defecto para las sedes nuevas'],
        ['umbral_felicitacion', '100', 'Cumplimiento desde el que se sugiere una felicitación'],
        ['umbral_llamado_atencion', '70', 'Cumplimiento por debajo del cual se sugiere un llamado de atención'],
        ['hora_corte_informe', '10:00', 'Hora en que se entrega el informe diario'],
    ];

    public function up(): void
    {
        $ahora = now();
        foreach (self::MOTIVOS as [$nombre, $imputable]) {
            DB::table('motivos_rechazo')->insertOrIgnore(['nombre' => $nombre, 'imputable_operacion' => $imputable, 'activo' => true, 'created_at' => $ahora, 'updated_at' => $ahora]);
        }
        foreach (self::NOVEDADES as [$nombre, $severidad]) {
            DB::table('tipos_novedad')->insertOrIgnore(['nombre' => $nombre, 'severidad' => $severidad, 'activo' => true, 'created_at' => $ahora, 'updated_at' => $ahora]);
        }
        foreach (self::PARAMETROS as [$clave, $valor, $descripcion]) {
            DB::table('parametros')->insertOrIgnore(['clave' => $clave, 'valor' => $valor, 'descripcion' => $descripcion, 'created_at' => $ahora, 'updated_at' => $ahora]);
        }
    }

    public function down(): void
    {
        // Los catálogos se conservan: pueden tener historial asociado
    }
};
