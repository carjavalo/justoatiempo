<?php

namespace Tests\Feature;

use App\Models\SolicitudContacto;
use App\Models\User;
use App\Notifications\NuevaSolicitudContacto;
use App\Notifications\SolicitudRecibida;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** "Hablemos de su operación": los correos que salen al enviar el formulario y la bandeja de la plataforma. */
class SolicitudesContactoTest extends TestCase
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
            'mensaje' => "Necesitamos 6 personas para aseo de bodega en Yumbo.\nTurno de la noche.",
            'autoriza_datos' => true,
            'sitio_web' => '',
            ...$cambios,
        ];
    }

    /** @return list<string> */
    private function rutas(AnonymousNotifiable $destino): array
    {
        return (array) $destino->routes['mail'];
    }

    public function test_al_equipo_le_llega_la_solicitud_y_a_quien_escribio_la_confirmacion()
    {
        Notification::fake();
        User::factory()->admin()->create(['email' => 'admin@example.com']);
        User::factory()->admin()->create(['email' => 'inactivo@example.com', 'activo' => false]);
        User::factory()->coordinador()->create(['email' => 'coordinador@example.com']);

        $this->from('/')->post('/contacto', $this->datos())->assertSessionHas('contacto_enviado', true);

        // Sin MAIL_CONTACTO, a los administradores activos
        Notification::assertSentOnDemand(NuevaSolicitudContacto::class, fn ($n, $canales, AnonymousNotifiable $destino) => $this->rutas($destino) === ['admin@example.com']);
        Notification::assertSentOnDemand(SolicitudRecibida::class, function (SolicitudRecibida $n, $canales, AnonymousNotifiable $destino) {
            // Si responde la confirmación, le llega al equipo
            return $this->rutas($destino) === ['laura@example.com'] && $n->equipo === ['admin@example.com'];
        });
        Notification::assertSentOnDemandTimes(NuevaSolicitudContacto::class, 1);
    }

    public function test_si_se_configura_un_buzon_las_solicitudes_le_llegan_a_ese()
    {
        Notification::fake();
        User::factory()->admin()->create(['email' => 'admin@example.com']);
        config(['mail.contacto' => 'comercial@justoatiemposp.com, gerencia@justoatiemposp.com']);

        $this->from('/')->post('/contacto', $this->datos());

        Notification::assertSentOnDemand(NuevaSolicitudContacto::class, fn ($n, $c, AnonymousNotifiable $destino) => $this->rutas($destino) === ['comercial@justoatiemposp.com', 'gerencia@justoatiemposp.com']);
    }

    public function test_el_correo_al_equipo_trae_los_datos_y_al_responder_le_llega_al_cliente()
    {
        $this->from('/')->post('/contacto', $this->datos(['mensaje' => "Primera línea <b>sin HTML</b>\nSegunda línea"]));
        $solicitud = SolicitudContacto::sole();

        $correo = (new NuevaSolicitudContacto($solicitud))->toMail(new AnonymousNotifiable);
        $html = (string) $correo->render();

        $this->assertSame('Nueva solicitud de cotización: Bodegas del Valle', $correo->subject);
        $this->assertSame([['laura@example.com', 'Laura Gómez']], $correo->replyTo);
        foreach (['Laura Gómez', 'Bodegas del Valle', 'mailto:laura@example.com', 'tel:+573000000000', 'Aseo industrial', route('solicitudes.index')] as $texto) {
            $this->assertStringContainsString($texto, $html);
        }
        // Lo que escribió la persona se muestra como texto, con sus saltos de línea
        $this->assertStringContainsString('Primera línea &lt;b&gt;sin HTML&lt;/b&gt;<br />', $html);
    }

    public function test_la_confirmacion_no_repite_lo_que_escribio_la_persona()
    {
        $this->from('/')->post('/contacto', $this->datos(['nombre' => 'Visite www.spam.example', 'mensaje' => 'Compre ya en www.spam.example ahora mismo']));
        $solicitud = SolicitudContacto::sole();

        $correo = (new SolicitudRecibida($solicitud, ['comercial@justoatiemposp.com']))->toMail(new AnonymousNotifiable);
        $html = (string) $correo->render();

        $this->assertSame('Recibimos su solicitud de cotización', $correo->subject);
        $this->assertStringContainsString('de <strong>Aseo industrial</strong>', $html);
        $this->assertStringContainsString('Si quiere agregar algo a su solicitud, responda este correo.', $html);
        $this->assertStringNotContainsString('spam.example', $html);
        $this->assertSame([['comercial@justoatiemposp.com', 'Justo a Tiempo SP']], $correo->replyTo);
    }

    public function test_a_un_mismo_correo_le_llegan_maximo_tres_confirmaciones_por_hora()
    {
        Notification::fake();
        User::factory()->admin()->create();

        foreach (range(1, 4) as $i) {
            $this->travel(61)->seconds(); // fuera del límite de envíos seguidos del formulario
            $this->from('/')->post('/contacto', $this->datos(['email' => 'Victima@Example.com']));
        }

        // Las 4 solicitudes llegan al equipo; la persona recibe solo 3 confirmaciones
        Notification::assertSentOnDemandTimes(NuevaSolicitudContacto::class, 4);
        Notification::assertSentOnDemandTimes(SolicitudRecibida::class, 3);
        $this->assertSame(4, SolicitudContacto::count());
    }

    public function test_un_robot_no_dispara_correos()
    {
        Notification::fake();
        User::factory()->admin()->create();

        $this->from('/')->post('/contacto', $this->datos(['sitio_web' => 'https://spam.example']));

        Notification::assertNothingSent();
    }

    public function test_solo_la_administracion_ve_las_solicitudes()
    {
        $this->get('/solicitudes')->assertRedirect('/login');
        $this->actingAs(User::factory()->coordinador()->create())->get('/solicitudes')->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->get('/solicitudes')->assertOk();
    }

    public function test_la_bandeja_muestra_primero_las_pendientes_y_se_marcan_como_atendidas()
    {
        $admin = User::factory()->admin()->create(['nombres' => 'Natalia', 'primer_apellido' => 'Ruiz']);
        $vieja = SolicitudContacto::create([...collect($this->datos(['nombre' => 'Primera']))->except(['autoriza_datos', 'sitio_web'])->all()]);
        $this->travel(5)->minutes();
        $nueva = SolicitudContacto::create([...collect($this->datos(['nombre' => 'Segunda', 'empresa' => 'Logística Cali']))->except(['autoriza_datos', 'sitio_web'])->all()]);

        // Sin filtro: las pendientes, la más reciente primero
        $this->actingAs($admin)->get('/solicitudes')->assertInertia(fn (Assert $p) => $p
            ->component('solicitudes/index')
            ->where('total', 2)
            ->where('pendientes', 2)
            ->where('filtros.estado', '')
            ->where('solicitudes.data.0.nombre', 'Segunda')
            ->where('solicitudes.data.1.nombre', 'Primera'));

        $this->actingAs($admin)->patch("/solicitudes/{$vieja->id}/atencion", ['atendida' => true])
            ->assertSessionHas('success', 'La solicitud de Primera quedó como atendida.');
        $vieja->refresh();
        $this->assertTrue($vieja->atendida);
        $this->assertSame($admin->id, $vieja->atendida_por_id);
        $this->assertNotNull($vieja->atendida_en);

        $this->actingAs($admin)->get('/solicitudes')->assertInertia(fn (Assert $p) => $p->where('pendientes', 1)->has('solicitudes.data', 1));
        $this->actingAs($admin)->get('/solicitudes?estado=atendidas')->assertInertia(fn (Assert $p) => $p
            ->has('solicitudes.data', 1)
            ->where('solicitudes.data.0.atendidaPor', 'Natalia Ruiz'));
        $this->actingAs($admin)->get('/solicitudes?estado=todas&q=Logística')->assertInertia(fn (Assert $p) => $p
            ->has('solicitudes.data', 1)
            ->where('solicitudes.data.0.id', $nueva->id));

        // Volver a pendientes borra quién y cuándo
        $this->actingAs($admin)->patch("/solicitudes/{$vieja->id}/atencion", ['atendida' => false]);
        $vieja->refresh();
        $this->assertFalse($vieja->atendida);
        $this->assertNull($vieja->atendida_por_id);
        $this->assertNull($vieja->atendida_en);
    }

    public function test_el_panel_avisa_cuantas_solicitudes_faltan_por_atender()
    {
        $admin = User::factory()->admin()->create();
        SolicitudContacto::create([...collect($this->datos())->except(['autoriza_datos', 'sitio_web'])->all()]);
        SolicitudContacto::create([...collect($this->datos())->except(['autoriza_datos', 'sitio_web'])->all(), 'atendida' => true]);

        $this->actingAs($admin)->get('/panel')->assertInertia(fn (Assert $p) => $p
            // En el inicio, lo que pide atención; en el menú, el contador
            ->where('pendientes', fn ($p) => collect($p)->firstWhere('clave', 'solicitudes')['texto'] === '1 solicitud de cotización sin atender')
            ->where('menu', fn ($menu) => collect($menu)->flatMap(fn ($g) => $g['items'])->firstWhere('titulo', 'Solicitudes')['contador'] === 1));
    }
}
