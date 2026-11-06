<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * La contraseña inicial deja de ser la cédula (que conoce cualquiera que tenga el carnet o una planilla) y pasa a ser un
 * código de 8 cifras al azar. El código se guarda cifrado mientras la persona no crea su contraseña, para que el
 * administrador pueda consultarlo y entregárselo; al crearla, se borra.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->text('codigo_inicial')->nullable()->after('debe_cambiar_contrasena');
        });

        // Quienes aún entraban con su cédula como contraseña inicial pasan a un código: la cédula deja de servir
        DB::table('users')
            ->where('acceso', true)->where('debe_cambiar_contrasena', true)->whereNotNull('password')
            ->orderBy('id')
            ->get(['id'])
            ->each(function ($u) {
                $codigo = str_pad((string) random_int(0, 99_999_999), 8, '0', STR_PAD_LEFT);
                DB::table('users')->where('id', $u->id)->update([
                    'password' => Hash::make($codigo),
                    // Igual que lo guarda el modelo (cast "encrypted")
                    'codigo_inicial' => Crypt::encryptString($codigo),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        // Como antes: quien tenía un código pendiente vuelve a entrar con su cédula
        DB::table('users')
            ->whereNotNull('codigo_inicial')->whereNotNull('cedula')
            ->orderBy('id')
            ->get(['id', 'cedula'])
            ->each(fn ($u) => DB::table('users')->where('id', $u->id)->update(['password' => Hash::make($u->cedula)]));

        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('codigo_inicial');
        });
    }
};
