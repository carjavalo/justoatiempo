<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que trae la preliquidación real de Drivin y el informe necesita:
 * - la cédula del auxiliar ("Entregado por": "[Mobile] 1144203579@justoatiempo.com"): con ella, si la persona se
 *   registra después, sus entregas quedan a su nombre;
 * - si la entrega tiene imágenes ("Tiene imágenes"): sin ellas, la orden no tiene evidencias;
 * - cuántos productos llevaba la orden y cuántos se entregaron (las entregas se cuentan por orden y se muestran
 *   también los productos).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ordenes', function (Blueprint $table) {
            $table->string('auxiliar_cedula', 20)->nullable()->after('auxiliar_nombre')->index();
            $table->boolean('tiene_imagenes')->nullable()->after('comentario_pod');
            $table->unsignedSmallInteger('productos')->default(0)->after('unidades');
            $table->unsignedSmallInteger('productos_entregados')->default(0)->after('productos');
        });

        // Las órdenes ya importadas guardaban sus productos en datos_crudos
        DB::table('ordenes')->select(['id', 'datos_crudos'])->orderBy('id')->chunkById(500, function ($ordenes) {
            foreach ($ordenes as $o) {
                $productos = collect(json_decode((string) $o->datos_crudos, true)['productos'] ?? []);
                if ($productos->isNotEmpty()) {
                    DB::table('ordenes')->where('id', $o->id)->update([
                        'productos' => $productos->count(),
                        'productos_entregados' => $productos->whereIn('estado', ['aprobada', 'parcial'])->count(),
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('ordenes', function (Blueprint $table) {
            $table->dropIndex(['auxiliar_cedula']);
            $table->dropColumn(['auxiliar_cedula', 'tiene_imagenes', 'productos', 'productos_entregados']);
        });
    }
};
