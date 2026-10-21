<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La operación diaria de cada línea de servicio (no solo logística): la programación del personal por empresa, sede
 * y sucursal, su asistencia, las novedades con su seguimiento y las acciones de desempeño de cada línea.
 */
return new class extends Migration
{
    /** Lo que recibe el rol base Coordinador (opera la línea): los demás roles, cuando se lo den en Roles. */
    private const COORDINADOR = [
        'programacion.ver', 'programacion.editar', 'programacion.asistencia',
        'novedades.ver', 'novedades.registrar', 'novedades.cerrar',
    ];

    public function up(): void
    {
        $logistica = DB::table('lineas_servicio')->where('modulo', 'logistica')->value('id');

        // Programación: de qué línea y en qué empresa (la sede y la sucursal son opcionales)
        Schema::table('programaciones', function (Blueprint $t) {
            $t->foreignId('linea_servicio_id')->nullable()->after('fecha')->constrained('lineas_servicio')->restrictOnDelete();
            $t->foreignId('empresa_id')->nullable()->after('linea_servicio_id')->constrained('empresas')->restrictOnDelete();
            $t->unsignedSmallInteger('personas_requeridas')->default(0)->after('sucursal_id');
        });
        DB::table('programaciones')->update([
            'linea_servicio_id' => $logistica,
            'personas_requeridas' => DB::raw('auxiliares_requeridos'),
            'empresa_id' => DB::raw('(select sedes.empresa_id from sedes where sedes.id = programaciones.sede_id)'),
        ]);
        // Las que no se pudieron ubicar (sin línea logística o sin sede) no tienen dueño: se descartan
        DB::table('programaciones')->whereNull('linea_servicio_id')->orWhereNull('empresa_id')->delete();

        Schema::table('programaciones', function (Blueprint $t) {
            $t->dropUnique(['fecha', 'sede_id', 'sucursal_id']);
            $t->dropColumn('auxiliares_requeridos');
        });
        Schema::table('programaciones', function (Blueprint $t) {
            $t->foreignId('linea_servicio_id')->nullable(false)->change();
            $t->foreignId('empresa_id')->nullable(false)->change();
            $t->foreignId('sede_id')->nullable()->change();
            $t->index(['linea_servicio_id', 'fecha']);
        });

        // Cada persona programada: su turno y su asistencia
        Schema::table('programacion_asignaciones', function (Blueprint $t) {
            $t->time('hora_entrada')->nullable()->after('user_id');
            $t->time('hora_salida')->nullable()->after('hora_entrada');
            $t->string('asistencia', 20)->nullable()->after('ruta');
            $t->time('hora_llegada')->nullable()->after('asistencia');
            $t->string('observacion', 255)->nullable()->after('hora_llegada');
            $t->foreignId('asistencia_por')->nullable()->after('observacion')->constrained('users')->nullOnDelete();
            $t->timestamp('asistencia_en')->nullable()->after('asistencia_por');
        });

        // Novedades de la operación de una línea, con su seguimiento hasta cerrarlas
        Schema::create('novedades_linea', function (Blueprint $t) {
            $t->id();
            $t->foreignId('linea_servicio_id')->constrained('lineas_servicio')->restrictOnDelete();
            $t->date('fecha');
            $t->foreignId('empresa_id')->constrained('empresas')->restrictOnDelete();
            $t->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $t->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('tipo', 80);
            $t->enum('gravedad', ['ninguna', 'leve', 'grave'])->default('leve');
            $t->text('descripcion');
            $t->enum('estado', ['abierta', 'en_seguimiento', 'cerrada'])->default('abierta');
            $t->text('seguimiento')->nullable();
            $t->foreignId('registrada_por')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('cerrada_por')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('cerrada_en')->nullable();
            $t->timestamps();

            $t->index(['linea_servicio_id', 'fecha']);
            $t->index(['linea_servicio_id', 'estado']);
        });

        // Las acciones de desempeño también son de cada línea (y pueden nacer de una novedad)
        Schema::table('acciones_desempeno', function (Blueprint $t) {
            $t->foreignId('linea_servicio_id')->nullable()->after('user_id')->constrained('lineas_servicio')->nullOnDelete();
            $t->foreignId('novedad_id')->nullable()->after('informe_id')->constrained('novedades_linea')->nullOnDelete();
        });
        DB::table('acciones_desempeno')->update(['linea_servicio_id' => $logistica]);

        $rol = DB::table('roles')->where('clave', 'coordinador')->first(['id', 'permisos']);
        if ($rol) {
            $permisos = json_decode((string) $rol->permisos, true) ?: [];
            DB::table('roles')->where('id', $rol->id)->update(['permisos' => json_encode(array_values(array_unique([...$permisos, ...self::COORDINADOR])))]);
        }
    }

    public function down(): void
    {
        $rol = DB::table('roles')->where('clave', 'coordinador')->first(['id', 'permisos']);
        if ($rol) {
            $permisos = json_decode((string) $rol->permisos, true) ?: [];
            DB::table('roles')->where('id', $rol->id)->update(['permisos' => json_encode(array_values(array_diff($permisos, array_diff(self::COORDINADOR, ['programacion.ver']))))]);
        }
        DB::table('roles')->get(['id', 'permisos'])->each(function ($r) {
            $permisos = json_decode((string) $r->permisos, true) ?: [];
            $sin = array_values(array_filter($permisos, fn ($p) => ! str_starts_with($p, 'novedades.') && ! in_array($p, ['programacion.editar', 'programacion.asistencia'], true)));
            if ($sin !== $permisos) {
                DB::table('roles')->where('id', $r->id)->update(['permisos' => json_encode($sin)]);
            }
        });

        Schema::table('acciones_desempeno', function (Blueprint $t) {
            $t->dropConstrainedForeignId('novedad_id');
            $t->dropConstrainedForeignId('linea_servicio_id');
        });
        Schema::dropIfExists('novedades_linea');

        Schema::table('programacion_asignaciones', function (Blueprint $t) {
            $t->dropConstrainedForeignId('asistencia_por');
            $t->dropColumn(['hora_entrada', 'hora_salida', 'asistencia', 'hora_llegada', 'observacion', 'asistencia_en']);
        });

        // Solo la programación de logística con sede vuelve al esquema anterior (una por fecha, sede y sucursal)
        $logistica = DB::table('lineas_servicio')->where('modulo', 'logistica')->value('id');
        DB::table('programaciones')->where('linea_servicio_id', '!=', $logistica)->orWhereNull('sede_id')->delete();
        Schema::table('programaciones', function (Blueprint $t) {
            $t->unsignedSmallInteger('auxiliares_requeridos')->default(0)->after('sucursal_id');
        });
        DB::table('programaciones')->update(['auxiliares_requeridos' => DB::raw('personas_requeridas')]);
        // Primero las llaves foráneas: el índice (línea, fecha) lo usa la de la línea
        Schema::table('programaciones', function (Blueprint $t) {
            $t->dropForeign(['empresa_id']);
            $t->dropForeign(['linea_servicio_id']);
        });
        Schema::table('programaciones', function (Blueprint $t) {
            $t->dropIndex(['linea_servicio_id', 'fecha']);
            $t->dropColumn(['empresa_id', 'linea_servicio_id', 'personas_requeridas']);
        });
        Schema::table('programaciones', function (Blueprint $t) {
            $t->foreignId('sede_id')->nullable(false)->change();
            $t->unique(['fecha', 'sede_id', 'sucursal_id']);
        });
    }
};
