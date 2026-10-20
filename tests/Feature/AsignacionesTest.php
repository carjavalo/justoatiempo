<?php

namespace Tests\Feature;

use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Asignaciones: dónde presta el servicio cada persona (una o varias empresas, con su sede y su sucursal), qué
 * líneas hace allí y por cuánto tiempo. De ellas salen sus líneas, lo que ve de la operación y su carnet.
 */
class AsignacionesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private LineaServicio $logistica;

    private LineaServicio $aseo;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-21 09:00:00');
        $this->admin = User::factory()->admin()->create();
        $this->logistica = LineaServicio::logistica();
        $this->aseo = LineaServicio::where('slug', 'aseo-general')->sole();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function persona(): User
    {
        return User::factory()->create(['linea_servicio_id' => null]);
    }

    /** Lo que envía el formulario. */
    private function datos(?User $persona, array $extra = []): array
    {
        return [
            ...($persona ? ['usuario_id' => $persona->id] : []),
            'empresa_id' => '', 'sede_id' => '', 'sucursal_id' => '', 'lineas' => [$this->logistica->id],
            'fecha_inicio' => '2026-10-21', 'duracion' => 'indefinida', 'duracion_cantidad' => '', 'fecha_fin' => '', ...$extra,
        ];
    }

    public function test_asigna_a_una_empresa_con_sus_lineas_y_su_periodo(): void
    {
        $tugo = $this->sede('TuGo');
        $tugo->empresa->lineas()->attach($this->aseo);
        $caliSur = $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $ana = $this->persona();

        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, [
            'empresa_id' => $tugo->empresa_id, 'sede_id' => $tugo->id, 'sucursal_id' => $caliSur->id,
            'lineas' => [$this->logistica->id, $this->aseo->id], 'duracion' => 'meses', 'duracion_cantidad' => 3,
        ]))->assertSessionHasNoErrors()->assertSessionHas('success');

        $a = $ana->asignaciones()->with('lineas')->sole();
        $this->assertSame([$tugo->empresa_id, $tugo->id, $caliSur->id], [$a->empresa_id, $a->sede_id, $a->sucursal_id]);
        // Por 3 meses contando el día de inicio
        $this->assertSame(['2026-10-21', '2027-01-20', 'meses', 3], [$a->fecha_inicio->toDateString(), $a->fecha_fin->toDateString(), $a->duracion, $a->duracion_cantidad]);
        $this->assertSame([$this->logistica->id, $this->aseo->id], $a->lineas->pluck('id')->all());
        $this->assertSame('vigente', $a->estado());

        // De ella salen sus líneas y su carnet
        $this->assertSame([$this->logistica->id, $this->aseo->id], $ana->fresh()->lineasIds());
        $this->actingAs($this->admin)->get("/usuarios/{$ana->id}/carnet")->assertInertia(fn (Assert $p) => $p
            ->where('persona.asignaciones.0.empresa', 'Ditranza')
            ->where('persona.asignaciones.0.sucursal', 'Cali Sur')
            ->where('persona.asignaciones.0.lineas', [$this->logistica->nombre, $this->aseo->nombre])
            ->where('persona.asignaciones.0.hasta', '2027-01-20'));
    }

    public function test_se_asigna_cualquier_linea_y_la_empresa_pasa_a_recibirla(): void
    {
        $empresa = $this->empresa();
        $ana = $this->persona();
        $this->assertFalse($empresa->lineas()->whereKey($this->aseo->id)->exists());

        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $empresa->id, 'lineas' => [$this->aseo->id]]))
            ->assertSessionHasNoErrors();

        // Desde ahora Ditranza recibe aseo general: aparece en esa línea, con su personal
        $this->assertTrue($empresa->lineas()->whereKey($this->aseo->id)->exists());
        $this->actingAs($this->admin)->get('/lineas/aseo-general')
            ->assertInertia(fn (Assert $p) => $p->where('empresas.0.nombre', 'Ditranza')->where('empresas.0.personas', 1));
    }

    public function test_calcula_el_fin_segun_la_duracion(): void
    {
        $inicio = Carbon::parse('2026-01-31');
        $this->assertNull(Asignacion::calcularFin($inicio, 'indefinida', null, null));
        $this->assertSame('2026-02-14', Asignacion::calcularFin($inicio, 'dias', 15, null)->toDateString());
        $this->assertSame('2026-02-13', Asignacion::calcularFin($inicio, 'semanas', 2, null)->toDateString());
        // Un mes desde el 31 de enero: sin desbordar a marzo
        $this->assertSame('2026-02-27', Asignacion::calcularFin($inicio, 'meses', 1, null)->toDateString());
        $this->assertSame('2026-03-10', Asignacion::calcularFin($inicio, 'fechas', null, Carbon::parse('2026-03-10'))->toDateString());
    }

    public function test_valida_el_lugar_las_lineas_y_el_periodo(): void
    {
        $tugo = $this->sede('TuGo');
        $caliSur = $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $otra = $this->empresa('Logística Sur');
        $falabella = $this->sede('Falabella', [], $otra);
        $oficina = Sucursal::create(['sede_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);
        $ana = $this->persona();

        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['lineas' => []]))
            ->assertSessionHasErrors(['lineas' => 'Elige al menos una línea de servicio: lo que hará allí.']);
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'sede_id' => $falabella->id]))
            ->assertSessionHasErrors(['sede_id' => 'Esta sede no pertenece a la empresa elegida.']);
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'sucursal_id' => $caliSur->id]))
            ->assertSessionHasErrors(['sucursal_id' => 'Elige primero la sede de esta sucursal.']);
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'sucursal_id' => $oficina->id]))
            ->assertSessionHasErrors(['sucursal_id' => 'Esta sucursal es propia de Justo a Tiempo: solo se asigna sin empresa.']);
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['duracion' => 'dias']))
            ->assertSessionHasErrors(['duracion_cantidad' => 'Escribe cuántos.']);
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['duracion' => 'fechas', 'fecha_fin' => '2026-10-01']))
            ->assertSessionHasErrors(['fecha_fin' => 'La fecha de fin no puede ser antes de la de inicio.']);

        // Sin empresa, a toda la línea (y si se quiere, en una sucursal propia)
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['sucursal_id' => $oficina->id]))->assertSessionHasNoErrors();
        $this->assertSame([null, $oficina->id], [$ana->asignaciones()->sole()->empresa_id, $ana->asignaciones()->sole()->sucursal_id]);
    }

    public function test_no_se_repite_la_misma_asignacion_en_fechas_que_se_cruzan(): void
    {
        $tugo = $this->sede('TuGo');
        $ana = $this->persona();
        $base = ['empresa_id' => $tugo->empresa_id, 'duracion' => 'fechas', 'fecha_fin' => '2026-10-31'];

        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, $base))->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, [...$base, 'fecha_inicio' => '2026-10-25', 'fecha_fin' => '2026-11-15']))
            ->assertSessionHasErrors('lineas');
        // Después de que termine, sí
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, [...$base, 'fecha_inicio' => '2026-11-01', 'fecha_fin' => '2026-11-30']))
            ->assertSessionHasNoErrors();
        $this->assertSame(2, $ana->asignaciones()->count());
    }

    public function test_una_persona_puede_estar_en_varias_empresas(): void
    {
        $tugo = $this->sede('TuGo');
        $otra = $this->empresa('Bodegas del Valle');
        $otra->lineas()->sync([$this->aseo->id]);
        $ana = $this->persona();

        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id]))->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $otra->id, 'lineas' => [$this->aseo->id]]))->assertSessionHasNoErrors();

        $ana = $ana->fresh();
        $this->assertSame(['Ditranza', 'Bodegas del Valle'], $ana->vigentes()->map(fn ($a) => $a->empresa->nombre)->all());
        // Trabaja en dos líneas: al ingresar ve el panel con las dos
        $this->actingAs($ana)->get('/panel')->assertInertia(fn (Assert $p) => $p->has('lineas', 2));
        $this->actingAs($ana)->get('/lineas/aseo-general')->assertOk();
        $this->actingAs($ana)->get('/carnet/'.$ana->carnet_codigo)->assertInertia(fn (Assert $p) => $p->has('asignaciones', 2));
    }

    public function test_solo_las_vigentes_cuentan_hoy(): void
    {
        $tugo = $this->sede('TuGo');
        $ana = $this->persona();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'fecha_inicio' => '2026-11-01']))->assertSessionHasNoErrors();

        // Programada: aún no le da la línea ni aparece en su carnet
        $this->assertSame('programada', $ana->asignaciones()->sole()->estado());
        $this->assertSame([], $ana->fresh()->lineasIds());
        $this->actingAs($ana)->get('/lineas/logisticos')->assertForbidden();

        Carbon::setTestNow('2026-11-02 08:00:00');
        $this->assertSame([$this->logistica->id], $ana->fresh()->lineasIds());
    }

    public function test_terminar_una_asignacion(): void
    {
        $tugo = $this->sede('TuGo');
        $ana = $this->persona();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'fecha_inicio' => '2026-10-01']))->assertSessionHasNoErrors();
        $vieja = $ana->asignaciones()->sole();

        // Ya había empezado: queda terminada hasta ayer
        $this->actingAs($this->admin)->patch("/asignaciones/{$vieja->id}/terminar")->assertSessionHas('success');
        $this->assertSame(['2026-10-20', 'terminada'], [$vieja->fresh()->fecha_fin->toDateString(), $vieja->fresh()->estado()]);
        $this->assertSame([], $ana->fresh()->lineasIds());

        // Programada: se quita
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'fecha_inicio' => '2026-12-01']))->assertSessionHasNoErrors();
        $programada = $ana->asignaciones()->latest('id')->first();
        $this->actingAs($this->admin)->patch("/asignaciones/{$programada->id}/terminar")->assertSessionHas('success');
        $this->assertModelMissing($programada);
    }

    public function test_al_crear_un_usuario_se_va_a_asignarlo(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => 'Luis', 'primer_apellido' => 'Gómez', 'email' => 'luis@example.com', 'cargo' => 'Conductor',
            'rol_id' => $this->rolBase(\App\Enums\Rol::Auxiliar), 'password' => 'Clave-segura-1',
        ])->assertRedirect();
        $luis = User::where('email', 'luis@example.com')->sole();

        $this->actingAs($this->admin)->get("/asignaciones?usuario={$luis->id}&nueva=1")
            ->assertInertia(fn (Assert $p) => $p->component('asignaciones/index')
                ->has('personas.data', 1)
                ->where('personas.data.0.id', $luis->id)
                ->where('personas.data.0.asignaciones', [])
                ->where('personas.data.0.asignable', true));
    }

    public function test_la_lista_resume_y_filtra(): void
    {
        $tugo = $this->sede('TuGo');
        $ana = $this->persona();
        $luis = $this->persona();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($ana, ['empresa_id' => $tugo->empresa_id, 'duracion' => 'dias', 'duracion_cantidad' => 5]))->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/asignaciones', $this->datos($luis, ['fecha_inicio' => '2026-12-01']))->assertSessionHasNoErrors();

        $this->actingAs($this->admin)->get('/asignaciones')->assertInertia(fn (Assert $p) => $p
            ->where('resumen.vigentes', 1)
            ->where('resumen.programadas', 1)
            ->where('resumen.terminanPronto', 1)
            ->has('personas.data', 2));
        $this->actingAs($this->admin)->get('/asignaciones?estado=programadas')
            ->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('personas.data.0.id', $luis->id));
        $this->actingAs($this->admin)->get("/asignaciones?empresa={$tugo->empresa_id}")
            ->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('personas.data.0.id', $ana->id));
    }

    public function test_sin_permiso_no_se_ve_ni_se_asigna(): void
    {
        $coordinador = User::factory()->coordinador()->create();
        $ana = $this->persona();

        $this->actingAs($coordinador)->get('/asignaciones')->assertForbidden();
        $this->actingAs($coordinador)->post('/asignaciones', $this->datos($ana))->assertForbidden();
        $this->assertSame(0, $ana->asignaciones()->count());
    }
}
