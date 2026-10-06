<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo 2: la carga pasa por una revisión antes de importarse
 * (hoja y columnas detectadas, cliente/sede por defecto, validación previa).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cargas', function (Blueprint $table) {
            $table->enum('estado', ['en_revision', 'procesada', 'con_errores', 'anulada'])->default('en_revision')->change();
            $table->string('hoja', 120)->nullable()->after('archivo_hash');
            $table->unsignedSmallInteger('fila_encabezados')->nullable()->after('hoja');
            $table->json('opciones')->nullable()->after('mapeo_columnas'); // cliente/sede por defecto
            $table->json('resumen')->nullable()->after('opciones');       // resultado de la importación
            $table->unsignedInteger('ordenes_importadas')->default(0)->after('filas_error');
            $table->unsignedInteger('advertencias')->default(0)->after('ordenes_importadas');
            $table->foreignId('anulada_por')->nullable()->after('procesado_en')->constrained('users')->nullOnDelete();
            $table->timestamp('anulada_en')->nullable()->after('anulada_por');
        });
    }

    public function down(): void
    {
        Schema::table('cargas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('anulada_por');
            $table->dropColumn(['hoja', 'fila_encabezados', 'opciones', 'resumen', 'ordenes_importadas', 'advertencias', 'anulada_en']);
            $table->enum('estado', ['procesando', 'procesada', 'con_errores', 'anulada'])->default('procesando')->change();
        });
    }
};
