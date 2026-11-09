<?php

namespace Tests\Feature;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Models\AuditoriaPod;
use App\Models\Carga;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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
                // Arriba, solo su propia jornada: ni cargas, ni auditoría, ni informes de la sede
                ->where('dia.jornada.propia', true)
                ->where('dia.jornada.fecha', '2026-10-02')
                ->where('dia.cargas', null)
                ->where('dia.porAuditar', null)
                ->where('dia.informes', null)
            );
    }

    public function test_arriba_va_el_dia_de_la_linea_con_lo_que_falta_por_cerrar()
    {
        $this->travelTo(Carbon::parse('2026-11-06 08:00'));
        $coordinador = User::factory()->coordinador()->create();
        $informe = app(ConsolidadorInforme::class)->consolidar('2026-10-02', $this->sede->id, null);
        // Una de las 6 aprobadas ya tiene su auditoría
        AuditoriaPod::create(['orden_id' => Orden::where('codigo_orden', 'PDVT1')->value('id'), 'foto_fachada' => true, 'fotos_sellado' => 4, 'fotos_destapado' => 4, 'foto_remesa' => true, 'auditado_en' => now()]);

        $this->actingAs($coordinador)->get('/lineas/logisticos?periodo=7')->assertInertia(fn (Assert $page) => $page
            // El día no depende del periodo elegido: la jornada del 2 de octubre tiene 35 días y lo dice
            ->where('dia.jornada.fecha', '2026-10-02')
            ->where('dia.jornada.dias', 35)
            ->where('dia.jornada.reciente', false)
            ->where('dia.porAuditar', ['ordenes' => 5, 'href' => '/auditoria?fecha=2026-10-02'])
            ->where('dia.informes', ['sinCerrar' => 1, 'desde' => '2026-10-02', 'href' => '/informes?fecha=2026-10-02'])
            // Las entregas son productos; las órdenes, los pedidos que los traen (aquí, uno por orden)
            ->where('kpis.asignadas', 9)
            ->where('kpis.ordenes', 9)
        );

        // Con el informe cerrado ya no hay nada por auditar ni por cerrar
        $informe->update(['estado' => EstadoInforme::Cerrado]);
        $this->get('/lineas/logisticos')->assertInertia(fn (Assert $page) => $page
            ->where('dia.porAuditar.ordenes', 0)
            ->where('dia.informes.sinCerrar', 0)
        );
    }

    public function test_la_antiguedad_de_la_jornada_se_cuenta_con_la_fecha_de_colombia()
    {
        app(ConsolidadorInforme::class)->consolidar('2026-10-02', $this->sede->id, null);
        $coordinador = User::factory()->coordinador()->create();

        // Sábado 3 de octubre, 8 p. m. en Colombia (ya domingo 4 en UTC): la jornada del viernes es la de ayer
        $this->travelTo(Carbon::parse('2026-10-04 01:00:00', 'UTC'));
        $this->actingAs($coordinador)->get('/lineas/logisticos')->assertInertia(fn (Assert $page) => $page
            ->where('dia.jornada.dias', 1)
            ->where('dia.jornada.reciente', true)
            // El informe del día anterior ya cuenta como sin cerrar; el de "hoy" no existe todavía
            ->where('dia.informes.sinCerrar', 1)
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
