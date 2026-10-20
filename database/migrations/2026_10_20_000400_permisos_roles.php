<?php

use App\Enums\Rol;
use App\Support\Permisos;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cada rol tiene sus permisos (qué módulos ve y qué puede hacer en cada uno) y el alcance de lo que ve de la
 * operación. Los roles que ya existían empiezan con los permisos de su nivel de acceso: nadie gana ni pierde nada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->json('permisos')->nullable()->after('nivel');
            $table->string('alcance', 20)->default(Permisos::ALCANCE_ASIGNACION)->after('permisos');
        });

        foreach (DB::table('roles')->get(['id', 'nivel']) as $rol) {
            $plantilla = Permisos::plantilla(Rol::tryFrom($rol->nivel) ?? Rol::Auxiliar);
            DB::table('roles')->where('id', $rol->id)->update([
                'permisos' => json_encode($plantilla['permisos']),
                'alcance' => $plantilla['alcance'],
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['permisos', 'alcance']);
        });
    }
};
