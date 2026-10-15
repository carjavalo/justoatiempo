<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Enlace temporal (túnel de Cloudflare): por afuera solo se ve el sitio público. */
class VistaPreviaTest extends TestCase
{
    use RefreshDatabase;

    private const TUNEL = ['Cf-Ray' => '8f0000000000-BOG'];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.vista_previa' => true]);
    }

    public function test_por_el_enlace_se_ve_el_sitio_publico_y_el_diseno_del_ingreso(): void
    {
        $this->get('/', self::TUNEL)->assertOk();
        $this->get('/login', self::TUNEL)->assertOk();
        $this->post('/contacto', [], self::TUNEL)->assertSessionHasErrors('nombre');
    }

    public function test_por_el_enlace_no_se_ingresa_ni_se_llega_a_la_plataforma(): void
    {
        $admin = User::factory()->admin()->create();

        $this->from('/login')->post('/login', ['email' => $admin->email, 'password' => 'password'], self::TUNEL)
            ->assertRedirect('/login')
            ->assertSessionHasErrors(['email' => 'Esta es una vista previa: el ingreso a la plataforma está deshabilitado.']);
        $this->assertGuest();

        foreach (['/panel', '/usuarios', '/lineas/logisticos', '/cargas'] as $url) {
            $this->get($url, self::TUNEL)->assertNotFound();
        }
    }

    public function test_en_la_red_local_todo_sigue_igual(): void
    {
        $admin = User::factory()->admin()->create();

        $this->post('/login', ['email' => $admin->email, 'password' => 'password'])->assertRedirect('/panel');
        $this->get('/panel')->assertOk();
    }
}
