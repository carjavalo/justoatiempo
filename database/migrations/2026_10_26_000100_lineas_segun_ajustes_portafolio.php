<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Las líneas de servicio siguen el "Documento definitivo de ajustes para la página web": se renombran dos y el apoyo
 * operativo para plantas y centros logísticos deja de ser una línea aparte (sus actividades quedaron en servicios
 * logísticos y suministro de personal). Solo se cambia lo que sigue como venía de fábrica: un nombre editado se
 * respeta, y la línea retirada solo se desactiva si nadie la usa (se puede reactivar en Líneas de servicio).
 */
return new class extends Migration
{
    private const NOMBRES = [
        'aseo-construccion' => ['Aseo de construcción y postobra', 'Limpieza de obra y posobra'],
        'zonas-verdes' => ['Mantenimiento de zonas verdes', 'Mantenimiento de zonas verdes y jardines'],
    ];

    public function up(): void
    {
        foreach (self::NOMBRES as $slug => [$antes, $ahora]) {
            DB::table('lineas_servicio')->where('slug', $slug)->where('nombre', $antes)->update(['nombre' => $ahora, 'updated_at' => now()]);
        }

        $apoyo = DB::table('lineas_servicio')->where('slug', 'apoyo-plantas')->value('id');
        if ($apoyo && ! $this->enUso($apoyo)) {
            DB::table('lineas_servicio')->where('id', $apoyo)->update(['activa' => false, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        foreach (self::NOMBRES as $slug => [$antes, $ahora]) {
            DB::table('lineas_servicio')->where('slug', $slug)->where('nombre', $ahora)->update(['nombre' => $antes, 'updated_at' => now()]);
        }
        DB::table('lineas_servicio')->where('slug', 'apoyo-plantas')->update(['activa' => true, 'updated_at' => now()]);
    }

    /** Alguna empresa la recibe, alguien trabaja en ella o ya tiene operación registrada. */
    private function enUso(int $linea): bool
    {
        foreach (['empresa_linea_servicio', 'asignacion_linea', 'programaciones', 'novedades_linea', 'acciones_desempeno'] as $tabla) {
            if (DB::table($tabla)->where('linea_servicio_id', $linea)->exists()) {
                return true;
            }
        }

        return false;
    }
};
