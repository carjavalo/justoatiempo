<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Certificado de ARL de cada persona (imagen o PDF): se ve al escanear el QR de su carnet. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('arl_path')->nullable()->after('foto_path');
            // Cuándo se cargó: así quien escanea sabe qué tan reciente es el certificado
            $table->timestamp('arl_subida_en')->nullable()->after('arl_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['arl_path', 'arl_subida_en']);
        });
    }
};
