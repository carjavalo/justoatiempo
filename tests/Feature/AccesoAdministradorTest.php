<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** php artisan admin:acceso: recuperar el acceso del administrador desde el servidor. */
class AccesoAdministradorTest extends TestCase
{
    use RefreshDatabase;

    public function test_cambia_el_correo_y_la_contrasena_del_administrador()
    {
        $admin = User::factory()->admin()->create(['email' => 'viejo@example.com', 'activo' => false]);

        $this->artisan('admin:acceso')
            ->expectsQuestion('Correo nuevo', 'Nuevo@Example.com')
            ->expectsQuestion('Contraseña nueva', 'Clave-nueva-2026')
            ->expectsQuestion('Repite la contraseña nueva', 'Clave-nueva-2026')
            ->assertSuccessful();

        $admin->refresh();
        $this->assertSame('nuevo@example.com', $admin->email);
        $this->assertTrue(Hash::check('Clave-nueva-2026', $admin->password));
        $this->assertTrue($admin->activo);

        $this->post('/login', ['email' => 'nuevo@example.com', 'password' => 'Clave-nueva-2026'])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($admin);
    }

    public function test_con_varios_administradores_pregunta_a_cual_y_no_toca_a_los_demas()
    {
        $primero = User::factory()->admin()->create(['email' => 'uno@example.com']);
        $segundo = User::factory()->admin()->create(['email' => 'dos@example.com']);

        $this->artisan('admin:acceso')
            ->expectsQuestion('¿A cuál administrador le cambias el acceso?', (string) $segundo->id)
            ->expectsQuestion('Correo nuevo', 'dos@example.com')
            ->expectsQuestion('Contraseña nueva', 'Clave-nueva-2026')
            ->expectsQuestion('Repite la contraseña nueva', 'Clave-nueva-2026')
            ->assertSuccessful();

        $this->assertTrue(Hash::check('Clave-nueva-2026', $segundo->fresh()->password));
        $this->assertFalse(Hash::check('Clave-nueva-2026', $primero->fresh()->password));
    }
}
