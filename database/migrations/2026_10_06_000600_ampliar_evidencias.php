<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Módulo 4: evidencias subidas por lote o por orden (PDF de Drivin o fotos). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('evidencias', function (Blueprint $table) {
            $table->char('hash', 64)->nullable()->after('path');            // evita subir dos veces el mismo archivo a una orden
            $table->unsignedSmallInteger('imagenes')->nullable()->after('pagina_pdf'); // fotos encontradas dentro del PDF
            $table->unique(['orden_id', 'hash']);
        });
    }

    public function down(): void
    {
        Schema::table('evidencias', function (Blueprint $table) {
            $table->dropUnique(['orden_id', 'hash']);
            $table->dropColumn(['hash', 'imagenes']);
        });
    }
};
