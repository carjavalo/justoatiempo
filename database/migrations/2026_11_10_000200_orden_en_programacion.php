<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El orden de las personas en cada lugar de la programación lo decide quien programa. Sin orden puesto (null), se
 * ordenan como antes: por la hora de entrada y el nombre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programacion_asignaciones', function (Blueprint $t) {
            $t->unsignedSmallInteger('orden')->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('programacion_asignaciones', fn (Blueprint $t) => $t->dropColumn('orden'));
    }
};
