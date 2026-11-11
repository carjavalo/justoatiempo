<?php

use App\Services\ConsolidadorInforme;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Los informes ya armados toman las reglas nuevas: novedades como las escribe la operación ("Sin evidencias en 2
 * órdenes · 1 devolución (…)"), evidencias según Drivin y la auditoría, y los productos de cada fila. Su estado
 * (borrador, seguimiento o cerrado) y lo escrito a mano no cambian.
 */
return new class extends Migration
{
    public function up(): void
    {
        // El consolidador de hoy ya escribe informe_lineas.ordenes, que crea 2026_10_24_000100_entregas_por_producto.
        // Una base que llega aquí todavía no la tiene: esa migración recalcula todos los informes después.
        if (! Schema::hasColumn('informe_lineas', 'ordenes')) {
            return;
        }

        // Solo si ya hay informes: en una base nueva no hay nada que recalcular, y el consolidador usa los modelos de
        // hoy (con columnas, como deleted_at, que esta migración todavía no conoce)
        if (DB::table('informes_diarios')->exists()) {
            app(ConsolidadorInforme::class)->recalcularTodos();
        }
    }

    public function down(): void
    {
        // Nada que deshacer: lo recalculado se vuelve a calcular al consolidar
    }
};
