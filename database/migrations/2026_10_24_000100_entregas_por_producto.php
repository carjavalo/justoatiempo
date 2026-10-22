<?php

use App\Services\ConsolidadorInforme;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Las entregas se cuentan por producto, como en el "INFORME DIARIO DE OPERACIONES" que se llenaba a mano: una orden
 * con 3 productos son 3 entregas asignadas y, si se rechaza, 3 devoluciones. Cada fila del informe guarda además en
 * cuántas órdenes iban (sus productos ya son las asignadas y las realizadas). Los informes ya armados se recalculan;
 * su estado y lo escrito a mano no cambian.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Toda orden lleva al menos un producto (las importadas antes de guardarlos quedaron en 0)
        DB::table('ordenes')->where('productos', '<', 1)->update([
            'productos' => 1,
            'productos_entregados' => DB::raw("CASE WHEN estado = 'aprobada' THEN 1 ELSE 0 END"),
        ]);

        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->unsignedInteger('ordenes')->default(0)->after('auxiliar_nombre');
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->dropColumn(['productos', 'productos_entregados']);
        });

        app(ConsolidadorInforme::class)->recalcularTodos();
    }

    public function down(): void
    {
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->unsignedInteger('productos')->default(0)->after('rechazadas');
            $table->unsignedInteger('productos_entregados')->default(0)->after('productos');
        });
        // Sus valores son las asignadas y las realizadas por producto
        DB::table('informe_lineas')->update(['productos' => DB::raw('asignadas'), 'productos_entregados' => DB::raw('aprobadas')]);
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->dropColumn('ordenes');
        });
    }
};
