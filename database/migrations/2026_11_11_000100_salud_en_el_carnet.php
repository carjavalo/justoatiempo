<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El carnet lleva el RH, la EPS y la ARL de cada persona (en el renglón donde antes iba el correo). La ARL de la
 * empresa es SURA: quien ya está registrado queda con ella, y se puede cambiar persona por persona.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rh', 3)->nullable()->after('cargo');
            $table->string('eps', 80)->nullable()->after('rh');
            $table->string('arl_entidad', 80)->nullable()->after('eps');
        });

        DB::table('users')->whereNull('arl_entidad')->update(['arl_entidad' => 'SURA']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['rh', 'eps', 'arl_entidad']);
        });
    }
};
