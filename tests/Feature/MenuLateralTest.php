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
            // Arriba, solo lo general, lo crítico primero (lo de cada línea va en su tarjeta)
            ->where('pendientes', function ($pendientes) {
                $avisos = collect($pendientes)->keyBy('clave');

                // El administrador (ve todo) no cuenta como "sin asignación"
                return $avisos['sin-asignacion']['texto'] === '1 persona activa sin asignación'
                    && $avisos['sin-asignacion']['href'] === '/asignaciones?estado=sin'
                    && $avisos['terminan']['texto'] === '1 asignación termina esta semana'
                    // Las líneas sin empresa, en un solo aviso para quien las configura (sin enlace: "Empresas" está en el menú)
                    && $avisos['sin-empresa']['href'] === null
                    && ! $avisos->has('cargas') && ! $avisos->has('novedades-aseo-general')
                    && collect($pendientes)->pluck('nivel')->all() === collect($pendientes)->pluck('nivel')->sortBy(fn ($n) => ['critical' => 0, 'warning' => 1, 'info' => 2][$n])->values()->all();
            })
            // Logística: sus cargas por confirmar en su tarjeta
            ->where('lineas.0.cargas', ['porConfirmar' => 1, 'href' => '/cargas'])
            ->where('lineas.0.hoy', null)
            // Aseo: la programación de hoy (sin programar) y su novedad grave, cada una con su enlace
            ->where('lineas.2.slug', 'aseo-general')
            ->where('lineas.2.hoy.lugares', 0)
            ->where('lineas.2.hoy.href', '/lineas/aseo-general/programacion')
            ->where('lineas.2.novedades', ['sinCerrar' => 1, 'graves' => 1, 'href' => '/lineas/aseo-general/novedades']));

        // Los avisos llevan a listas que cuentan lo mismo
        $this->get('/asignaciones?estado=sin')->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('resumen.sinAsignacion', 1));
        $this->get('/asignaciones?estado=terminan')->assertInertia(fn (Assert $p) => $p->has('personas.data', 1)->where('personas.data.0.id', $termina->id));
    }

    public function test_quien_ve_solo_lo_suyo_ve_su_propia_jornada_en_el_inicio(): void
    {
        // Un auxiliar en dos líneas llega al inicio: la tarjeta de logística muestra sus entregas, no las de su sede
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $auxiliar = User::factory()->create(['cedula' => '1144203579', 'rol_id' => $this->rolConTablero()->id]);
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
            ->where('lineas.0.jornada.href', '/mis-entregas?fecha=2026-10-02')
            // Ve solo lo suyo: sin los informes de la sede
            ->where('lineas.0.informes', null)
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
            ->where('lineas.0.jornada.href', '/informes?fecha=2026-10-02'));
    }

    public function test_el_inicio_dice_cuando_la_ultima_jornada_no_es_de_ayer(): void
    {
        $admin = User::factory()->admin()->create();
        $tugo = $this->sede('TuGo');
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('d', 64)]);
        $auxiliar = User::factory()->create(['cedula' => '1000']);
        $this->travelTo(Carbon::parse('2026-11-06 08:00'));
        foreach (['2026-10-02', '2026-11-05'] as $i => $dia) {
            Orden::create(['carga_id' => $carga->id, 'fecha_operacion' => $dia, 'sede_id' => $tugo->id, 'auxiliar_id' => $auxiliar->id, 'codigo_orden' => "J{$i}", 'estado' => 'aprobada']);
        }
        app(ConsolidadorInforme::class)->consolidarFecha(Carbon::parse('2026-10-02'));

        // Solo la del 2 de octubre: 35 días sin carga, y su informe es el más antiguo sin cerrar
        $this->actingAs($admin)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->where('lineas.0.jornada.fecha', '2026-10-02')
            ->where('lineas.0.jornada.dias', 35)
            ->where('lineas.0.jornada.reciente', false)
            ->where('lineas.0.informes', ['sinCerrar' => 1, 'desde' => '2026-10-02', 'href' => '/informes?fecha=2026-10-02']));

        // Con la de ayer cargada, está al día
        app(ConsolidadorInforme::class)->consolidarFecha(Carbon::parse('2026-11-05'));
        $this->get('/panel')->assertInertia(fn (Assert $p) => $p->where('lineas.0.jornada.dias', 1)->where('lineas.0.jornada.reciente', true));
    }
}
