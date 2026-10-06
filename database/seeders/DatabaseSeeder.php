<?php

namespace Database\Seeders;

use App\Enums\Rol;
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

        // Usuarios de desarrollo. Contraseña para todos: "password" (cambiar en producción).
        User::updateOrCreate(['email' => 'admin@justoatiempo.test'], [
            'name' => 'Natalia Restrepo',
            'password' => 'password',
            'rol' => Rol::Admin,
            'email_verified_at' => now(),
        ]);

        User::updateOrCreate(['email' => 'coordinador@justoatiempo.test'], [
            'name' => 'Carlos Valderrama',
            'password' => 'password',
            'rol' => Rol::Coordinador,
            'empleado_id' => Empleado::where('cedula', '1000000006')->value('id'),
            'email_verified_at' => now(),
        ]);

        User::updateOrCreate(['email' => 'auxiliar@justoatiempo.test'], [
            'name' => 'Andrés Moreno',
            'password' => 'password',
            'rol' => Rol::Auxiliar,
            'empleado_id' => Empleado::where('cedula', '1000000002')->value('id'),
            'email_verified_at' => now(),
        ]);
    }
}
