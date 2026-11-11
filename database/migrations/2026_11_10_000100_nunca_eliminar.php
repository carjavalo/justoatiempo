<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nada se borra de la base: lo que se elimina queda marcado (deleted_at) con su rastro en la bitácora.
 *
 * Los datos que no se repiten (cédula, correo, placa, nombre…) solo se exigen únicos entre los registros vigentes:
 * cada tabla con índices únicos gana la columna calculada `vigente` (1 si no está eliminado, NULL si lo está) y el
 * índice pasa a ser (dato, vigente). Como NULL no choca con nada, lo eliminado no impide volver a crear el mismo dato.
 * En las cargas, una anulada tampoco cuenta: el mismo archivo se puede importar de nuevo como una carga nueva.
 */
return new class extends Migration
{
    /** Tablas que aún no tenían borrado suave. */
    private const SIN_BORRADO = [
        'users', 'roles', 'lineas_servicio', 'asignaciones', 'motivos_rechazo', 'tipos_novedad', 'solicitudes_contacto',
        'novedades_linea', 'acciones_desempeno', 'programaciones', 'programacion_asignaciones', 'evidencias', 'ordenes',
        'informes_diarios', 'informe_lineas', 'cargas',
    ];

    /** tabla => [nombre del índice => columnas] de los índices únicos que pasan a contar solo lo vigente. */
    private const UNICOS = [
        'users' => ['users_email_unique' => ['email'], 'users_cedula_unique' => ['cedula'], 'users_carnet_codigo_unique' => ['carnet_codigo']],
        'roles' => ['roles_nombre_unique' => ['nombre'], 'roles_clave_unique' => ['clave']],
        'lineas_servicio' => ['lineas_servicio_slug_unique' => ['slug']],
        'motivos_rechazo' => ['motivos_rechazo_nombre_unique' => ['nombre']],
        'tipos_novedad' => ['tipos_novedad_nombre_unique' => ['nombre']],
        'ordenes' => ['ordenes_fecha_operacion_codigo_orden_unique' => ['fecha_operacion', 'codigo_orden']],
        'informes_diarios' => ['informes_diarios_fecha_operacion_sede_id_sucursal_id_unique' => ['fecha_operacion', 'sede_id', 'sucursal_id']],
        'programacion_asignaciones' => ['programacion_asignaciones_programacion_id_user_id_unique' => ['programacion_id', 'user_id']],
        'evidencias' => ['evidencias_orden_id_hash_unique' => ['orden_id', 'hash']],
        'cargas' => ['cargas_archivo_hash_unique' => ['archivo_hash']],
        'empresas' => ['empresas_nombre_unique' => ['nombre'], 'empresas_nit_unique' => ['nit']],
        'sedes' => ['sedes_nombre_unique' => ['nombre'], 'sedes_codigo_unique' => ['codigo']],
        'sucursales' => ['sucursales_sede_id_nombre_unique' => ['sede_id', 'nombre']],
        'vehiculos' => ['vehiculos_placa_unique' => ['placa'], 'vehiculos_codigo_interno_unique' => ['codigo_interno']],
    ];

    public function up(): void
    {
        foreach (self::SIN_BORRADO as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->softDeletes());
        }

        foreach (self::UNICOS as $tabla => $indices) {
            Schema::table($tabla, function (Blueprint $t) use ($tabla) {
                // Una carga anulada tampoco ocupa su archivo: se puede importar de nuevo
                $t->tinyInteger('vigente')->nullable()->storedAs($tabla === 'cargas'
                    ? "if(`deleted_at` is null and `estado` <> 'anulada', 1, null)"
                    : 'if(`deleted_at` is null, 1, null)');
            });
            // Primero el índice nuevo y después el viejo: algunos sostienen una llave foránea y no pueden faltar
            $n = 0;
            foreach ($indices as $nombre => $columnas) {
                $n++;
                Schema::table($tabla, fn (Blueprint $t) => $t->unique([...$columnas, 'vigente'], "{$tabla}_vigente_{$n}"));
                Schema::table($tabla, fn (Blueprint $t) => $t->dropUnique($nombre));
            }
        }
    }

    public function down(): void
    {
        foreach (self::UNICOS as $tabla => $indices) {
            $n = 0;
            foreach ($indices as $nombre => $columnas) {
                $n++;
                Schema::table($tabla, fn (Blueprint $t) => $t->unique($columnas, $nombre));
                Schema::table($tabla, fn (Blueprint $t) => $t->dropUnique("{$tabla}_vigente_{$n}"));
            }
            Schema::table($tabla, fn (Blueprint $t) => $t->dropColumn('vigente'));
        }

        foreach (self::SIN_BORRADO as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->dropSoftDeletes());
        }
    }
};
