<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Carnet de cada usuario: la imagen del carnet de la empresa (foto, nombre y cargo). Se guarda en el disco
 * privado (storage/app/private/carnets) y solo se entrega por una ruta de la administración.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('carnet_path')->nullable()->after('linea_servicio_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('carnet_path');
        });
    }
};
