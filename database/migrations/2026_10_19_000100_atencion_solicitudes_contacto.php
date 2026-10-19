<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Solicitudes del sitio web: quién la marcó como atendida y cuándo. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('solicitudes_contacto', function (Blueprint $table) {
            $table->timestamp('atendida_en')->nullable()->after('atendida');
            $table->foreignId('atendida_por_id')->nullable()->after('atendida_en')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('solicitudes_contacto', function (Blueprint $table) {
            $table->dropConstrainedForeignId('atendida_por_id');
            $table->dropColumn('atendida_en');
        });
    }
};
