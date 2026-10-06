<?php

use App\Enums\TipoAccion;
use App\Enums\TipoEvidencia;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulos 4 y 5: auditoría POD, evidencias, acciones de desempeño, bitácora y contacto del sitio público.
 */
return new class extends Migration
{
    public function up(): void
    {
        // RF-09 / RF-10: checklist del protocolo de entrega, una por orden
        Schema::create('auditorias_pod', function (Blueprint $table) {
            $table->id();
            $table->foreignId('orden_id')->unique()->constrained('ordenes')->cascadeOnDelete();
            $table->boolean('foto_fachada')->default(false);
            $table->unsignedTinyInteger('fotos_sellado')->default(0);   // mínimo 4
            $table->unsignedTinyInteger('fotos_destapado')->default(0); // mínimo 4
            $table->boolean('foto_remesa')->default(false);
            $table->boolean('foto_rotulo')->default(false);
            $table->boolean('recibe_sin_destapar')->default(false);     // nota firmada "Recibe sin destapar a conformidad"
            $table->boolean('sin_evidencia')->default(false);
            $table->boolean('cumple_protocolo')->default(false)->index();
            $table->foreignId('tipo_novedad_id')->nullable()->constrained('tipos_novedad')->nullOnDelete();
            $table->text('concepto')->nullable(); // "Buen protocolo de entrega pero puede mejorar"
            $table->foreignId('auditado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('auditado_en')->nullable();
            $table->timestamps();
        });

        Schema::create('evidencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('orden_id')->constrained('ordenes')->cascadeOnDelete();
            $table->enum('tipo', TipoEvidencia::values())->default(TipoEvidencia::Otro->value);
            $table->string('path');
            $table->string('nombre_original')->nullable();
            $table->string('mime', 100)->nullable();
            $table->unsignedInteger('tamano_bytes')->nullable();
            $table->unsignedSmallInteger('pagina_pdf')->nullable(); // si fue extraída de un PDF POD
            $table->foreignId('subido_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['orden_id', 'tipo']);
        });

        // RF-11: felicitación, retroalimentación o llamado de atención
        Schema::create('acciones_desempeno', function (Blueprint $table) {
            $table->id();
            $table->foreignId('empleado_id')->constrained('empleados')->restrictOnDelete();
            $table->foreignId('informe_id')->nullable()->constrained('informes_diarios')->nullOnDelete();
            $table->date('fecha');
            $table->enum('tipo', TipoAccion::values());
            $table->text('descripcion');
            $table->decimal('efectividad_referencia', 5, 2)->nullable(); // snapshot al momento de la acción
            $table->boolean('notificado')->default(false);
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['empleado_id', 'fecha']);
            $table->index(['tipo', 'fecha']);
        });

        // Trazabilidad: quién cambió qué
        Schema::create('bitacora', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('accion', 50);           // creado, actualizado, eliminado, cerrado, cargado...
            $table->string('modelo_tipo', 120);
            $table->unsignedBigInteger('modelo_id')->nullable();
            $table->json('cambios')->nullable();     // {antes: {...}, despues: {...}}
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['modelo_tipo', 'modelo_id']);
        });

        // Formulario de contacto del sitio público
        Schema::create('solicitudes_contacto', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120);
            $table->string('empresa', 150)->nullable();
            $table->string('email');
            $table->string('telefono', 30)->nullable();
            $table->string('servicio', 80)->nullable();
            $table->text('mensaje');
            $table->boolean('atendida')->default(false)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('solicitudes_contacto');
        Schema::dropIfExists('bitacora');
        Schema::dropIfExists('acciones_desempeno');
        Schema::dropIfExists('evidencias');
        Schema::dropIfExists('auditorias_pod');
    }
};
