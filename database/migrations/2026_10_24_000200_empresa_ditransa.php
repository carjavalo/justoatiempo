<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * La empresa se escribe Ditransa (con s), como en el Excel del personal. Solo cambia la que se llamaba "Ditranza";
 * sus sedes, asignaciones e informes la siguen por su id.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('empresas')->where('nombre', 'Ditranza')->update(['nombre' => 'Ditransa', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('empresas')->where('nombre', 'Ditransa')->update(['nombre' => 'Ditranza', 'updated_at' => now()]);
    }
};
