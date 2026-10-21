<?php

use App\Services\ConsolidadorInforme;
use Illuminate\Database\Migrations\Migration;

/**
 * Los informes ya armados toman las reglas nuevas: novedades como las escribe la operación ("Sin evidencias en 2
 * órdenes · 1 devolución (…)"), evidencias según Drivin y la auditoría, y los productos de cada fila. Su estado
 * (borrador, seguimiento o cerrado) y lo escrito a mano no cambian.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(ConsolidadorInforme::class)->recalcularTodos();
    }

    public function down(): void
    {
        // Nada que deshacer: lo recalculado se vuelve a calcular al consolidar
    }
};
