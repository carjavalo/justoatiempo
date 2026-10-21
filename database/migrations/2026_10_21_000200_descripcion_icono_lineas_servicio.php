<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Las líneas de servicio se crean y editan desde la plataforma: cada una tiene su descripción y su ícono
 * (una clave del catálogo de App\Models\LineaServicio::ICONOS). Las 8 del portafolio quedan con los suyos.
 */
return new class extends Migration
{
    private const LINEAS = [
        'logisticos' => ['logistica', 'Personal especializado para todas las etapas de la cadena de abastecimiento: cargue y descargue, picking, inventarios, despachos y distribución.'],
        'personal' => ['personal', 'Talento humano para necesidades operativas temporales, permanentes o por proyectos, adaptado a los procesos internos de cada cliente.'],
        'aseo-general' => ['aseo', 'Limpieza y desinfección de empresas, oficinas, edificios, instituciones, conjuntos residenciales y establecimientos comerciales.'],
        'aseo-industrial' => ['escoba', 'Procesos especializados de limpieza en ambientes industriales y logísticos bajo protocolos de seguridad.'],
        'aseo-construccion' => ['rodillo', 'Labores de limpieza durante y después de obras civiles, remodelaciones y adecuaciones.'],
        'zonas-verdes' => ['planta', 'Conservación de jardines y espacios verdes mediante labores de mantenimiento preventivo y correctivo.'],
        'espacios-publicos' => ['arbol', 'Conservación y mantenimiento de parques, vías peatonales y espacios urbanos.'],
        'apoyo-plantas' => ['operario', 'Personal de apoyo para fortalecer procesos productivos, logísticos y de almacenamiento.'],
    ];

    public function up(): void
    {
        Schema::table('lineas_servicio', function (Blueprint $table) {
            $table->string('descripcion', 300)->nullable()->after('nombre');
            $table->string('icono', 30)->nullable()->after('descripcion');
        });

        foreach (self::LINEAS as $slug => [$icono, $descripcion]) {
            DB::table('lineas_servicio')->where('slug', $slug)->update(['icono' => $icono, 'descripcion' => $descripcion]);
        }
    }

    public function down(): void
    {
        Schema::table('lineas_servicio', function (Blueprint $table) {
            $table->dropColumn(['descripcion', 'icono']);
        });
    }
};
