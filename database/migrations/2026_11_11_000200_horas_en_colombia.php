<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * La plataforma pasa de UTC a la hora de Colombia (config/app.php): con UTC, desde las 7 p. m. ya era "mañana" para la
 * programación, la asistencia y los informes. Las horas que ya guardó (creada, editada, eliminada, auditada, cerrada,
 * último acceso…) están en UTC: se pasan a la hora de Colombia para que sigan diciendo lo mismo.
 *
 * No se tocan las que no escribe la plataforma: la hora de entrega de Drivin (ordenes.hora_entrega, datetime) ya llega
 * en hora de Colombia, y failed_jobs.failed_at la pone la base, que ya corre en su hora local. Si la aplicación sigue
 * en UTC (su .env lo dice) o la base no tiene usuarios (instalación nueva: lo que hay lo acaban de escribir las
 * migraciones, ya en la hora nueva), no hay nada que convertir.
 */
return new class extends Migration
{
    /** Columnas `timestamp` que la plataforma no escribe en la hora de la aplicación. */
    private const SIN_CONVERTIR = ['failed_jobs.failed_at'];

    public function up(): void
    {
        $this->correr(1);
    }

    public function down(): void
    {
        $this->correr(-1);
    }

    /** Corre todas las horas guardadas la diferencia con UTC (-300 minutos en Colombia, sin horario de verano). */
    private function correr(int $sentido): void
    {
        $minutos = now()->utcOffset() * $sentido;
        if ($minutos === 0 || ! DB::table('users')->exists()) {
            return;
        }

        $columnas = collect(DB::select(
            "select TABLE_NAME as tabla, COLUMN_NAME as columna from information_schema.columns
             where TABLE_SCHEMA = ? and DATA_TYPE = 'timestamp' order by TABLE_NAME, ORDINAL_POSITION",
            [DB::getDatabaseName()],
        ))->reject(fn ($c) => in_array("{$c->tabla}.{$c->columna}", self::SIN_CONVERTIR, true));

        DB::transaction(function () use ($columnas, $minutos) {
            foreach ($columnas->groupBy('tabla') as $tabla => $deLaTabla) {
                // Todas las de la tabla en una sola pasada (null + intervalo sigue siendo null)
                $sets = $deLaTabla->map(fn ($c) => "`{$c->columna}` = `{$c->columna}` + interval {$minutos} minute")->implode(', ');
                DB::statement("update `{$tabla}` set {$sets}");
            }
        });
    }
};
