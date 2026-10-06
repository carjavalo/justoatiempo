<?php

use App\Enums\CargoEmpleado;
use App\Enums\Rol;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo 1: datos maestros (empleados, clientes, sedes, flota) y catálogos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('empleados', function (Blueprint $table) {
            $table->id();
            $table->string('cedula', 20)->unique(); // RF-01: identificador único
            $table->string('nombres', 100);
            $table->string('apellidos', 100);
            $table->enum('cargo', CargoEmpleado::values())->default(CargoEmpleado::Auxiliar->value);
            $table->string('telefono', 30)->nullable();
            $table->string('email')->nullable();
            $table->date('fecha_ingreso')->nullable();
            $table->boolean('activo')->default(true)->index();
            $table->string('foto_path')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['apellidos', 'nombres']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->enum('rol', Rol::values())->default(Rol::Auxiliar->value)->after('password');
            $table->foreignId('empleado_id')->nullable()->after('rol')->constrained('empleados')->nullOnDelete();
            $table->boolean('activo')->default(true)->after('empleado_id');
            $table->timestamp('ultimo_acceso_en')->nullable()->after('activo');
        });

        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->string('nit', 30)->nullable();
            $table->string('codigo', 30)->nullable()->unique(); // como aparece en Drivin
            $table->decimal('meta_efectividad', 5, 2)->default(95); // % objetivo (hoja "Parámetros cliente")
            $table->string('color', 9)->nullable(); // para gráficos del dashboard
            $table->string('contacto_nombre')->nullable();
            $table->string('contacto_email')->nullable();
            $table->string('contacto_telefono', 30)->nullable();
            $table->boolean('activo')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('sedes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->string('nombre', 120);           // p.ej. Cañasgordas, Cali Sur
            $table->string('alias_drivin', 120)->nullable(); // p.ej. "CALI SUR CROSS" para emparejar la preliquidación
            $table->string('ciudad', 80)->default('Cali');
            $table->string('direccion')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['cliente_id', 'nombre']);
        });

        Schema::create('vehiculos', function (Blueprint $table) {
            $table->id();
            $table->string('placa', 10)->unique(); // normalizada sin espacios: SNX708
            $table->string('codigo_interno', 30)->nullable()->unique();
            $table->string('tipo', 50)->nullable(); // furgón, camión, NHR...
            $table->string('descripcion')->nullable();
            $table->foreignId('conductor_id')->nullable()->constrained('empleados')->nullOnDelete();
            $table->boolean('activo')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('motivos_rechazo', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150)->unique();
            $table->boolean('imputable_operacion')->default(false); // si el rechazo es responsabilidad nuestra
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('tipos_novedad', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150)->unique(); // SIN NOVEDAD, SIN REVISAR, FALTA FOTO FACHADA...
            $table->enum('severidad', ['ninguna', 'leve', 'grave'])->default('ninguna');
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('parametros', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 80)->unique();
            $table->text('valor')->nullable();
            $table->string('descripcion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parametros');
        Schema::dropIfExists('tipos_novedad');
        Schema::dropIfExists('motivos_rechazo');
        Schema::dropIfExists('vehiculos');
        Schema::dropIfExists('sedes');
        Schema::dropIfExists('clientes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empleado_id');
            $table->dropColumn(['rol', 'activo', 'ultimo_acceso_en']);
        });

        Schema::dropIfExists('empleados');
    }
};
