<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Roles que crea la administración (p. ej. "Conductor" o "Supervisor de bodega"). Cada uno tiene un nivel de
 * acceso de los tres que entiende la plataforma (administrador, coordinador, auxiliar): es lo que decide qué
 * ve y qué puede hacer quien lo tenga. Los tres roles de siempre quedan como roles base.
 */
return new class extends Migration
{
    private const BASE = [
        ['nombre' => 'Administrador', 'nivel' => 'admin', 'descripcion' => 'Crea usuarios, roles, empresas, sedes y sucursales, y ve toda la operación.'],
        ['nombre' => 'Coordinador / Supervisor', 'nivel' => 'coordinador', 'descripcion' => 'Supervisa la operación y al personal de su línea.'],
        ['nombre' => 'Auxiliar operativo', 'nivel' => 'auxiliar', 'descripcion' => 'Personal en campo: consulta su propia información.'],
    ];

    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 60)->unique();
            $table->string('descripcion', 200)->nullable();
            $table->string('nivel', 20)->index();
            // Los roles base no se desactivan ni cambian de nivel: la plataforma siempre tiene un administrador
            $table->boolean('base')->default(false);
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        $ahora = now();
        foreach (self::BASE as $rol) {
            DB::table('roles')->insert([...$rol, 'base' => true, 'activo' => true, 'created_at' => $ahora, 'updated_at' => $ahora]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('rol_id')->nullable()->after('rol')->constrained('roles')->restrictOnDelete();
        });

        // Cada usuario queda con el rol base de su nivel
        foreach (DB::table('roles')->get(['id', 'nivel']) as $rol) {
            DB::table('users')->where('rol', $rol->nivel)->update(['rol_id' => $rol->id]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rol_id');
        });
        Schema::dropIfExists('roles');
    }
};
