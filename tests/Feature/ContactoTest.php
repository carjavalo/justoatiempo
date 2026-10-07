<?php

namespace Tests\Feature;

use App\Models\SolicitudContacto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ContactoTest extends TestCase
{
    use RefreshDatabase;

    private function datos(array $cambios = []): array
    {
        return [
            'nombre' => 'Laura Gómez',
            'empresa' => 'Bodegas del Valle',
            'email' => 'laura@example.com',
            'telefono' => '+57 300 000 0000',
            'servicio' => 'Aseo industrial',
            'mensaje' => 'Necesitamos 6 personas para aseo de bodega en Yumbo.',
            'autoriza_datos' => true,
            'sitio_web' => '',
            ...$cambios,
        ];
    }

    public function test_la_pagina_principal_carga_con_las_lineas_de_servicio(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('welcome')->has('servicios', 9));
    }

    public function test_guarda_la_solicitud_con_el_consentimiento(): void
    {
        $this->from('/')->post('/contacto', $this->datos())
            ->assertRedirect('/')
            ->assertSessionHas('contacto_enviado', true);

        $solicitud = SolicitudContacto::sole();
        $this->assertSame('Laura Gómez', $solicitud->nombre);
        $this->assertSame('Aseo industrial', $solicitud->servicio);
        $this->assertNotNull($solicitud->autoriza_datos_en);
        $this->assertNotNull($solicitud->ip);
    }

    public function test_sin_autorizacion_de_datos_no_se_guarda(): void
    {
        $this->from('/')->post('/contacto', $this->datos(['autoriza_datos' => false]))
            ->assertSessionHasErrors('autoriza_datos');

        $this->assertDatabaseCount('solicitudes_contacto', 0);
    }

    public function test_valida_los_campos(): void
    {
        $this->from('/')->post('/contacto', $this->datos([
            'nombre' => '',
            'email' => 'no-es-correo',
            'telefono' => 'llámame',
            'servicio' => 'Servicio inventado',
            'mensaje' => 'corto',
        ]))->assertSessionHasErrors(['nombre', 'email', 'telefono', 'servicio', 'mensaje']);

        $this->assertDatabaseCount('solicitudes_contacto', 0);
    }

    public function test_el_campo_trampa_descarta_robots_sin_avisarles(): void
    {
        $this->from('/')->post('/contacto', $this->datos(['sitio_web' => 'https://spam.example']))
            ->assertRedirect('/')
            ->assertSessionHas('contacto_enviado', true);

        $this->assertDatabaseCount('solicitudes_contacto', 0);
    }

    public function test_limita_los_envios_seguidos(): void
    {
        foreach (range(1, 5) as $i) {
            $this->from('/')->post('/contacto', $this->datos(['email' => "laura{$i}@example.com"]))->assertRedirect('/');
        }

        $this->from('/')->post('/contacto', $this->datos())->assertStatus(429);
        $this->assertDatabaseCount('solicitudes_contacto', 5);
    }
}
