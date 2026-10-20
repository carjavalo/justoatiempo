<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los tres roles base se reconocen por una clave fija ("administrador", "coordinador", "auxiliar") y no por sus
 * permisos: así ningún otro rol puede volverse el Administrador de la plataforma (que siempre lo puede todo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('clave', 30)->nullable()->unique()->after('nombre');
        });

        $claves = ['admin' => 'administrador', 'coordinador' => 'coordinador', 'auxiliar' => 'auxiliar'];
        foreach (DB::table('roles')->where('base', true)->orderBy('id')->get(['id', 'nivel']) as $rol) {
            $clave = $claves[$rol->nivel] ?? null;
            if ($clave && ! DB::table('roles')->where('clave', $clave)->exists()) {
                DB::table('roles')->where('id', $rol->id)->update(['clave' => $clave]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['clave']);
            $table->dropColumn('clave');
        });
    }
};
