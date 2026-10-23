<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jerarquía de tres niveles, como la maneja Justo a Tiempo:
 *   Empresa (p. ej. Ditransa: NIT, contacto, líneas de servicio)
 *   └─ Sede (los clientes de la empresa: TuGo, Sodimac; meta de efectividad y código en Drivin)
 *      └─ Sucursal (Cali Sur, Cañasgordas…; alias en Drivin). Sin sede = sucursal propia de Justo a Tiempo.
 *
 * Antes había dos niveles: "clientes" (TuGo) y "sedes" (Cali Sur). Aquí "clientes" pasa a ser "sedes",
 * "sedes" pasa a ser "sucursales" y se crea "empresas" encima. Cada sede existente recibe una empresa con
 * sus mismos datos (nada se pierde). Para agruparlas bajo la empresa real (p. ej. TuGo y Sodimac bajo
 * Ditransa) se edita cada sede en el panel y se le cambia la empresa: pasa con su operación y su personal.
 *
 * MariaDB 10.4 no renombra índices y los nombres de llaves foráneas son únicos en toda la base: por eso
 * se sueltan y se vuelven a crear con los nombres nuevos.
 */
return new class extends Migration
{
    /** Tablas de la operación con el par (cliente, sede) que pasa a (sede, sucursal). */
    private const OPERACION = ['ordenes', 'informes_diarios', 'programaciones', 'users'];

    public function up(): void
    {
        // 1. Soltar llaves e índices que nombran las columnas viejas
        foreach (self::OPERACION as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->dropForeign(['cliente_id']));
            Schema::table($tabla, fn (Blueprint $t) => $t->dropForeign(['sede_id']));
            Schema::table($tabla, function (Blueprint $t) use ($tabla) {
                $t->dropIndex("{$tabla}_cliente_id_foreign");
                $t->dropIndex("{$tabla}_sede_id_foreign");
            });
        }
        Schema::table('ordenes', fn (Blueprint $t) => $t->dropIndex('ordenes_fecha_operacion_cliente_id_sede_id_index'));
        Schema::table('informes_diarios', fn (Blueprint $t) => $t->dropUnique('informes_diarios_fecha_operacion_cliente_id_sede_id_unique'));
        Schema::table('programaciones', fn (Blueprint $t) => $t->dropUnique('programaciones_fecha_cliente_id_sede_id_unique'));

        Schema::table('sedes', fn (Blueprint $t) => $t->dropForeign(['cliente_id']));
        Schema::table('sedes', fn (Blueprint $t) => $t->dropUnique('sedes_cliente_id_nombre_unique'));
        Schema::table('cliente_linea_servicio', fn (Blueprint $t) => $t->dropForeign(['cliente_id']));
        Schema::table('cliente_linea_servicio', fn (Blueprint $t) => $t->dropForeign(['linea_servicio_id']));
        Schema::table('cliente_linea_servicio', function (Blueprint $t) {
            $t->dropUnique('cliente_linea_servicio_cliente_id_linea_servicio_id_unique');
            $t->dropIndex('cliente_linea_servicio_linea_servicio_id_foreign');
        });
        Schema::table('clientes', function (Blueprint $t) {
            $t->dropUnique('clientes_nombre_unique');
            $t->dropUnique('clientes_codigo_unique');
            $t->dropIndex('clientes_activo_index');
        });

        // 2. Nombres nuevos: sedes → sucursales, clientes → sedes
        Schema::rename('sedes', 'sucursales');
        Schema::table('sucursales', fn (Blueprint $t) => $t->renameColumn('cliente_id', 'sede_id'));
        Schema::rename('clientes', 'sedes');
        Schema::rename('cliente_linea_servicio', 'empresa_linea_servicio');
        Schema::table('empresa_linea_servicio', fn (Blueprint $t) => $t->renameColumn('cliente_id', 'empresa_id'));

        foreach (self::OPERACION as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->renameColumn('sede_id', 'sucursal_id'));
            Schema::table($tabla, fn (Blueprint $t) => $t->renameColumn('cliente_id', 'sede_id'));
        }

        // 3. Empresas: el nivel nuevo, con los datos de contrato que antes tenía cada "cliente"
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->string('nit', 30)->nullable()->unique();
            $table->string('contacto_nombre')->nullable();
            $table->string('contacto_email')->nullable();
            $table->string('contacto_telefono', 30)->nullable();
            $table->boolean('activo')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::table('sedes', fn (Blueprint $t) => $t->unsignedBigInteger('empresa_id')->nullable()->after('id'));
        Schema::table('users', fn (Blueprint $t) => $t->unsignedBigInteger('empresa_id')->nullable()->after('rol'));

        // 4. Datos: cada sede existente recibe su empresa (mismo nombre, NIT, contacto y estado)
        $empresaDe = [];
        foreach (DB::table('sedes')->orderBy('id')->get() as $sede) {
            $empresaDe[$sede->id] = DB::table('empresas')->insertGetId([
                'nombre' => $sede->nombre,
                'nit' => $sede->nit,
                'contacto_nombre' => $sede->contacto_nombre,
                'contacto_email' => $sede->contacto_email,
                'contacto_telefono' => $sede->contacto_telefono,
                'activo' => $sede->activo,
                'created_at' => $sede->created_at,
                'updated_at' => $sede->updated_at,
                'deleted_at' => $sede->deleted_at,
            ]);
            DB::table('sedes')->where('id', $sede->id)->update(['empresa_id' => $empresaDe[$sede->id]]);
        }
        // Las líneas de servicio las recibe la empresa
        foreach (DB::table('empresa_linea_servicio')->get(['id', 'empresa_id']) as $fila) {
            DB::table('empresa_linea_servicio')->where('id', $fila->id)->update(['empresa_id' => $empresaDe[$fila->empresa_id]]);
        }
        foreach ($empresaDe as $sedeId => $empresaId) {
            DB::table('users')->where('sede_id', $sedeId)->update(['empresa_id' => $empresaId]);
        }
        // Cargas en revisión: la sede y la sucursal por defecto elegidas para la preliquidación
        foreach (DB::table('cargas')->whereNotNull('opciones')->get(['id', 'opciones']) as $carga) {
            $opciones = json_decode($carga->opciones, true) ?: [];
            if (array_key_exists('cliente_id', $opciones) || array_key_exists('sede_id', $opciones)) {
                $opciones = ['sede_id' => $opciones['cliente_id'] ?? null, 'sucursal_id' => $opciones['sede_id'] ?? null]
                    + array_diff_key($opciones, ['cliente_id' => 1, 'sede_id' => 1]);
                DB::table('cargas')->where('id', $carga->id)->update(['opciones' => json_encode($opciones)]);
            }
        }

        // 5. Cada sede pertenece a una empresa; NIT y contacto quedan solo en la empresa
        Schema::table('sedes', fn (Blueprint $t) => $t->unsignedBigInteger('empresa_id')->nullable(false)->change());
        Schema::table('sedes', fn (Blueprint $t) => $t->dropColumn(['nit', 'contacto_nombre', 'contacto_email', 'contacto_telefono']));

        // 6. Índices y llaves con los nombres nuevos
        Schema::table('sedes', function (Blueprint $t) {
            $t->unique('nombre');
            $t->unique('codigo');
            $t->index('activo');
            $t->foreign('empresa_id')->references('id')->on('empresas')->restrictOnDelete();
        });
        Schema::table('sucursales', function (Blueprint $t) {
            $t->unique(['sede_id', 'nombre']);
            $t->foreign('sede_id')->references('id')->on('sedes')->cascadeOnDelete();
        });
        Schema::table('empresa_linea_servicio', function (Blueprint $t) {
            $t->unique(['empresa_id', 'linea_servicio_id']);
            $t->foreign('empresa_id')->references('id')->on('empresas')->cascadeOnDelete();
            $t->foreign('linea_servicio_id')->references('id')->on('lineas_servicio')->cascadeOnDelete();
        });
        Schema::table('ordenes', function (Blueprint $t) {
            $t->index(['fecha_operacion', 'sede_id', 'sucursal_id']);
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
            $t->foreign('sucursal_id')->references('id')->on('sucursales')->nullOnDelete();
        });
        Schema::table('informes_diarios', function (Blueprint $t) {
            $t->unique(['fecha_operacion', 'sede_id', 'sucursal_id']);
            $t->foreign('sede_id')->references('id')->on('sedes')->restrictOnDelete();
            $t->foreign('sucursal_id')->references('id')->on('sucursales')->nullOnDelete();
        });
        Schema::table('programaciones', function (Blueprint $t) {
            $t->unique(['fecha', 'sede_id', 'sucursal_id']);
            $t->foreign('sede_id')->references('id')->on('sedes')->restrictOnDelete();
            $t->foreign('sucursal_id')->references('id')->on('sucursales')->nullOnDelete();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->foreign('empresa_id')->references('id')->on('empresas')->nullOnDelete();
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
            $t->foreign('sucursal_id')->references('id')->on('sucursales')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Con dos niveles no hay forma de guardar a alguien asignado solo a la empresa: quedaría como personal
        // propio (con acceso a toda la operación). Se pide resolverlo antes de revertir.
        if (DB::table('users')->whereNotNull('empresa_id')->whereNull('sede_id')->exists()) {
            throw new RuntimeException('Hay usuarios asignados solo a una empresa: asígnales una sede antes de revertir esta migración.');
        }

        // Volver a dos niveles: cada sede recupera NIT y contacto de su empresa
        Schema::table('users', function (Blueprint $t) {
            $t->dropForeign(['empresa_id']);
            $t->dropForeign(['sede_id']);
            $t->dropForeign(['sucursal_id']);
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropIndex('users_empresa_id_foreign');
            $t->dropIndex('users_sede_id_foreign');
            $t->dropIndex('users_sucursal_id_foreign');
            $t->dropColumn('empresa_id');
        });
        foreach (['ordenes', 'informes_diarios', 'programaciones'] as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->dropForeign(['sede_id']));
            Schema::table($tabla, fn (Blueprint $t) => $t->dropForeign(['sucursal_id']));
            Schema::table($tabla, function (Blueprint $t) use ($tabla) {
                $t->dropIndex("{$tabla}_sede_id_foreign");
                $t->dropIndex("{$tabla}_sucursal_id_foreign");
            });
        }
        Schema::table('ordenes', fn (Blueprint $t) => $t->dropIndex(['fecha_operacion', 'sede_id', 'sucursal_id']));
        Schema::table('informes_diarios', fn (Blueprint $t) => $t->dropUnique(['fecha_operacion', 'sede_id', 'sucursal_id']));
        Schema::table('programaciones', fn (Blueprint $t) => $t->dropUnique(['fecha', 'sede_id', 'sucursal_id']));
        Schema::table('empresa_linea_servicio', fn (Blueprint $t) => $t->dropForeign(['empresa_id']));
        Schema::table('empresa_linea_servicio', fn (Blueprint $t) => $t->dropForeign(['linea_servicio_id']));
        Schema::table('empresa_linea_servicio', function (Blueprint $t) {
            $t->dropUnique(['empresa_id', 'linea_servicio_id']);
            $t->dropIndex('empresa_linea_servicio_linea_servicio_id_foreign');
        });
        Schema::table('sucursales', fn (Blueprint $t) => $t->dropForeign(['sede_id']));
        Schema::table('sucursales', fn (Blueprint $t) => $t->dropUnique(['sede_id', 'nombre']));
        Schema::table('sedes', fn (Blueprint $t) => $t->dropForeign(['empresa_id']));
        Schema::table('sedes', function (Blueprint $t) {
            $t->dropIndex('sedes_empresa_id_foreign');
            $t->dropUnique(['nombre']);
            $t->dropUnique(['codigo']);
            $t->dropIndex(['activo']);
            $t->string('nit', 30)->nullable()->after('nombre');
            $t->string('contacto_nombre')->nullable()->after('color');
            $t->string('contacto_email')->nullable()->after('contacto_nombre');
            $t->string('contacto_telefono', 30)->nullable()->after('contacto_email');
        });

        // Datos de vuelta: contrato a cada sede (el NIT, que no se repetía, solo a la primera) y las líneas
        // de la empresa a todas sus sedes
        $sedesDe = [];
        foreach (DB::table('sedes')->orderBy('id')->get(['id', 'empresa_id']) as $sede) {
            $empresa = DB::table('empresas')->find($sede->empresa_id);
            DB::table('sedes')->where('id', $sede->id)->update([
                'nit' => isset($sedesDe[$sede->empresa_id]) ? null : $empresa?->nit,
                'contacto_nombre' => $empresa?->contacto_nombre,
                'contacto_email' => $empresa?->contacto_email,
                'contacto_telefono' => $empresa?->contacto_telefono,
            ]);
            $sedesDe[$sede->empresa_id][] = $sede->id;
        }
        $filas = DB::table('empresa_linea_servicio')->get(['empresa_id', 'linea_servicio_id', 'created_at', 'updated_at']);
        DB::table('empresa_linea_servicio')->delete();
        foreach ($filas as $fila) {
            foreach ($sedesDe[$fila->empresa_id] ?? [] as $sedeId) {
                DB::table('empresa_linea_servicio')->insert([
                    'empresa_id' => $sedeId,
                    'linea_servicio_id' => $fila->linea_servicio_id,
                    'created_at' => $fila->created_at,
                    'updated_at' => $fila->updated_at,
                ]);
            }
        }
        foreach (DB::table('cargas')->whereNotNull('opciones')->get(['id', 'opciones']) as $carga) {
            $opciones = json_decode($carga->opciones, true) ?: [];
            if (array_key_exists('sucursal_id', $opciones) || array_key_exists('sede_id', $opciones)) {
                $opciones = ['cliente_id' => $opciones['sede_id'] ?? null, 'sede_id' => $opciones['sucursal_id'] ?? null]
                    + array_diff_key($opciones, ['sucursal_id' => 1, 'sede_id' => 1]);
                DB::table('cargas')->where('id', $carga->id)->update(['opciones' => json_encode($opciones)]);
            }
        }
        Schema::table('sedes', fn (Blueprint $t) => $t->dropColumn('empresa_id'));
        Schema::drop('empresas');

        foreach (self::OPERACION as $tabla) {
            Schema::table($tabla, fn (Blueprint $t) => $t->renameColumn('sede_id', 'cliente_id'));
            Schema::table($tabla, fn (Blueprint $t) => $t->renameColumn('sucursal_id', 'sede_id'));
        }
        Schema::table('empresa_linea_servicio', fn (Blueprint $t) => $t->renameColumn('empresa_id', 'cliente_id'));
        Schema::rename('empresa_linea_servicio', 'cliente_linea_servicio');
        Schema::rename('sedes', 'clientes');
        Schema::table('sucursales', fn (Blueprint $t) => $t->renameColumn('sede_id', 'cliente_id'));
        Schema::rename('sucursales', 'sedes');

        Schema::table('clientes', function (Blueprint $t) {
            $t->unique('nombre');
            $t->unique('codigo');
            $t->index('activo');
        });
        Schema::table('sedes', function (Blueprint $t) {
            $t->unique(['cliente_id', 'nombre']);
            $t->foreign('cliente_id')->references('id')->on('clientes')->cascadeOnDelete();
        });
        Schema::table('cliente_linea_servicio', function (Blueprint $t) {
            $t->unique(['cliente_id', 'linea_servicio_id']);
            $t->foreign('cliente_id')->references('id')->on('clientes')->cascadeOnDelete();
            $t->foreign('linea_servicio_id')->references('id')->on('lineas_servicio')->cascadeOnDelete();
        });
        Schema::table('ordenes', function (Blueprint $t) {
            $t->index(['fecha_operacion', 'cliente_id', 'sede_id']);
            $t->foreign('cliente_id')->references('id')->on('clientes')->nullOnDelete();
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
        });
        Schema::table('informes_diarios', function (Blueprint $t) {
            $t->unique(['fecha_operacion', 'cliente_id', 'sede_id']);
            $t->foreign('cliente_id')->references('id')->on('clientes')->restrictOnDelete();
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
        });
        Schema::table('programaciones', function (Blueprint $t) {
            $t->unique(['fecha', 'cliente_id', 'sede_id']);
            $t->foreign('cliente_id')->references('id')->on('clientes')->restrictOnDelete();
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->foreign('cliente_id')->references('id')->on('clientes')->nullOnDelete();
            $t->foreign('sede_id')->references('id')->on('sedes')->nullOnDelete();
        });
    }
};
