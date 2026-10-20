<?php

namespace Database\Seeders;

use App\Enums\Rol;
use App\Models\Empleado;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            CatalogosSeeder::class,
            OperacionSeeder::class,
        ]);

        $tugo = Sede::where('nombre', 'TuGo')->first();
        $caliSur = $tugo?->sucursales()->where('nombre', 'Cali Sur')->first();
        $logistica = LineaServicio::logistica();

        // Usuarios de desarrollo. Contraseña para todos: "password" (cambiar en producción).
        User::updateOrCreate(['email' => 'admin@justoatiempo.test'], [
            'nombres' => 'Natalia',
            'primer_apellido' => 'Restrepo',
            'password' => 'password',
            'rol' => Rol::Admin,
            'email_verified_at' => now(),
        ]);

        $coordinador = User::updateOrCreate(['email' => 'coordinador@justoatiempo.test'], [
            'nombres' => 'Carlos',
            'primer_apellido' => 'Valderrama',
            'password' => 'password',
            'rol' => Rol::Coordinador,
            'empleado_id' => Empleado::where('cedula', '1000000006')->value('id'),
            'email_verified_at' => now(),
        ]);

        $auxiliar = User::updateOrCreate(['email' => 'auxiliar@justoatiempo.test'], [
            'nombres' => 'Andrés',
            'primer_apellido' => 'Moreno',
            'password' => 'password',
            'rol' => Rol::Auxiliar,
            'empleado_id' => Empleado::where('cedula', '1000000002')->value('id'),
            'email_verified_at' => now(),
        ]);

        // Los dos prestan el servicio logístico en TuGo · Cali Sur (de Ditranza)
        foreach ([$coordinador, $auxiliar] as $persona) {
            if ($persona->asignaciones()->exists()) {
                continue;
            }
            $asignacion = $persona->asignaciones()->create([
                'empresa_id' => $tugo?->empresa_id,
                'sede_id' => $tugo?->id,
                'sucursal_id' => $caliSur?->id,
                'fecha_inicio' => today()->startOfMonth()->toDateString(),
                'duracion' => 'indefinida',
            ]);
            $asignacion->lineas()->sync([$logistica->id]);
        }
    }
}
