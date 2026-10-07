<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nombre de cada usuario por partes, como se escribe en Colombia: nombres, primer y segundo apellido.
 * La columna name se conserva como nombre completo (la arma el modelo) para mostrarlo y buscarlo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nombres', 80)->nullable()->after('name');
            $table->string('primer_apellido', 80)->nullable()->after('nombres');
            $table->string('segundo_apellido', 80)->nullable()->after('primer_apellido');
        });

        // Usuarios existentes: se reparte el nombre completo (con 4 o más palabras, las dos últimas son los apellidos).
        // Los apellidos compuestos ("De la Torre") pueden quedar mal repartidos: se corrigen editando el usuario.
        foreach (DB::table('users')->get(['id', 'name']) as $usuario) {
            $partes = preg_split('/\s+/u', trim((string) $usuario->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $n = count($partes);

            [$nombres, $primero, $segundo] = match (true) {
                $n >= 4 => [implode(' ', array_slice($partes, 0, $n - 2)), $partes[$n - 2], $partes[$n - 1]],
                $n === 3 => [$partes[0], $partes[1], $partes[2]],
                $n === 2 => [$partes[0], $partes[1], null],
                default => [$partes[0] ?? $usuario->name, null, null],
            };

            DB::table('users')->where('id', $usuario->id)->update([
                'nombres' => $nombres,
                'primer_apellido' => $primero,
                'segundo_apellido' => $segundo,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['nombres', 'primer_apellido', 'segundo_apellido']);
        });
    }
};
