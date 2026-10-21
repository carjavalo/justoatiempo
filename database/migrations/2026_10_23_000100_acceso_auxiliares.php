<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * Los auxiliares operativos entran a la plataforma para ver su carnet: con su cédula (o su correo) y, la primera vez,
 * con su cédula como contraseña, que deben cambiar al ingresar. Su rol base ya no abre ningún módulo: solo su carnet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->boolean('debe_cambiar_contrasena')->default(false)->after('password');
        });

        $auxiliar = DB::table('roles')->where('clave', 'auxiliar')->value('id');
        if (! $auxiliar) {
            return;
        }

        DB::table('roles')->where('id', $auxiliar)->update(['permisos' => json_encode([]), 'updated_at' => now()]);

        // Los que ya estaban registrados sin acceso (los del Excel de auxiliares): entran con su cédula
        DB::table('users')
            ->where('rol_id', $auxiliar)->where('activo', true)->where('acceso', false)->whereNotNull('cedula')
            ->orderBy('id')
            ->get(['id', 'cedula'])
            ->each(fn ($u) => DB::table('users')->where('id', $u->id)->update([
                'acceso' => true,
                'password' => Hash::make($u->cedula),
                'debe_cambiar_contrasena' => true,
                'updated_at' => now(),
            ]));
    }

    public function down(): void
    {
        $auxiliar = DB::table('roles')->where('clave', 'auxiliar')->value('id');
        if ($auxiliar) {
            DB::table('roles')->where('id', $auxiliar)->update(['permisos' => json_encode(['tablero.ver', 'entregas.ver'])]);
            // Quienes aún no habían cambiado la contraseña inicial vuelven a no tener acceso
            DB::table('users')->where('rol_id', $auxiliar)->where('debe_cambiar_contrasena', true)
                ->update(['acceso' => false, 'password' => null]);
        }

        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('debe_cambiar_contrasena');
        });
    }
};
