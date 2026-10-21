<?php

namespace Tests\Feature;

use App\Enums\EstadoOrden;
use App\Enums\Rol;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\Sucursal;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LineasServicioTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private LineaServicio $logistica;

    private LineaServicio $aseo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->logistica = LineaServicio::logistica();
        $this->aseo = LineaServicio::where('slug', 'aseo-general')->sole();
    }

    /** Crea órdenes aprobadas de una sede (y sucursal, si se indica) para el tablero de logística. */
    private function ordenes(Sede $sede, int $cuantas, ?Sucursal $sucursal = null): void
    {
        static $n = 0;
        $carga = Carga::create(['archivo_nombre' => "c{$n}.xlsx", 'archivo_path' => 'c', 'archivo_hash' => str_pad((string) $n, 64, 'a')]);
        $auxiliar = User::factory()->sinAcceso()->create(['cedula' => (string) (1000 + $n), 'nombres' => 'Auxiliar', 'primer_apellido' => (string) $n, 'linea_servicio_id' => null]);
        foreach (range(1, $cuantas) as $i) {
            Orden::create([
                'carga_id' => $carga->id,
                'fecha_operacion' => '2026-10-02',
                'sede_id' => $sede->id,
                'sucursal_id' => $sucursal?->id,
                'auxiliar_id' => $auxiliar->id,
                'codigo_orden' => "O{$n}-{$i}",
                'estado' => EstadoOrden::Aprobada,
            ]);
        }
        $n++;
    }

    // --- Entrada a las líneas ----------------------------------------------------------

    public function test_el_panel_del_administrador_lista_las_ocho_lineas_con_sus_conteos(): void
    {
        $ditranza = $this->empresa();
        $ditranza->lineas()->attach($this->aseo);
        Empresa::create(['nombre' => 'Inactiva', 'activo' => false])->lineas()->attach($this->aseo);
        User::factory()->coordinador()->create();

        $this->actingAs($this->admin)->get('/panel')
            ->assertInertia(fn (Assert $p) => $p->has('lineas', 8)
                ->where('lineas.0.slug', 'logisticos')
                ->where('lineas.0.tablero', true)
                ->where('lineas.0.empresas', 1)
                ->where('lineas.0.personas', 1)
                ->where('lineas.2.slug', 'aseo-general')
                ->where('lineas.2.tablero', false)
                ->where('lineas.2.empresas', 1));
    }

    public function test_quien_no_es_administrador_entra_directo_a_su_linea(): void
    {
        $coordinador = User::factory()->coordinador()->create(['linea_servicio_id' => $this->aseo->id]);

        $this->post('/login', ['email' => $coordinador->email, 'password' => 'password'])->assertRedirect('/panel');
        $this->get('/panel')->assertRedirect('/lineas/aseo-general');
        $this->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p->component('lineas/linea')
            ->where('auth.user.inicio.url', '/lineas/aseo-general')
            ->where('auth.user.lineas', [['slug' => 'aseo-general', 'nombre' => $this->aseo->nombre]]));
    }

    public function test_cada_quien_solo_entra_a_su_linea_y_el_administrador_a_todas(): void
    {
        $deAseo = User::factory()->coordinador()->create(['linea_servicio_id' => $this->aseo->id]);

        $this->actingAs($deAseo)->get('/lineas/logisticos')->assertForbidden();
        // Las herramientas de Drivin son de la línea logística
        $this->actingAs($deAseo)->get('/cargas')->assertForbidden();
        $this->actingAs($deAseo)->get('/auditoria')->assertForbidden();
        $this->actingAs($deAseo)->get('/lineas/aseo-general')->assertOk();

        foreach (LineaServicio::pluck('slug') as $slug) {
            $this->actingAs($this->admin)->get("/lineas/{$slug}")->assertOk();
        }
        $this->actingAs($this->admin)->get('/lineas/no-existe')->assertNotFound();
    }

    public function test_la_direccion_anterior_de_indicadores_lleva_a_la_linea_logistica(): void
    {
        $this->actingAs($this->admin)->get('/indicadores')->assertRedirect('/lineas/logisticos');
    }

    public function test_una_linea_sin_tablero_muestra_sus_empresas_y_su_personal(): void
    {
        $empresa = Empresa::create(['nombre' => 'Bodegas del Valle']);
        $empresa->lineas()->attach($this->aseo);
        $planta = $this->sede('Planta Yumbo', [], $empresa);
        $planta->sucursales()->create(['nombre' => 'Bodega 1', 'ciudad' => 'Yumbo']);
        $planta->sucursales()->create(['nombre' => 'Cerrada', 'ciudad' => 'Cali', 'activo' => false]);
        $this->sede('Inactiva', ['activo' => false], $empresa);
        User::factory()->coordinador()->create(['linea_servicio_id' => $this->aseo->id, 'empresa_id' => $empresa->id]);
        User::factory()->count(2)->create(['linea_servicio_id' => $this->aseo->id]);
        User::factory()->create(['linea_servicio_id' => $this->aseo->id, 'activo' => false]);
        // Una empresa que no recibe la línea no aparece
        $this->empresa('Solo logística');

        $this->actingAs($this->admin)->get('/lineas/aseo-general')
            ->assertInertia(fn (Assert $p) => $p->component('lineas/linea')
                ->where('puedeEmpresas', true)
                ->where('puedeUsuarios', true)
                ->has('empresas', 1)
                ->where('empresas.0.nombre', 'Bodegas del Valle')
                ->where('empresas.0.sedes', 1)
                ->where('empresas.0.sucursales', 1)
                ->where('empresas.0.personas', 1)
                // Por rol de la empresa, de más a menos personas
                ->where('personal', [['rol' => 'Auxiliar operativo', 'total' => 2], ['rol' => 'Coordinador / Supervisor', 'total' => 1]]));
    }

    // --- Tablero de logística por sede -------------------------------------------------

    public function test_el_tablero_de_la_linea_solo_cuenta_las_sedes_de_empresas_que_la_reciben(): void
    {
        $tugo = $this->sede('TuGo');
        $sodimac = $this->sede('Sodimac');
        $ajena = $this->sede('Sin logística', [], Empresa::create(['nombre' => 'Sin la línea']));
        $this->ordenes($tugo, 3);
        $this->ordenes($sodimac, 2);
        $this->ordenes($ajena, 7);

        $this->actingAs($this->admin)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->has('sedes', 2)->where('sedes.0.empresa', 'Ditranza')->where('kpis.asignadas', 5)->where('filtros.sede', null));

        // Se filtra por una sede de la línea; una ajena se ignora
        $this->actingAs($this->admin)->get("/lineas/logisticos?sede={$sodimac->id}")
            ->assertInertia(fn (Assert $p) => $p->where('kpis.asignadas', 2)->where('filtros.sede', $sodimac->id));
        $this->actingAs($this->admin)->get("/lineas/logisticos?sede={$ajena->id}")
            ->assertInertia(fn (Assert $p) => $p->where('kpis.asignadas', 5)->where('filtros.sede', null));
    }

    public function test_quien_esta_asignado_a_una_sede_o_sucursal_solo_ve_la_suya(): void
    {
        $tugo = $this->sede('TuGo');
        $sodimac = $this->sede('Sodimac');
        $caliSur = $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $caliNorte = $tugo->sucursales()->create(['nombre' => 'Cali Norte', 'ciudad' => 'Cali']);
        $this->ordenes($tugo, 3, $caliSur);
        $this->ordenes($tugo, 4, $caliNorte);
        $this->ordenes($sodimac, 2);

        // Asignado a la empresa: ve sus dos sedes
        $deEmpresa = User::factory()->coordinador()->create(['empresa_id' => $tugo->empresa_id]);
        $this->actingAs($deEmpresa)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->has('sedes', 2)->where('kpis.asignadas', 9)->where('alcanceFijo', 'Ditranza'));

        // Asignado a la sede: aunque pida la otra, sigue viendo solo la suya
        $deSede = User::factory()->coordinador()->create(['empresa_id' => $tugo->empresa_id, 'sede_id' => $tugo->id]);
        $this->actingAs($deSede)->get("/lineas/logisticos?sede={$sodimac->id}")
            ->assertInertia(fn (Assert $p) => $p->has('sedes', 1)->where('filtros.sede', $tugo->id)->where('kpis.asignadas', 7)->where('alcanceFijo', 'Ditranza · TuGo'));

        // Asignado a la sucursal: solo su sucursal
        $deSucursal = User::factory()->coordinador()->create(['empresa_id' => $tugo->empresa_id, 'sede_id' => $tugo->id, 'sucursal_id' => $caliSur->id]);
        $this->actingAs($deSucursal)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->where('kpis.asignadas', 3)->where('alcanceFijo', 'Ditranza · TuGo · Cali Sur')->where('auth.permisos', fn ($permisos) => ! collect($permisos)->contains('cargas.ver')));
    }

    public function test_con_alcance_fijo_no_se_ven_acciones_ni_cargas_de_otras_operaciones(): void
    {
        $tugo = $this->sede('TuGo');
        $this->ordenes($tugo, 2);
        $ajeno = User::factory()->sinAcceso()->create(['cedula' => '999', 'nombres' => 'Ajeno', 'primer_apellido' => 'A Ditranza', 'linea_servicio_id' => null]);
        AccionDesempeno::create(['user_id' => $ajeno->id, 'fecha' => '2026-10-02', 'tipo' => TipoAccion::LlamadoAtencion, 'descripcion' => 'Llegó tarde a otra operación']);

        $deDitranza = User::factory()->coordinador()->create(['empresa_id' => $tugo->empresa_id]);
        $this->actingAs($deDitranza)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->has('acciones', 0)->where('pendientes.ultimaCarga', null));

        // El personal propio sí ve las acciones generales y la última carga
        $this->actingAs(User::factory()->coordinador()->create())->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->has('acciones', 1)->whereNot('pendientes.ultimaCarga', null));
    }

    public function test_el_personal_propio_con_sucursal_propia_ve_toda_la_linea(): void
    {
        $this->ordenes($this->sede('TuGo'), 4);
        $oficina = Sucursal::create(['sede_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);
        $coordinador = User::factory()->coordinador()->create(['sucursal_id' => $oficina->id]);

        // La sucursal propia es su ubicación, no un filtro de la operación
        $this->actingAs($coordinador)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->where('kpis.asignadas', 4)->where('alcanceFijo', null)->where('auth.permisos', fn ($permisos) => collect($permisos)->contains('cargas.ver')));
    }

    public function test_una_sede_desactivada_conserva_su_historial_en_el_tablero(): void
    {
        $tugo = $this->sede('TuGo');
        $sodimac = $this->sede('Sodimac', ['activo' => false]);
        $this->ordenes($tugo, 3);
        $this->ordenes($sodimac, 2);

        // Sus entregas siguen sumando, pero ya no se ofrece en el selector
        $this->actingAs($this->admin)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->where('kpis.asignadas', 5)->has('sedes', 1)->where('sedes.0.nombre', 'TuGo'));
    }

    // --- Empresas: líneas que reciben --------------------------------------------------

    public function test_la_empresa_guarda_las_lineas_que_recibe(): void
    {
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Ditranza', 'lineas' => [$this->logistica->id, $this->aseo->id]])
            ->assertSessionHasNoErrors();
        $empresa = Empresa::sole();
        $this->assertEqualsCanonicalizing([$this->logistica->id, $this->aseo->id], $empresa->lineas()->pluck('lineas_servicio.id')->all());

        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Ditranza', 'lineas' => [$this->aseo->id]])
            ->assertSessionHasNoErrors();
        $this->assertSame([$this->aseo->id], $empresa->lineas()->pluck('lineas_servicio.id')->all());

        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Otra', 'lineas' => [999]])->assertSessionHasErrors('lineas.0');

        $this->actingAs($this->admin)->get('/empresas')
            ->assertInertia(fn (Assert $p) => $p->has('lineas', 8)->where('empresas.data.0.lineas', [$this->aseo->id]));
    }

    public function test_no_se_quita_una_linea_en_la_que_trabaja_personal_de_la_empresa(): void
    {
        $empresa = $this->empresa();
        $empresa->lineas()->attach($this->aseo);
        User::factory()->create(['empresa_id' => $empresa->id, 'linea_servicio_id' => $this->aseo->id]);

        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Ditranza', 'lineas' => [$this->logistica->id]])
            ->assertSessionHasErrors(['lineas' => "No puedes quitar «{$this->aseo->nombre}»: 1 persona está asignada a esta empresa en esa línea."]);
        $this->assertSame(2, $empresa->lineas()->count());

        // La que no tiene personal sí se puede quitar
        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Ditranza', 'lineas' => [$this->aseo->id]])
            ->assertSessionHasNoErrors();
    }

    public function test_no_se_quita_la_linea_con_tablero_a_una_empresa_con_operacion(): void
    {
        $empresa = $this->empresa();
        $this->ordenes($this->sede('TuGo', [], $empresa), 1);

        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Ditranza', 'lineas' => []])
            ->assertSessionHasErrors(['lineas' => "No puedes quitar «{$this->logistica->nombre}»: las sedes de esta empresa ya tienen operación registrada en esa línea."]);
        $this->assertSame(1, $empresa->lineas()->count());
    }

    // --- Usuarios: su línea ------------------------------------------------------------

    public function test_filtra_usuarios_por_linea(): void
    {
        User::factory()->create(['name' => 'De aseo', 'linea_servicio_id' => $this->aseo->id]);
        User::factory()->create(['name' => 'De logística']);

        $this->actingAs($this->admin)->get("/usuarios?linea={$this->aseo->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 1)
                ->where('usuarios.data.0.nombre', 'De aseo')
                ->where('usuarios.data.0.asignaciones.0.lineas', [$this->aseo->nombre])
                ->where('filtros.linea', (string) $this->aseo->id));
    }
}
