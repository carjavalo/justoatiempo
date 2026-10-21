<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Los auxiliares operativos entran con su cédula (sin correo), la primera vez con su cédula como contraseña, la cambian
 * antes de seguir y solo ven su carnet.
 */
class AccesoAuxiliaresTest extends TestCase
{
    use RefreshDatabase;

    private function auxiliar(): User
    {
        return User::factory()->create([
            'email' => null, 'cedula' => '1144203579', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza',
            'password' => '1144203579', 'debe_cambiar_contrasena' => true,
        ]);
    }

    public function test_entra_con_su_cedula_y_debe_cambiar_la_contrasena_antes_de_seguir(): void
    {
        $auxiliar = $this->auxiliar();

        // Con puntos o espacios, como la escriba
        $this->post('/login', ['email' => '1.144.203.579', 'password' => '1144203579'])->assertRedirect('/panel');
        $this->assertAuthenticatedAs($auxiliar);

        // Cualquier página lo lleva a cambiar la contraseña
        $this->get('/panel')->assertRedirect('/settings/password');
        $this->get('/mi-carnet')->assertRedirect('/settings/password');
        $this->get('/settings/password')->assertInertia(fn (Assert $p) => $p->component('settings/password')->where('obligatorio', true));

        // No sirve dejar la misma ni usar la cédula
        $this->put('/settings/password', ['current_password' => '1144203579', 'password' => '1144203579', 'password_confirmation' => '1144203579'])
            ->assertSessionHasErrors('password');
        $this->put('/settings/password', ['current_password' => '1144203579', 'password' => 'Camion-Azul-27', 'password_confirmation' => 'Camion-Azul-27'])
            ->assertRedirect('/mi-carnet');

        $auxiliar->refresh();
        $this->assertFalse($auxiliar->debe_cambiar_contrasena);
        $this->assertTrue(Hash::check('Camion-Azul-27', $auxiliar->password));
        $this->get('/mi-carnet')->assertOk();
    }

    public function test_el_auxiliar_operativo_solo_ve_su_carnet_y_su_contrasena(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['debe_cambiar_contrasena' => false]);

        $this->actingAs($auxiliar)->get('/panel')->assertRedirect('/mi-carnet');
        $this->get('/mi-carnet')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('auth.permisos', [])
            ->where('auth.user.inicio.url', '/mi-carnet')
            ->where('auth.user.editaPerfil', false)
            ->where('menu', null));
        foreach (['/lineas/logisticos', '/mis-entregas', '/usuarios', '/informes'] as $url) {
            $this->get($url)->assertForbidden();
        }
        // Sus datos los lleva el carnet: en su cuenta, solo la contraseña
        $this->get('/settings/profile')->assertRedirect('/settings/password');
        $this->patch('/settings/profile', ['nombres' => 'Otro', 'primer_apellido' => 'Nombre'])->assertForbidden();
    }

    public function test_el_correo_sigue_sirviendo_y_sin_acceso_no_entra(): void
    {
        $coordinador = User::factory()->coordinador()->create(['email' => 'coordinador@example.com']);
        $this->post('/login', ['email' => 'Coordinador@Example.com', 'password' => 'password'])->assertRedirect('/panel');
        $this->assertAuthenticatedAs($coordinador);
        $this->post('/logout');

        User::factory()->sinAcceso()->create(['cedula' => '99887766']);
        $this->post('/login', ['email' => '99887766', 'password' => '99887766'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->post('/login', ['email' => 'sin numeros', 'password' => 'x'])->assertSessionHasErrors('email');
    }

    public function test_el_administrador_le_devuelve_la_contrasena_inicial(): void
    {
        $admin = User::factory()->admin()->create();
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Su-Clave-2026', 'debe_cambiar_contrasena' => false]);

        $this->actingAs($admin)->put("/usuarios/{$auxiliar->id}", [
            'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'cedula' => '1144203579', 'cargo' => 'Auxiliar logístico',
            'rol_id' => $auxiliar->rol_id, 'acceso' => true, 'restablecer' => true,
        ])->assertSessionHasNoErrors();

        $auxiliar->refresh();
        $this->assertTrue($auxiliar->debe_cambiar_contrasena);
        $this->assertTrue(Hash::check('1144203579', $auxiliar->password));
    }
}
