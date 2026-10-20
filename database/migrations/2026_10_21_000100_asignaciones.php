<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Asignaciones: dónde presta el servicio cada persona y qué hace allí. Una persona puede estar en varias empresas
 * a la vez; cada asignación lleva su empresa (sin empresa: toda la línea), su sede y su sucursal (opcionales),
 * las líneas de servicio que hace en ella y su periodo (indefinida, por días, semanas o meses, o entre dos fechas).
 *
 * Reemplaza a la empresa, sede, sucursal y línea que tenía cada usuario: quien las tenía queda con una asignación
 * indefinida con lo mismo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asignaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('empresa_id')->nullable()->constrained('empresas')->restrictOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->restrictOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->restrictOnDelete();
            $table->date('fecha_inicio');
            // Sin fecha de fin: indefinida
            $table->date('fecha_fin')->nullable();
            // Cómo se eligió el periodo (para mostrarlo igual): indefinida, dias, semanas, meses o fechas
            $table->string('duracion', 12)->default('indefinida');
            $table->unsignedSmallInteger('duracion_cantidad')->nullable();
            $table->foreignId('creada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['fecha_inicio', 'fecha_fin']);
        });

        Schema::create('asignacion_linea', function (Blueprint $table) {
            $table->foreignId('asignacion_id')->constrained('asignaciones')->cascadeOnDelete();
            $table->foreignId('linea_servicio_id')->constrained('lineas_servicio')->cascadeOnDelete();
            $table->primary(['asignacion_id', 'linea_servicio_id']);
        });

        // Lo que tenía cada usuario pasa a una asignación indefinida desde que existe
        $ahora = now();
        foreach (DB::table('users')->where(fn ($q) => $q->whereNotNull('empresa_id')->orWhereNotNull('linea_servicio_id'))->get() as $u) {
            $id = DB::table('asignaciones')->insertGetId([
                'user_id' => $u->id,
                'empresa_id' => $u->empresa_id,
                'sede_id' => $u->empresa_id ? $u->sede_id : null,
                'sucursal_id' => $u->sucursal_id,
                'fecha_inicio' => substr((string) ($u->created_at ?? $ahora), 0, 10),
                'fecha_fin' => null,
                'duracion' => 'indefinida',
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ]);
            // Su línea; sin línea (p. ej. un administrador con empresa), las que recibe su empresa
            $lineas = $u->linea_servicio_id
                ? [$u->linea_servicio_id]
                : DB::table('empresa_linea_servicio')->where('empresa_id', $u->empresa_id)->pluck('linea_servicio_id')->all();
            foreach (array_unique($lineas) as $linea) {
                DB::table('asignacion_linea')->insert(['asignacion_id' => $id, 'linea_servicio_id' => $linea]);
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['empresa_id']);
            $table->dropForeign(['sede_id']);
            $table->dropForeign(['sucursal_id']);
            $table->dropForeign(['linea_servicio_id']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['empresa_id', 'sede_id', 'sucursal_id', 'linea_servicio_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('empresa_id')->nullable()->after('rol_id')->constrained('empresas')->nullOnDelete();
            $table->foreignId('sede_id')->nullable()->after('empresa_id')->constrained('sedes')->nullOnDelete();
            $table->foreignId('sucursal_id')->nullable()->after('sede_id')->constrained('sucursales')->nullOnDelete();
            $table->foreignId('linea_servicio_id')->nullable()->after('sucursal_id')->constrained('lineas_servicio')->nullOnDelete();
        });

        // Cada persona vuelve a su primera asignación
        foreach (DB::table('asignaciones')->orderBy('id')->get()->unique('user_id') as $a) {
            DB::table('users')->where('id', $a->user_id)->update([
                'empresa_id' => $a->empresa_id,
                'sede_id' => $a->sede_id,
                'sucursal_id' => $a->sucursal_id,
                'linea_servicio_id' => DB::table('asignacion_linea')->where('asignacion_id', $a->id)->value('linea_servicio_id'),
            ]);
        }

        Schema::dropIfExists('asignacion_linea');
        Schema::dropIfExists('asignaciones');
    }
};
