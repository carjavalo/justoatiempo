<?php

namespace Tests\Feature;

use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Módulo de líneas de servicio: se crean las nuevas (con su ícono y su descripción), se editan sin cambiar la
 * dirección de su página y se desactivan cuando nadie trabaja en ellas.
 */
class LineasAdministracionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private LineaServicio $aseo;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-21 09:00:00');
        $this->admin = User::factory()->admin()->create();
        $this->aseo = LineaServicio::where('slug', 'aseo-general')->sole();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function asignar(User $persona, LineaServicio $linea, array $extra = []): void
    {
        $asignacion = Asignacion::create(['user_id' => $persona->id, 'fecha_inicio' => '2026-10-01', 'duracion' => 'indefinida', ...$extra]);
        $asignacion->lineas()->sync([$linea->id]);
    }

    public function test_lista_las_lineas_con_su_icono_y_sus_conteos(): void
    {
        $this->empresa()->lineas()->attach($this->aseo);
        $this->asignar(User::factory()->create(['linea_servicio_id' => null]), $this->aseo);

        $this->actingAs($this->admin)->get('/lineas-de-servicio')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('servicios/index')
                ->has('lineas', 8)
                ->where('lineas.0.slug', 'logisticos')
                ->where('lineas.0.icono', 'logistica')
                ->where('lineas.0.drivin', true)
                ->where('lineas.2.slug', 'aseo-general')
                ->where('lineas.2.drivin', false)
                ->where('lineas.2.empresas', 1)
                ->where('lineas.2.personas', 1)
                ->where('lineas.2.verLinea', true));
    }

    public function test_crea_una_linea_que_ya_se_puede_usar(): void
    {
        $this->actingAs($this->admin)->post('/lineas-de-servicio', [
            'nombre' => '  Vigilancia y portería ', 'descripcion' => 'Control de acceso y rondas.', 'icono' => 'seguridad',
        ])->assertSessionHasNoErrors()->assertSessionHas('success');

        $linea = LineaServicio::where('nombre', 'Vigilancia y portería')->sole();
        $this->assertSame(['vigilancia-y-porteria', 9, true, null, 'seguridad'], [$linea->slug, $linea->orden, $linea->activa, $linea->modulo, $linea->icono]);

        // Sale en el panel, tiene su página y se le asignan personas (la empresa pasa a recibirla)
        $this->actingAs($this->admin)->get('/panel')->assertInertia(fn (Assert $p) => $p->has('lineas', 8)->where('lineas.7.icono', 'seguridad'));
        $this->actingAs($this->admin)->get('/lineas/vigilancia-y-porteria')->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('lineas/linea')->where('linea.descripcion', 'Control de acceso y rondas.'));
        $empresa = $this->empresa();
        $ana = User::factory()->create(['linea_servicio_id' => null]);
        $this->actingAs($this->admin)->post('/asignaciones', [
            'usuario_id' => $ana->id, 'empresa_id' => $empresa->id, 'lineas' => [$linea->id], 'fecha_inicio' => '2026-10-21', 'duracion' => 'indefinida',
        ])->assertSessionHasNoErrors();
        $this->assertTrue($empresa->lineas()->whereKey($linea->id)->exists());
    }

    public function test_el_slug_no_se_repite_ni_cambia_al_editar(): void
    {
        $this->actingAs($this->admin)->post('/lineas-de-servicio', ['nombre' => 'Aseo General', 'icono' => 'aseo'])
            ->assertSessionHasErrors(['nombre' => 'Ya hay una línea de servicio con este nombre.']);

        // Otro nombre con el mismo slug: se numera
        $this->actingAs($this->admin)->post('/lineas-de-servicio', ['nombre' => 'Aseo general!', 'icono' => 'aseo'])->assertSessionHasNoErrors();
        $this->assertSame('aseo-general-2', LineaServicio::where('nombre', 'Aseo general!')->value('slug'));

        // Al cambiarle el nombre, la dirección de su página se conserva
        $this->actingAs($this->admin)->put("/lineas-de-servicio/{$this->aseo->id}", ['nombre' => 'Aseo y desinfección', 'descripcion' => '', 'icono' => 'brillo'])
            ->assertSessionHasNoErrors();
        $this->assertSame(['aseo-general', 'Aseo y desinfección', null, 'brillo'], [
            $this->aseo->fresh()->slug, $this->aseo->fresh()->nombre, $this->aseo->fresh()->descripcion, $this->aseo->fresh()->icono,
        ]);
    }

    public function test_valida_el_nombre_y_el_icono(): void
    {
        $this->actingAs($this->admin)->post('/lineas-de-servicio', ['nombre' => ' ', 'descripcion' => str_repeat('a', 301), 'icono' => 'cohete'])
            ->assertSessionHasErrors(['nombre', 'descripcion', 'icono' => 'Elige uno de los íconos de la lista.']);
        $this->actingAs($this->admin)->post('/lineas-de-servicio', ['nombre' => 'Vigilancia'])
            ->assertSessionHasErrors(['icono' => 'Elige un ícono para la línea.']);
        $this->assertSame(8, LineaServicio::count());
    }

    public function test_la_linea_con_tablero_no_se_desactiva(): void
    {
        $logistica = LineaServicio::logistica();

        $this->actingAs($this->admin)->patch("/lineas-de-servicio/{$logistica->id}/estado", ['activo' => false])->assertSessionHas('error');

        $this->assertTrue($logistica->fresh()->activa);
    }

    public function test_no_se_desactiva_mientras_alguien_trabaja_o_empezara_en_ella(): void
    {
        $ana = User::factory()->create(['linea_servicio_id' => null]);
        $this->asignar($ana, $this->aseo, ['fecha_inicio' => '2026-11-01']);

        $this->actingAs($this->admin)->patch("/lineas-de-servicio/{$this->aseo->id}/estado", ['activo' => false])
            ->assertSessionHas('error', 'No puedes desactivar Aseo general: 1 persona tiene asignaciones vigentes o por empezar en ella. Termínalas primero en Asignaciones.');
        $this->assertTrue($this->aseo->fresh()->activa);

        // Terminada, ya se puede
        $ana->asignaciones()->update(['fecha_inicio' => '2026-09-01', 'fecha_fin' => '2026-10-20', 'duracion' => 'fechas']);
        $this->actingAs($this->admin)->patch("/lineas-de-servicio/{$this->aseo->id}/estado", ['activo' => false])->assertSessionHas('success');
        $this->assertFalse($this->aseo->fresh()->activa);
    }

    public function test_una_linea_inactiva_no_se_ofrece_ni_se_asigna(): void
    {
        $recibe = $this->empresa();
        $recibe->lineas()->attach($this->aseo);
        $this->aseo->update(['activa' => false]);
        $ana = User::factory()->create(['linea_servicio_id' => null]);

        // Fuera del panel
        $this->actingAs($this->admin)->get('/panel')->assertInertia(fn (Assert $p) => $p->has('lineas', 6));

        // No se asigna
        $this->actingAs($this->admin)->post('/asignaciones', [
            'usuario_id' => $ana->id, 'empresa_id' => '', 'lineas' => [$this->aseo->id], 'fecha_inicio' => '2026-10-21', 'duracion' => 'indefinida',
        ])->assertSessionHasErrors(['lineas' => '«Aseo general» está inactiva: actívala en Líneas de servicio antes de asignarla.']);

        // No se le agrega a otra empresa, pero la que ya la recibe la conserva
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Sodimac', 'lineas' => [$this->aseo->id]])
            ->assertSessionHasErrors(['lineas' => '«Aseo general» está inactiva: actívala en Líneas de servicio antes de marcarla.']);
        $this->actingAs($this->admin)->put("/empresas/{$recibe->id}", ['nombre' => 'Ditransa', 'lineas' => [LineaServicio::logistica()->id, $this->aseo->id]])
            ->assertSessionHasNoErrors();
        $this->assertTrue($recibe->lineas()->whereKey($this->aseo->id)->exists());
        $this->assertFalse(Empresa::where('nombre', 'Sodimac')->exists());
    }

    public function test_cada_accion_pide_su_permiso(): void
    {
        $rol = RolUsuario::create(['nombre' => 'Consulta', 'permisos' => ['servicios.ver'], 'alcance' => Permisos::ALCANCE_TODO, 'activo' => true]);
        $consulta = User::factory()->create(['rol_id' => $rol->id]);
        $sinPermiso = User::factory()->coordinador()->create();

        $this->actingAs($sinPermiso)->get('/lineas-de-servicio')->assertForbidden();
        $this->actingAs($consulta)->get('/lineas-de-servicio')->assertOk();
        $this->actingAs($consulta)->post('/lineas-de-servicio', ['nombre' => 'Vigilancia', 'icono' => 'seguridad'])->assertForbidden();
        $this->actingAs($consulta)->put("/lineas-de-servicio/{$this->aseo->id}", ['nombre' => 'Otra', 'icono' => 'aseo'])->assertForbidden();
        $this->actingAs($consulta)->patch("/lineas-de-servicio/{$this->aseo->id}/estado", ['activo' => false])->assertForbidden();
        $this->assertSame(8, LineaServicio::count());
        $this->assertTrue($this->aseo->fresh()->activa);
    }
}
