<?php

namespace Database\Seeders;

use App\Enums\Rol;
use App\Models\Cliente;
use App\Models\Empleado;
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

        $tugo = Cliente::where('nombre', 'TuGo')->first();
        $caliSur = $tugo?->sedes()->where('nombre', 'Cali Sur')->first();

        // Usuarios de desarrollo. Contraseña para todos: "password" (cambiar en producción).
        User::updateOrCreate(['email' => 'admin@justoatiempo.test'], [
            'nombres' => 'Natalia',
            'primer_apellido' => 'Restrepo',
            'password' => 'password',
            'rol' => Rol::Admin,
            'email_verified_at' => now(),
        ]);

        User::updateOrCreate(['email' => 'coordinador@justoatiempo.test'], [
            'nombres' => 'Carlos',
            'primer_apellido' => 'Valderrama',
            'password' => 'password',
            'rol' => Rol::Coordinador,
            'empleado_id' => Empleado::where('cedula', '1000000006')->value('id'),
            'cliente_id' => $tugo?->id,
            'sede_id' => $caliSur?->id,
            'email_verified_at' => now(),
        ]);

        User::updateOrCreate(['email' => 'auxiliar@justoatiempo.test'], [
            'nombres' => 'Andrés',
            'primer_apellido' => 'Moreno',
            'password' => 'password',
            'rol' => Rol::Auxiliar,
            'empleado_id' => Empleado::where('cedula', '1000000002')->value('id'),
            'cliente_id' => $tugo?->id,
            'sede_id' => $caliSur?->id,
            'email_verified_at' => now(),
        ]);
    }
}
