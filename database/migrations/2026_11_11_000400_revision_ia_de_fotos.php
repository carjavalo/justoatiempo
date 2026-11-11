<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que propuso la IA de cada foto de la auditoría POD (RevisorIa): qué muestra, si es copia de otra, si el producto
 * se ve bien y, en la remesa, si está firmada. Es una propuesta: el tipo que cuenta es el de la evidencia, que el
 * auditor confirma o cambia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('evidencias', function (Blueprint $t) {
            $t->json('ia')->nullable()->after('datos');
        });
    }

    public function down(): void
    {
        Schema::table('evidencias', function (Blueprint $t) {
            $t->dropColumn('ia');
        });
    }
};
