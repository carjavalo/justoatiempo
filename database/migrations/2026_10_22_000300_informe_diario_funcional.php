<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El informe diario como el Excel de Melanie ("INFORME DIARIO DE OPERACIONES"):
 * - cada fila (auxiliar, ruta y placa) muestra también los productos y guarda una observación escrita a mano, que se
 *   conserva cuando el informe se recalcula (al auditar o al cargar otra preliquidación);
 * - el seguimiento admite el llamado de atención escrito, además del verbal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->unsignedInteger('productos')->default(0)->after('rechazadas');
            $table->unsignedInteger('productos_entregados')->default(0)->after('productos');
            $table->text('observacion')->nullable()->after('novedades');
        });

        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->enum('tipo', ['felicitacion', 'retroalimentacion', 'llamado_atencion', 'llamado_escrito'])->change();
        });

        // Las filas ya consolidadas toman sus productos de sus órdenes
        foreach (DB::table('informe_lineas')->get(['id', 'informe_id', 'auxiliar_id', 'auxiliar_nombre', 'placa', 'ruta']) as $l) {
            $totales = DB::table('ordenes')
                ->where('informe_id', $l->informe_id)
                ->where(fn ($q) => $l->auxiliar_id ? $q->where('auxiliar_id', $l->auxiliar_id) : $q->whereNull('auxiliar_id')->where('auxiliar_nombre', $l->auxiliar_nombre))
                ->where(fn ($q) => $l->placa ? $q->where('placa', $l->placa) : $q->whereNull('placa'))
                ->selectRaw('coalesce(sum(productos), 0) as productos, coalesce(sum(productos_entregados), 0) as entregados')
                ->first();
            DB::table('informe_lineas')->where('id', $l->id)->update(['productos' => $totales->productos, 'productos_entregados' => $totales->entregados]);
        }
    }

    public function down(): void
    {
        DB::table('acciones_desempeno')->where('tipo', 'llamado_escrito')->update(['tipo' => 'llamado_atencion']);
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->enum('tipo', ['felicitacion', 'retroalimentacion', 'llamado_atencion'])->change();
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->dropColumn(['productos', 'productos_entregados', 'observacion']);
        });
    }
};
