<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Panel de administración: las sedes pueden ser de una empresa cliente o propias de
 * Justo a Tiempo (sin empresa), y cada usuario puede quedar asignado a una empresa y una sede.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Se suelta la llave foránea para cambiar la columna: MariaDB no deja modificar una columna con FK
        Schema::table('sedes', function (Blueprint $table) {
            $table->dropForeign(['cliente_id']);
        });
        Schema::table('sedes', function (Blueprint $table) {
            $table->unsignedBigInteger('cliente_id')->nullable()->change();
            $table->foreign('cliente_id')->references('id')->on('clientes')->cascadeOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('cliente_id')->nullable()->after('rol')->constrained('clientes')->nullOnDelete();
            $table->foreignId('sede_id')->nullable()->after('cliente_id')->constrained('sedes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::table('sedes')->whereNull('cliente_id')->exists()) {
            throw new RuntimeException('Hay sedes propias (sin empresa): asígnalas a una empresa antes de revertir esta migración.');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sede_id');
            $table->dropConstrainedForeignId('cliente_id');
        });

        Schema::table('sedes', function (Blueprint $table) {
            $table->dropForeign(['cliente_id']);
        });
        Schema::table('sedes', function (Blueprint $table) {
            $table->unsignedBigInteger('cliente_id')->nullable(false)->change();
            $table->foreign('cliente_id')->references('id')->on('clientes')->cascadeOnDelete();
        });
    }
};
