<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Una sola lista de personal (decisión del 2026-10-21): auxiliares, conductores y operarios son usuarios, con su
 * carnet, su ARL y sus asignaciones. Entrar a la plataforma es opcional ("acceso"): quien no lo tiene no ingresa ni
 * puede pedir una contraseña. La tabla "empleados" desaparece y todo lo que apuntaba a ella apunta a la persona:
 * las órdenes y el informe (su auxiliar), el seguimiento, la programación y el conductor habitual de cada vehículo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
            // Quienes ya existían tienen correo y contraseña: conservan el acceso (abajo); las personas nuevas sin él
            $table->boolean('acceso')->default(false)->after('activo');
            $table->string('telefono', 30)->nullable()->after('cargo');
            $table->string('ciudad', 80)->nullable()->after('telefono');
            $table->date('fecha_nacimiento')->nullable()->after('ciudad');
            $table->date('fecha_ingreso')->nullable()->after('fecha_nacimiento');
        });
        DB::table('users')->update(['acceso' => true]);
        // Quienes quedaron con un correo provisional al revertir esta migración siguen sin acceso
        DB::table('users')->where('email', 'like', 'sin-acceso-%@justoatiempo.invalid')->update(['acceso' => false, 'email' => null, 'password' => null]);

        $persona = $this->personasDeEmpleados();

        // Órdenes e informe: su auxiliar
        Schema::table('ordenes', function (Blueprint $table) {
            $table->foreignId('auxiliar_id')->nullable()->after('placa')->constrained('users')->nullOnDelete();
            $table->index(['auxiliar_id', 'fecha_operacion']);
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->foreignId('auxiliar_id')->nullable()->after('placa')->constrained('users')->nullOnDelete();
            $table->index(['informe_id', 'auxiliar_id']);
        });
        // Seguimiento y programación: la persona
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->cascadeOnDelete();
            $table->index(['user_id', 'fecha']);
        });
        Schema::table('programacion_asignaciones', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('programacion_id')->constrained('users')->restrictOnDelete();
            $table->unique(['programacion_id', 'user_id']);
        });

        foreach ($persona as $empleado => $usuario) {
            DB::table('ordenes')->where('empleado_id', $empleado)->update(['auxiliar_id' => $usuario]);
            DB::table('informe_lineas')->where('empleado_id', $empleado)->update(['auxiliar_id' => $usuario]);
            DB::table('acciones_desempeno')->where('empleado_id', $empleado)->update(['user_id' => $usuario]);
            DB::table('programacion_asignaciones')->where('empleado_id', $empleado)->update(['user_id' => $usuario]);
        }
        $this->asignarPorSusEntregas($persona);

        // Sin persona no hay seguimiento ni programación que conservar (no debería pasar: todos tienen su usuario)
        DB::table('acciones_desempeno')->whereNull('user_id')->delete();
        DB::table('programacion_asignaciones')->whereNull('user_id')->delete();

        Schema::table('ordenes', function (Blueprint $table) {
            $table->dropForeign(['empleado_id']);
            $table->dropIndex(['empleado_id', 'fecha_operacion']);
            $table->dropColumn('empleado_id');
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->dropForeign(['empleado_id']);
            $table->dropIndex(['informe_id', 'empleado_id']);
            $table->dropColumn('empleado_id');
        });
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->dropForeign(['empleado_id']);
            $table->dropIndex(['empleado_id', 'fecha']);
            $table->dropColumn('empleado_id');
        });
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
        });
        Schema::table('programacion_asignaciones', function (Blueprint $table) {
            $table->dropForeign(['empleado_id']);
            $table->dropUnique(['programacion_id', 'empleado_id']);
            $table->dropColumn('empleado_id');
        });
        Schema::table('programacion_asignaciones', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
        });

        // El conductor habitual de cada vehículo
        Schema::table('vehiculos', fn (Blueprint $table) => $table->dropForeign(['conductor_id']));
        foreach (DB::table('vehiculos')->whereNotNull('conductor_id')->get(['id', 'conductor_id']) as $v) {
            DB::table('vehiculos')->where('id', $v->id)->update(['conductor_id' => $persona[$v->conductor_id] ?? null]);
        }
        Schema::table('vehiculos', fn (Blueprint $table) => $table->foreign('conductor_id')->references('id')->on('users')->nullOnDelete());

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['empleado_id']);
            $table->dropColumn('empleado_id');
        });
        Schema::dropIfExists('empleados');

        // El módulo Empleados ya no existe: su permiso sale de los roles
        foreach (DB::table('roles')->get(['id', 'permisos']) as $rol) {
            $permisos = json_decode((string) $rol->permisos, true) ?: [];
            if (in_array('empleados.ver', $permisos, true)) {
                DB::table('roles')->where('id', $rol->id)->update(['permisos' => json_encode(array_values(array_diff($permisos, ['empleados.ver'])))]);
            }
        }
    }

    /**
     * Cada empleado con su usuario: el que ya tenía enlazado, el de su misma cédula o uno nuevo sin acceso a la
     * plataforma (con su carnet y su cargo).
     *
     * @return array<int, int> id del empleado => id del usuario
     */
    private function personasDeEmpleados(): array
    {
        $roles = DB::table('roles')->whereNotNull('clave')->pluck('id', 'clave');
        $persona = [];

        foreach (DB::table('empleados')->orderBy('id')->get() as $e) {
            // "U57": la cédula provisional que pone la reversión de esta migración a quien no tenía cédula
            $cedula = $e->cedula && ! preg_match('/^U\d+$/', $e->cedula) ? $e->cedula : null;
            $usuario = DB::table('users')->where('empleado_id', $e->id)->value('id')
                ?? ($cedula ? DB::table('users')->where('cedula', $cedula)->value('id') : null);

            if ($usuario) {
                // Lo que el usuario aún no tenía y sí estaba en el empleado
                $actual = DB::table('users')->where('id', $usuario)->first();
                $faltan = array_filter([
                    'cedula' => $actual->cedula ? null : $cedula,
                    'telefono' => $e->telefono,
                    'fecha_ingreso' => $e->fecha_ingreso,
                ], fn ($v) => $v !== null);
                if ($faltan !== []) {
                    DB::table('users')->where('id', $usuario)->update($faltan);
                }
                $persona[$e->id] = $usuario;

                continue;
            }

            // "Plaza Benavides" → primer apellido "Plaza", segundo "Benavides"
            $apellidos = preg_split('/\s+/u', trim((string) $e->apellidos), 2);
            $nivel = $e->cargo === 'coordinador' || $e->cargo === 'supervisor' ? 'coordinador' : 'auxiliar';
            $correoLibre = $e->email && ! DB::table('users')->where('email', mb_strtolower($e->email))->exists();
            $nombre = trim(preg_replace('/\s+/u', ' ', "{$e->nombres} {$e->apellidos}"));

            $persona[$e->id] = DB::table('users')->insertGetId([
                'name' => $nombre,
                'nombres' => trim((string) $e->nombres),
                'primer_apellido' => $apellidos[0] ?? '',
                'segundo_apellido' => $apellidos[1] ?? null,
                'cedula' => $cedula,
                'cargo' => match ($e->cargo) {
                    'conductor' => 'Conductor',
                    'coordinador' => 'Coordinador',
                    'supervisor' => 'Supervisor',
                    'auxiliar' => 'Auxiliar logístico',
                    default => 'Operario',
                },
                'telefono' => $e->telefono,
                'email' => $correoLibre ? mb_strtolower($e->email) : null,
                'password' => null,
                'rol' => $nivel,
                'rol_id' => $roles[$nivel] ?? null,
                'carnet_codigo' => $this->codigoCarnet(),
                'fecha_ingreso' => $e->fecha_ingreso,
                'activo' => $e->activo && $e->deleted_at === null,
                'acceso' => false,
                'created_at' => $e->created_at ?? now(),
                'updated_at' => now(),
            ]);
        }

        return $persona;
    }

    /**
     * Quien pasó de Empleados a Usuarios y aún no tiene dónde prestar el servicio queda asignado a la empresa donde
     * aparecen sus entregas (la de la sede con más órdenes suyas), en la línea logística, desde su primera entrega.
     *
     * @param  array<int, int>  $persona  id del empleado => id del usuario
     */
    private function asignarPorSusEntregas(array $persona): void
    {
        $logistica = DB::table('lineas_servicio')->where('modulo', 'logistica')->value('id');
        if (! $logistica) {
            return;
        }

        foreach (array_unique($persona) as $usuario) {
            if (DB::table('asignaciones')->where('user_id', $usuario)->exists()) {
                continue;
            }
            $principal = DB::table('ordenes')
                ->join('sedes', 'sedes.id', '=', 'ordenes.sede_id')
                ->where('ordenes.auxiliar_id', $usuario)
                ->selectRaw('sedes.empresa_id, count(*) as total, min(ordenes.fecha_operacion) as desde')
                ->groupBy('sedes.empresa_id')
                ->orderByDesc('total')
                ->first();
            if (! $principal) {
                continue;
            }

            $asignacion = DB::table('asignaciones')->insertGetId([
                'user_id' => $usuario,
                'empresa_id' => $principal->empresa_id,
                'fecha_inicio' => $principal->desde,
                'duracion' => 'indefinida',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('asignacion_linea')->insert(['asignacion_id' => $asignacion, 'linea_servicio_id' => $logistica]);
            // La empresa recibe la línea en la que trabaja su personal
            DB::table('empresa_linea_servicio')->insertOrIgnore(['empresa_id' => $principal->empresa_id, 'linea_servicio_id' => $logistica, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    private function codigoCarnet(): string
    {
        do {
            $codigo = Str::random(12);
        } while (DB::table('users')->where('carnet_codigo', $codigo)->exists());

        return $codigo;
    }

    public function down(): void
    {
        Schema::create('empleados', function (Blueprint $table) {
            $table->id();
            $table->string('cedula', 20)->unique();
            $table->string('nombres', 100);
            $table->string('apellidos', 100);
            $table->enum('cargo', ['auxiliar', 'conductor', 'coordinador', 'supervisor', 'otro'])->default('auxiliar');
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

        // Un empleado por cada persona que aparece en la operación (con su cédula, o una provisional)
        $usados = collect([
            DB::table('ordenes')->whereNotNull('auxiliar_id')->distinct()->pluck('auxiliar_id'),
            DB::table('informe_lineas')->whereNotNull('auxiliar_id')->distinct()->pluck('auxiliar_id'),
            DB::table('acciones_desempeno')->distinct()->pluck('user_id'),
            DB::table('programacion_asignaciones')->distinct()->pluck('user_id'),
            DB::table('vehiculos')->whereNotNull('conductor_id')->distinct()->pluck('conductor_id'),
        ])->flatten()->unique();
        $empleado = [];
        foreach (DB::table('users')->whereIn('id', $usados)->get() as $u) {
            $empleado[$u->id] = DB::table('empleados')->insertGetId([
                'cedula' => $u->cedula ?: 'U'.$u->id,
                'nombres' => $u->nombres ?: $u->name,
                'apellidos' => trim(($u->primer_apellido ?? '').' '.($u->segundo_apellido ?? '')),
                'cargo' => $u->rol === 'coordinador' ? 'coordinador' : 'auxiliar',
                'telefono' => $u->telefono,
                'email' => $u->email,
                'fecha_ingreso' => $u->fecha_ingreso,
                'activo' => $u->activo,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('users', fn (Blueprint $table) => $table->foreignId('empleado_id')->nullable()->after('rol_id')->constrained('empleados')->nullOnDelete());
        foreach ($empleado as $usuario => $id) {
            DB::table('users')->where('id', $usuario)->update(['empleado_id' => $id]);
        }

        Schema::table('vehiculos', fn (Blueprint $table) => $table->dropForeign(['conductor_id']));
        foreach (DB::table('vehiculos')->whereNotNull('conductor_id')->get(['id', 'conductor_id']) as $v) {
            DB::table('vehiculos')->where('id', $v->id)->update(['conductor_id' => $empleado[$v->conductor_id] ?? null]);
        }
        Schema::table('vehiculos', fn (Blueprint $table) => $table->foreign('conductor_id')->references('id')->on('empleados')->nullOnDelete());

        Schema::table('ordenes', function (Blueprint $table) {
            $table->foreignId('empleado_id')->nullable()->after('placa')->constrained('empleados')->nullOnDelete();
            $table->index(['empleado_id', 'fecha_operacion']);
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->foreignId('empleado_id')->nullable()->after('placa')->constrained('empleados')->nullOnDelete();
            $table->index(['informe_id', 'empleado_id']);
        });
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->foreignId('empleado_id')->nullable()->after('id')->constrained('empleados')->restrictOnDelete();
            $table->index(['empleado_id', 'fecha']);
        });
        Schema::table('programacion_asignaciones', function (Blueprint $table) {
            $table->foreignId('empleado_id')->nullable()->after('programacion_id')->constrained('empleados')->restrictOnDelete();
            $table->unique(['programacion_id', 'empleado_id']);
        });
        foreach ($empleado as $usuario => $id) {
            DB::table('ordenes')->where('auxiliar_id', $usuario)->update(['empleado_id' => $id]);
            DB::table('informe_lineas')->where('auxiliar_id', $usuario)->update(['empleado_id' => $id]);
            DB::table('acciones_desempeno')->where('user_id', $usuario)->update(['empleado_id' => $id]);
            DB::table('programacion_asignaciones')->where('user_id', $usuario)->update(['empleado_id' => $id]);
        }

        Schema::table('ordenes', function (Blueprint $table) {
            $table->dropForeign(['auxiliar_id']);
            $table->dropIndex(['auxiliar_id', 'fecha_operacion']);
            $table->dropColumn('auxiliar_id');
        });
        Schema::table('informe_lineas', function (Blueprint $table) {
            $table->dropForeign(['auxiliar_id']);
            $table->dropIndex(['informe_id', 'auxiliar_id']);
            $table->dropColumn('auxiliar_id');
        });
        Schema::table('acciones_desempeno', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['user_id', 'fecha']);
            $table->dropColumn('user_id');
        });
        Schema::table('programacion_asignaciones', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropUnique(['programacion_id', 'user_id']);
            $table->dropColumn('user_id');
        });

        // Sin la columna "acceso", a quien no lo tenía se le deja un correo que no recibe nada (el real, si lo tenía,
        // ya quedó en su empleado): así no puede pedir una contraseña. Al volver a migrar sigue sin acceso.
        DB::table('users')->where(fn ($q) => $q->whereNull('email')->orWhere('acceso', false))
            ->update(['email' => DB::raw("concat('sin-acceso-', id, '@justoatiempo.invalid')")]);
        DB::table('users')->whereNull('password')->update(['password' => bcrypt(Str::random(40))]);
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['acceso', 'telefono', 'ciudad', 'fecha_nacimiento', 'fecha_ingreso']);
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
