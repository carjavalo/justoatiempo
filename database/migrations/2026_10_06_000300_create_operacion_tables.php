<?php

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulos 2 y 3: ingesta de preliquidación Drivin, órdenes e informe diario consolidado.
 */
return new class extends Migration
{
    public function up(): void
    {
        // RF-03: cada archivo de preliquidación cargado
        Schema::create('cargas', function (Blueprint $table) {
            $table->id();
            $table->string('archivo_nombre');
            $table->string('archivo_path');
            $table->char('archivo_hash', 64)->unique(); // evita cargar el mismo archivo dos veces
            $table->date('fecha_operacion')->nullable()->index();
            $table->enum('estado', EstadoCarga::values())->default(EstadoCarga::Procesando->value);
            $table->unsignedInteger('total_filas')->default(0);
            $table->unsignedInteger('filas_validas')->default(0);
            $table->unsignedInteger('filas_error')->default(0);
            $table->json('errores')->nullable();      // [{fila, columna, mensaje}]
            $table->json('mapeo_columnas')->nullable(); // encabezado Drivin -> campo interno
            $table->unsignedInteger('duracion_ms')->nullable();
            $table->foreignId('cargado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('procesado_en')->nullable();
            $table->timestamps();
        });

        // Informe diario por fecha + cliente + sede (cabecera)
        Schema::create('informes_diarios', function (Blueprint $table) {
            $table->id();
            $table->date('fecha_operacion');
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->enum('estado', EstadoInforme::values())->default(EstadoInforme::Borrador->value)->index();
            // Totales cacheados para el dashboard
            $table->unsignedInteger('total_asignadas')->default(0);
            $table->unsignedInteger('total_aprobadas')->default(0);
            $table->unsignedInteger('total_rechazadas')->default(0);
            $table->unsignedInteger('total_devoluciones')->default(0);
            $table->unsignedInteger('total_averias')->default(0);
            $table->unsignedInteger('total_faltantes')->default(0);
            $table->decimal('efectividad', 5, 2)->default(0);
            $table->text('observaciones')->nullable();
            $table->foreignId('cerrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cerrado_en')->nullable();
            $table->timestamps();

            $table->unique(['fecha_operacion', 'cliente_id', 'sede_id']);
        });

        // RF-04: una fila por orden / NP / evento de la preliquidación
        Schema::create('ordenes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carga_id')->constrained('cargas')->cascadeOnDelete();
            $table->foreignId('informe_id')->nullable()->constrained('informes_diarios')->nullOnDelete();
            $table->date('fecha_operacion');
            $table->foreignId('cliente_id')->nullable()->constrained('clientes')->nullOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->string('ruta', 150)->nullable();          // "Nombre Plan" / operación
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->string('placa', 10)->nullable();          // valor crudo del archivo
            $table->foreignId('empleado_id')->nullable()->constrained('empleados')->nullOnDelete();
            $table->string('auxiliar_nombre', 150)->nullable(); // valor crudo del archivo

            $table->string('codigo_orden', 60);               // NP / Nota / Evento: "cédula del producto"
            $table->string('codigo_direccion', 60)->nullable(); // PDVT000...
            $table->string('destinatario', 150)->nullable();
            $table->string('direccion')->nullable();
            $table->string('ciudad', 80)->nullable();
            $table->unsignedInteger('unidades')->nullable();

            $table->enum('estado', EstadoOrden::values())->index();
            $table->foreignId('motivo_rechazo_id')->nullable()->constrained('motivos_rechazo')->nullOnDelete();
            $table->string('motivo_texto')->nullable();
            $table->text('comentario_pod')->nullable();
            $table->dateTime('hora_entrega')->nullable();

            // RF-07 / RF-08 / faltantes
            $table->boolean('devolucion')->default(false);
            $table->boolean('averia')->default(false);
            $table->string('averia_detalle')->nullable();
            $table->boolean('faltante')->default(false);
            $table->string('faltante_detalle')->nullable();

            $table->json('datos_crudos')->nullable(); // fila original completa, para trazabilidad
            $table->timestamps();

            $table->unique(['fecha_operacion', 'codigo_orden']);
            $table->index(['fecha_operacion', 'cliente_id', 'sede_id']);
            $table->index(['empleado_id', 'fecha_operacion']);
            $table->index('codigo_direccion');
        });

        // RF-05: snapshot inalterable de cada línea del informe (fecha > cliente > sede > ruta > placa > auxiliar)
        Schema::create('informe_lineas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('informe_id')->constrained('informes_diarios')->cascadeOnDelete();
            $table->string('ruta', 150)->nullable();
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->string('placa', 10)->nullable();
            $table->foreignId('empleado_id')->nullable()->constrained('empleados')->nullOnDelete();
            $table->string('auxiliar_nombre', 150)->nullable();
            $table->unsignedInteger('asignadas')->default(0);
            $table->unsignedInteger('aprobadas')->default(0);
            $table->unsignedInteger('rechazadas')->default(0);
            $table->decimal('efectividad', 5, 2)->default(0); // RF-06
            $table->unsignedInteger('devoluciones')->default(0);
            $table->unsignedInteger('averias')->default(0);
            $table->unsignedInteger('faltantes')->default(0);
            $table->unsignedInteger('ordenes_sin_evidencia')->default(0);
            $table->boolean('pod_cumple')->nullable(); // null = sin auditar
            $table->text('novedades')->nullable();
            $table->timestamps();

            $table->index(['informe_id', 'empleado_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('informe_lineas');
        Schema::dropIfExists('ordenes');
        Schema::dropIfExists('informes_diarios');
        Schema::dropIfExists('cargas');
    }
};
