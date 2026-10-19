<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * El carnet ya no se sube como imagen: la plataforma lo arma con la foto de la persona, su cédula y su cargo.
 * Cada persona tiene además un código propio para el QR del carnet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('cedula', 15)->nullable()->unique()->after('segundo_apellido');
            $table->string('cargo', 60)->nullable()->after('cedula');
            $table->string('foto_path')->nullable()->after('linea_servicio_id');
            $table->string('carnet_codigo', 16)->nullable()->unique()->after('foto_path');
        });

        DB::table('users')->whereNull('carnet_codigo')->orderBy('id')->each(function (object $usuario) {
            DB::table('users')->where('id', $usuario->id)->update(['carnet_codigo' => Str::random(12)]);
        });

        // Las imágenes de carnet que se subieron antes eran el carnet completo, no la foto: ya no sirven
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('carnet_path');
        });
        Storage::disk('local')->deleteDirectory('carnets');
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('carnet_path')->nullable()->after('linea_servicio_id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['cedula']);
            $table->dropUnique(['carnet_codigo']);
            $table->dropColumn(['cedula', 'cargo', 'foto_path', 'carnet_codigo']);
        });
    }
};
