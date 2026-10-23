<?php

namespace Tests\Feature;

use App\Enums\EstadoOrden;
use App\Models\AuditoriaPod;
use App\Models\Carga;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private Sede $sede;

    private User $juan;

    private User $andres;

    protected function setUp(): void
    {
        parent::setUp();

        // TuGo es sede de Ditransa, que recibe la línea logística
        $this->sede = $this->sede('TuGo');
        // Juan entra a la plataforma (ve su desempeño); Andrés es parte del personal sin acceso
        $this->juan = User::factory()->create(['cedula' => '111', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'rol_id' => $this->rolConTablero()->id]);
        $this->andres = User::factory()->sinAcceso()->create(['cedula' => '222', 'nombres' => 'Andrés', 'primer_apellido' => 'Moreno', 'linea_servicio_id' => null]);

        // Ejemplo del SRS: 8 tareas, 5 aprobadas y 3 rechazadas => 62,5 %
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('a', 64)]);
        foreach (range(1, 8) as $i) {
            Orden::create([
                'carga_id' => $carga->id,
                'fecha_operacion' => '2026-10-02',
                'sede_id' => $this->sede->id,
                'ruta' => 'CALI SUR',
                'placa' => 'SNX708',
                'auxiliar_id' => $this->juan->id,
                'codigo_orden' => "PDVT{$i}",
                'estado' => $i <= 5 ? EstadoOrden::Aprobada : EstadoOrden::Rechazada,
            ]);
        }
        Orden::create([
            'carga_id' => $carga->id,
            'fecha_operacion' => '2026-10-02',
            'sede_id' => $this->sede->id,
            'auxiliar_id' => $this->andres->id,
            'codigo_orden' => 'PDVT99',
            'estado' => EstadoOrden::Aprobada,
        ]);
    }

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/lineas/logisticos')->assertRedirect('/login');
    }

    public function test_coordinador_ve_el_panel_gerencial_con_los_kpis_del_periodo()
    {
        $this->actingAs(User::factory()->coordinador()->create());

        $this->get('/lineas/logisticos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('lineas/logistica')
                ->where('auth.permisos', fn ($permisos) => collect($permisos)->contains('cargas.ver'))
                ->where('vista', 'gerencial')
                ->where('kpis.asignadas', 9)
                ->where('kpis.aprobadas', 6)
                ->where('kpis.devoluciones', 3)
                ->has('ranking', 2)
                ->has('porSede', 1)
            );
    }

    public function test_auxiliar_solo_ve_sus_propias_entregas()
    {
        $this->actingAs($this->juan);

        $this->get('/lineas/logisticos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('vista', 'auxiliar')
                ->where('auth.permisos', fn ($permisos) => ! collect($permisos)->contains('cargas.ver'))
                ->where('kpis.asignadas', 8)
                ->where('kpis.efectividad', 62.5)
                ->has('ranking', 1)
                ->where('ranking.0.nombre', 'Juan Fernando Plaza')
                ->where('pendientes', null)
            );
    }

    public function test_los_modulos_respetan_los_roles()
    {
        $auxiliar = User::factory()->create();
        $conTablero = User::factory()->create(['rol_id' => $this->rolConTablero()->id]);
        $coordinador = User::factory()->coordinador()->create();
        $admin = User::factory()->admin()->create();

        // El auxiliar operativo base solo tiene su carnet
        $this->actingAs($auxiliar)->get('/informes')->assertForbidden();
        $this->actingAs($auxiliar)->get('/mis-entregas')->assertForbidden();
        $this->actingAs($auxiliar)->get('/panel')->assertRedirect('/mi-carnet');
        $this->actingAs($conTablero)->get('/mis-entregas')->assertOk();
        $this->actingAs($coordinador)->get('/auditoria')->assertOk();
        $this->actingAs($coordinador)->get('/vehiculos')->assertForbidden();
        $this->actingAs($admin)->get('/vehiculos')->assertOk();
        $this->actingAs(User::factory()->admin()->create(['activo' => false]))->get('/vehiculos')->assertRedirect('/login');
        // El módulo Empleados ya no existe: el personal está en Usuarios
        $this->actingAs($admin)->get('/empleados')->assertNotFound();
    }

    public function test_el_consolidador_calcula_la_linea_del_informe_y_el_protocolo()
    {
        $aprobada = Orden::where('codigo_orden', 'PDVT1')->first();
        AuditoriaPod::create([
            'orden_id' => $aprobada->id,
            'foto_fachada' => true,
            'fotos_sellado' => 4,
            'fotos_destapado' => 0,
            'foto_remesa' => true,
            'recibe_sin_destapar' => true, // RF-10
            'auditado_en' => now(),
        ]);

        $informe = app(ConsolidadorInforme::class)->consolidar('2026-10-02', $this->sede->id, null);
        $linea = $informe->lineas->firstWhere('auxiliar_id', $this->juan->id);

        $this->assertSame(9, $informe->total_asignadas);
        $this->assertSame(8, $linea->asignadas);
        $this->assertSame(5, $linea->aprobadas);
        $this->assertEquals(62.5, $linea->efectividad); // RF-06
        $this->assertSame(3, $linea->devoluciones);      // RF-07
        $this->assertSame(0, $linea->averias);           // RF-08
        $this->assertTrue($linea->pod_cumple);
    }
}
