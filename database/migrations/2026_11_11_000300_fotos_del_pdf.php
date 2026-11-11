<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El PDF de prueba de entrega de Drivin se lee al subirlo: lo que dice queda en la evidencia (datos) y cada foto se
 * separa como evidencia propia, ligada a su PDF (origen_id), para clasificarla una por una. La firma del cliente en la
 * app también se separa (tipo firma), y una foto que es copia de otra se puede marcar como repetida: ninguna de las dos
 * cuenta para el protocolo.
 */
return new class extends Migration
{
    private const TIPOS = ['fachada', 'sellado', 'destapado', 'remesa', 'rotulo', 'pdf_pod', 'otro', 'ilegible'];

    public function up(): void
    {
        Schema::table('evidencias', function (Blueprint $t) {
            $t->enum('tipo', [...self::TIPOS, 'firma', 'repetida'])->default('otro')->change();
            $t->foreignId('origen_id')->nullable()->after('pagina_pdf')->constrained('evidencias')->nullOnDelete();
            $t->json('datos')->nullable()->after('imagenes');
        });
    }

    public function down(): void
    {
        DB::table('evidencias')->whereIn('tipo', ['firma', 'repetida'])->update(['tipo' => 'otro']);
        Schema::table('evidencias', function (Blueprint $t) {
            $t->dropConstrainedForeignId('origen_id');
            $t->dropColumn('datos');
            $t->enum('tipo', self::TIPOS)->default('otro')->change();
        });
    }
};
