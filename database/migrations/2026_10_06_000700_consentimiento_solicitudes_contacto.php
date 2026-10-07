<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Ley 1581 de 2012 (habeas data): constancia de la autorización de tratamiento de datos. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitudes_contacto', function (Blueprint $table) {
            $table->timestamp('autoriza_datos_en')->nullable()->after('mensaje');
            $table->string('ip', 45)->nullable()->after('autoriza_datos_en');
        });
    }

    public function down(): void
    {
        Schema::table('solicitudes_contacto', function (Blueprint $table) {
            $table->dropColumn(['autoriza_datos_en', 'ip']);
        });
    }
};
