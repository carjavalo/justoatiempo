<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo 1: programación diaria de personal (RF-02).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programaciones', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->unsignedSmallInteger('auxiliares_requeridos')->default(0);
            $table->unsignedSmallInteger('vehiculos_requeridos')->default(0);
            $table->text('observaciones')->nullable();
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['fecha', 'cliente_id', 'sede_id']);
        });

        // Personal y vehículo efectivamente asignados a cada programación
        Schema::create('programacion_asignaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programacion_id')->constrained('programaciones')->cascadeOnDelete();
            $table->foreignId('empleado_id')->constrained('empleados')->restrictOnDelete();
            $table->foreignId('vehiculo_id')->nullable()->constrained('vehiculos')->nullOnDelete();
            $table->string('ruta', 120)->nullable();
            $table->timestamps();

            $table->unique(['programacion_id', 'empleado_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('programacion_asignaciones');
        Schema::dropIfExists('programaciones');
    }
};
