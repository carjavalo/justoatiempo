<?php

namespace Tests\Feature;

use App\Enums\EstadoCarga;
use App\Models\Asignacion;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Orden;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** El menú lateral (según el rol) y el inicio como resumen del día: lo que pide atención y cómo va cada línea. */
class MenuLateralTest extends TestCase
{
    use RefreshDatabase;

    public function test_quien_trabaja_en_una_sola_linea_no_tiene_menu(): void
    {
        // El coordinador base trabaja en logística: entra a ella y navega por sus pestañas
        $coordinador = User::factory()->coordinador()->create();

        $this->actingAs($coordinador)->get('/panel')->assertRedirect('/lineas/logisticos');
        $this->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p->where('menu', null));
    }

    public function test_quien_trabaja_en_varias_lineas_tiene_inicio_y_sus_lineas(): void
    {
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $coordinador = User::factory()->coordinador()->create();
        Asignacion::create(['user_id' => $coordinador->id, 'fecha_inicio' => today()->subMonth(), 'duracion' => 'indefinida'])->lineas()->sync([$aseo->id]);

        $this->actingAs($coordinador)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->component('panel')
            ->where('menu.0.items.0.titulo', 'Inicio')
            ->where('menu.1.titulo', 'Operación')
            ->where('menu.1.items', fn ($items) => collect($items)->pluck('linea')->all() === ['logisticos', 'aseo-general'])
            ->has('menu', 2)
            ->has('lineas', 2));
    }

    public function test_el_menu_recuerda_si_quedo_contraido(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/usuarios')->assertInertia(fn (Assert $p) => $p->where('menuAbierto', true));
        $this->withUnencryptedCookie('menu_lateral', 'false')->get('/usuarios')->assertInertia(fn (Assert $p) => $p->where('menuAbierto', false));
    }

    public function test_el_inicio_avisa_lo_que_pide_atencion(): void
    {
        $admin = User::factory()->admin()->create();
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $empresa = Empresa::create(['nombre' => 'Bodegas del Valle']);
        $empresa->lineas()->attach($aseo);

        // Una carga en revisión, una novedad grave sin cerrar, una persona sin asignación y una que termina pronto
        Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('a', 64), 'estado' => EstadoCarga::EnRevision]);
        NovedadLinea::create(['linea_servicio_id' => $aseo->id, 'fecha' => today(), 'empresa_id' => $empresa->id, 'tipo' => 'Queja del cliente', 'gravedad' => 'grave', 'descripcion' => 'Baños sin aseo.', 'estado' => 'abierta']);
        User::factory()->sinAcceso()->create(['cedula' => '1001', 'linea_servicio_id' => null]);
        $termina = User::factory()->sinAcceso()->create(['cedula' => '1002', 'linea_servicio_id' => null]);
        Asignacion::create(['user_id' => $termina->id, 'empresa_id' => $empresa->id, 'fecha_inicio' => today()->subMonth(), 'fecha_fin' => today()->addDays(3), 'duracion' => 'fechas'])->lineas()->sync([$aseo->id]);

        $this->actingAs($admin)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->where('pendientes', function ($pendientes) {
                $avisos = collect($pendientes)->keyBy('clave');

                return $avisos['cargas']['texto'] === '1 carga de Drivin por confirmar'
                    && $avisos['novedades-aseo-general']['texto'] === 'Aseo general: 1 novedad sin cerrar'
                    && $avisos['novedades-aseo-general']['nivel'] === 'critical'
                    // El administrador (ve todo) no cuenta como "sin asignación"
                    && $avisos['sin-asignacion']['texto'] === '1 persona activa sin asignación'
                    && $avisos['sin-asignacion']['href'] === '/asignaciones?estado=sin'
                    && $avisos['terminan']['texto'] === '1 asignación termina esta semana';
            })
            // Aseo: la cobertura de hoy (sin programación) en su tarjeta, que lleva a la programación de hoy
            ->where('lineas.2.slug', 'aseo-general')
            ->where('lineas.2.hoy.lugares', 0)
            ->where('lineas.2.enlace.href', '/lineas/aseo-general/programacion')
            ->where('lineas.0.hoy', null));

        // Los avisos llevan a listas que cuentan lo mismo
        $this->get('/asignaciones?estado=sin')->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('resumen.sinAsignacion', 1));
        $this->get('/asignaciones?estado=terminan')->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('personas.data.0.id', $termina->id));
    }

    public function test_quien_ve_solo_lo_suyo_ve_su_propia_jornada_en_el_inicio(): void
    {
        // Un auxiliar en dos líneas llega al inicio: la tarjeta de logística muestra sus entregas, no las de su sede
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $auxiliar = User::factory()->create(['cedula' => '1144203579']);
        Asignacion::create(['user_id' => $auxiliar->id, 'fecha_inicio' => today()->subMonth(), 'duracion' => 'indefinida'])->lineas()->sync([$aseo->id]);
        $tugo = $this->sede('TuGo');
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('b', 64)]);
        $otro = User::factory()->create(['cedula' => '1111750549']);
        foreach ([[$auxiliar, 'aprobada'], [$auxiliar, 'rechazada'], [$otro, 'aprobada'], [$otro, 'aprobada']] as $i => [$quien, $estado]) {
            Orden::create(['carga_id' => $carga->id, 'fecha_operacion' => '2026-10-02', 'sede_id' => $tugo->id, 'auxiliar_id' => $quien->id, 'codigo_orden' => "O{$i}", 'estado' => $estado]);
        }
        app(ConsolidadorInforme::class)->consolidarFecha(Carbon::parse('2026-10-02'));

        $this->actingAs($auxiliar)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->where('lineas.0.jornada.propia', true)
            ->where('lineas.0.jornada.asignadas', 2)
            ->where('lineas.0.jornada.efectividad', 50)
            ->where('lineas.0.enlace.href', '/mis-entregas?fecha=2026-10-02')
            // Solo lo suyo: sin avisos de otros
            ->where('pendientes', []));
    }

    public function test_la_meta_de_la_ultima_jornada_pesa_por_las_entregas_de_cada_sede(): void
    {
        $admin = User::factory()->admin()->create();
        $tugo = $this->sede('TuGo', ['meta_efectividad' => 95]);
        $this->sede('Sodimac', ['meta_efectividad' => 85]);
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('c', 64)]);
        $auxiliar = User::factory()->create(['cedula' => '1000']);
        foreach (range(1, 4) as $i) {
            Orden::create(['carga_id' => $carga->id, 'fecha_operacion' => '2026-10-02', 'sede_id' => $tugo->id, 'auxiliar_id' => $auxiliar->id, 'codigo_orden' => "T{$i}", 'estado' => 'aprobada']);
        }
        app(ConsolidadorInforme::class)->consolidarFecha(Carbon::parse('2026-10-02'));

        // Sodimac no operó ese día: la meta es la de TuGo (no el promedio 90)
        $this->actingAs($admin)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->where('lineas.0.jornada.meta', 95)
            ->where('lineas.0.enlace.href', '/informes?fecha=2026-10-02'));
    }
}
