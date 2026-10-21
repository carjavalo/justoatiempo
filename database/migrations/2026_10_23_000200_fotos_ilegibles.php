<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fotos borrosas o ilegibles en la auditoría POD: una foto suelta se puede clasificar así, y la lista de chequeo cuenta
 * cuántas hay (también las que vienen dentro del PDF). No cuentan para el protocolo y dejan su novedad.
 */
return new class extends Migration
{
    private const TIPOS = ['fachada', 'sellado', 'destapado', 'remesa', 'rotulo', 'pdf_pod', 'otro'];

    public function up(): void
    {
        Schema::table('evidencias', function (Blueprint $t) {
            $t->enum('tipo', [...self::TIPOS, 'ilegible'])->default('otro')->change();
        });

        Schema::table('auditorias_pod', function (Blueprint $t) {
            $t->unsignedTinyInteger('fotos_ilegibles')->default(0)->after('fotos_destapado');
        });

        $ahora = now();
        DB::table('tipos_novedad')->insertOrIgnore(['nombre' => 'Fotos borrosas o ilegibles', 'severidad' => 'leve', 'activo' => true, 'created_at' => $ahora, 'updated_at' => $ahora]);
    }

    public function down(): void
    {
        DB::table('evidencias')->where('tipo', 'ilegible')->update(['tipo' => 'otro']);
        Schema::table('evidencias', function (Blueprint $t) {
            $t->enum('tipo', self::TIPOS)->default('otro')->change();
        });

        Schema::table('auditorias_pod', function (Blueprint $t) {
            $t->dropColumn('fotos_ilegibles');
        });
        // El tipo de novedad se conserva: puede estar en auditorías
    }
};
