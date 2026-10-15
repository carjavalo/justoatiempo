<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Líneas de servicio (las 8 del portafolio). Cada empresa cliente recibe una o varias líneas y
 * cada usuario no administrador trabaja en una sola: al ingresar entra directo a su línea.
 */
return new class extends Migration
{
    /** Mismos identificadores que resources/js/lib/portafolio.ts (de ahí salen ícono, foto y descripción). */
    private const LINEAS = [
        ['logisticos', 'Servicios logísticos', 'logistica'],
        ['personal', 'Suministro de personal operativo', null],
        ['aseo-general', 'Aseo general', null],
        ['aseo-industrial', 'Aseo industrial', null],
        ['aseo-construccion', 'Aseo de construcción y postobra', null],
        ['zonas-verdes', 'Mantenimiento de zonas verdes', null],
        ['espacios-publicos', 'Limpieza y mantenimiento de espacios públicos', null],
        ['apoyo-plantas', 'Apoyo operativo para plantas y centros logísticos', null],
    ];

    public function up(): void
    {
        Schema::create('lineas_servicio', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('nombre', 120);
            $table->unsignedTinyInteger('orden')->default(0);
            // Herramientas de operación de la línea (p. ej. "logistica": Drivin y auditoría POD); null = tablero por definir
            $table->string('modulo', 30)->nullable();
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });

        Schema::create('cliente_linea_servicio', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->foreignId('linea_servicio_id')->constrained('lineas_servicio')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['cliente_id', 'linea_servicio_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('linea_servicio_id')->nullable()->after('sede_id')->constrained('lineas_servicio')->nullOnDelete();
        });

        $ahora = now();
        foreach (self::LINEAS as $i => [$slug, $nombre, $modulo]) {
            DB::table('lineas_servicio')->insert([
                'slug' => $slug, 'nombre' => $nombre, 'orden' => $i + 1, 'modulo' => $modulo,
                'activa' => true, 'created_at' => $ahora, 'updated_at' => $ahora,
            ]);
        }

        // Lo que ya existía es la operación logística (Drivin): sus empresas y su personal pasan a esa línea
        $logistica = DB::table('lineas_servicio')->where('slug', 'logisticos')->value('id');
        foreach (DB::table('clientes')->pluck('id') as $clienteId) {
            DB::table('cliente_linea_servicio')->insert([
                'cliente_id' => $clienteId, 'linea_servicio_id' => $logistica, 'created_at' => $ahora, 'updated_at' => $ahora,
            ]);
        }
        DB::table('users')->where('rol', '!=', 'admin')->update(['linea_servicio_id' => $logistica]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('linea_servicio_id');
        });
        Schema::dropIfExists('cliente_linea_servicio');
        Schema::dropIfExists('lineas_servicio');
    }
};
