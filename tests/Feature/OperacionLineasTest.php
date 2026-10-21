<?php

namespace Tests\Feature;

use App\Enums\EstadoAsistencia;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\NovedadLinea;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Models\Sede;
use App\Models\User;
use App\Support\OperacionLinea;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * La operación diaria de las líneas sin Drivin (aseo, en estas pruebas): programación por lugar, asistencia, novedades
 * con su seguimiento, el informe diario y su Excel, cada uno dentro de lo que ve quien lo usa.
 */
class OperacionLineasTest extends TestCase
{
    use RefreshDatabase;

    private LineaServicio $aseo;

    private Empresa $bodegas;

    private Sede $planta;

    private User $coordinador;

    private User $ana;

    private User $luis;

    protected function setUp(): void
    {
        parent::setUp();
        $this->aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $this->bodegas = Empresa::create(['nombre' => 'Bodegas del Valle']);
        $this->bodegas->lineas()->attach($this->aseo);
        $this->planta = $this->sede('Planta Yumbo', [], $this->bodegas);
        // Quien coordina el aseo de Bodegas y dos operarias asignadas allí
        $this->coordinador = User::factory()->coordinador()->create(['linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id]);
        $this->ana = User::factory()->sinAcceso()->create(['name' => 'Ana Ríos', 'cedula' => '1001', 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id]);
        $this->luis = User::factory()->sinAcceso()->create(['name' => 'Luis Mora', 'cedula' => '1002', 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id]);
    }

    private function clave(?Sede $sede = null): string
    {
        return OperacionLinea::clave($this->bodegas->id, $sede?->id, null);
    }

    public function test_se_programa_un_lugar_con_su_personal_y_se_registra_la_asistencia(): void
    {
        $hoy = today()->toDateString();
        $this->actingAs($this->coordinador)
            ->post('/lineas/aseo-general/programacion', ['fecha' => $hoy, 'lugar' => $this->clave($this->planta), 'personas_requeridas' => 3])
            ->assertSessionHasNoErrors();
        $programacion = Programacion::sole();
        $this->assertSame($this->planta->id, $programacion->sede_id);

        // Solo quien trabaja en la línea allí: alguien de otra línea no se puede programar
        $ajeno = User::factory()->sinAcceso()->create(['cedula' => '1003']);
        $this->post("/programacion/{$programacion->id}/personas", ['personas' => [$ajeno->id]])->assertSessionHasErrors(['personas']);
        $this->post("/programacion/{$programacion->id}/personas", ['personas' => [$this->ana->id, $this->luis->id], 'hora_entrada' => '06:00', 'hora_salida' => '14:00'])
            ->assertSessionHasNoErrors();
        $this->assertSame(2, $programacion->asignaciones()->count());

        $filaAna = ProgramacionAsignacion::where('user_id', $this->ana->id)->sole();
        $this->patch("/programacion/personas/{$filaAna->id}/asistencia", ['asistencia' => 'tarde', 'hora_llegada' => '06:40', 'observacion' => 'Trancón en la vía'])
            ->assertSessionHasNoErrors();
        $this->post("/programacion/{$programacion->id}/asistencia")->assertSessionHas('success', '1 persona quedó presente.');

        $this->get("/lineas/aseo-general/programacion?fecha={$hoy}")->assertInertia(fn (Assert $p) => $p
            ->component('lineas/programacion')
            ->where('resumen.requeridas', 3)
            ->where('resumen.programadas', 2)
            ->where('resumen.presentes', 2)
            ->where('resumen.tarde', 1)
            // 2 de 3 requeridas
            ->where('resumen.cobertura', 66.67)
            ->where('programaciones.0.personas.0.nombre', 'Ana Ríos')
            ->where('programaciones.0.personas.0.llegada', '06:40')
            // Queda por programar quien coordina (también trabaja allí)
            ->where('programaciones.0.candidatos', fn ($c) => collect($c)->pluck('id')->all() === [$this->coordinador->id]));

        // La asistencia de mañana aún no se registra, y con asistencia el lugar no se quita
        $manana = Programacion::create(['fecha' => today()->addDay(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 1]);
        $fila = $manana->asignaciones()->create(['user_id' => $this->ana->id]);
        $this->patch("/programacion/personas/{$fila->id}/asistencia", ['asistencia' => 'asistio'])->assertSessionHasErrors(['asistencia']);
        $this->delete("/programacion/{$programacion->id}")->assertSessionHas('error');
    }

    public function test_se_copia_la_programacion_del_dia_anterior_sin_la_asistencia(): void
    {
        $ayer = Programacion::create(['fecha' => today()->subDay(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id, 'personas_requeridas' => 2]);
        $ayer->asignaciones()->create(['user_id' => $this->luis->id, 'hora_entrada' => '06:00', 'asistencia' => EstadoAsistencia::Asistio]);

        $this->actingAs($this->coordinador)->get('/lineas/aseo-general/programacion')
            ->assertInertia(fn (Assert $p) => $p->where('copiarDe', today()->subDay()->toDateString())->has('programaciones', 0));
        $this->post('/lineas/aseo-general/programacion/copiar', ['desde' => today()->subDay()->toDateString(), 'fecha' => today()->toDateString()])
            ->assertSessionHas('success', 'Se copió la programación de 1 lugar.');

        $hoy = Programacion::whereDate('fecha', today())->sole();
        $this->assertSame(2, $hoy->personas_requeridas);
        $copia = $hoy->asignaciones()->sole();
        $this->assertSame($this->luis->id, $copia->user_id);
        $this->assertNull($copia->asistencia);
        // Copiar otra vez no duplica
        $this->post('/lineas/aseo-general/programacion/copiar', ['desde' => today()->subDay()->toDateString(), 'fecha' => today()->toDateString()])->assertSessionHas('error');
    }

    public function test_cada_quien_ve_y_opera_solo_su_linea_y_sus_lugares(): void
    {
        // Otra empresa de aseo, fuera de lo que ve el coordinador
        $otra = Empresa::create(['nombre' => 'Clínica Norte']);
        $otra->lineas()->attach($this->aseo);
        $ajena = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $otra->id, 'personas_requeridas' => 1]);

        $this->actingAs($this->coordinador)->get('/lineas/aseo-general/programacion')
            ->assertInertia(fn (Assert $p) => $p->has('programaciones', 0)->where('lugares', fn ($l) => collect($l)->every(fn ($x) => str_starts_with($x['texto'], 'Bodegas del Valle'))));
        $this->put("/programacion/{$ajena->id}", ['personas_requeridas' => 5])->assertNotFound();
        $this->post('/lineas/aseo-general/programacion', ['fecha' => today()->toDateString(), 'lugar' => OperacionLinea::clave($otra->id, null, null), 'personas_requeridas' => 1])
            ->assertSessionHasErrors(['lugar']);

        // Quien coordina logística no opera el aseo
        $deLogistica = User::factory()->coordinador()->create();
        $this->actingAs($deLogistica)->get('/lineas/aseo-general/programacion')->assertForbidden();
        $this->get('/lineas/aseo-general/novedades')->assertForbidden();

        // La programación de logística sí: con vehículos y rutas
        $this->get('/lineas/logisticos/programacion')->assertInertia(fn (Assert $p) => $p->where('linea.logistica', true));
        // El informe de logística es el de Drivin
        $this->get('/lineas/logisticos/informe')->assertRedirect('/informes');
    }

    public function test_las_novedades_se_registran_se_siguen_y_terminan_en_una_accion_de_desempeno(): void
    {
        $this->actingAs($this->coordinador)->post('/lineas/aseo-general/novedades', [
            'fecha' => today()->toDateString(), 'lugar' => $this->clave(), 'user_id' => $this->ana->id,
            'tipo' => 'Faltan insumos o equipos', 'gravedad' => 'leve', 'descripcion' => 'No llegó el desengrasante.',
        ])->assertSessionHasNoErrors();
        // Luis trabaja en la planta: no cabe en una novedad de otra sede
        $bodegaSur = $this->sede('Bodega Sur', [], $this->bodegas);
        $this->post('/lineas/aseo-general/novedades', [
            'fecha' => today()->toDateString(), 'lugar' => $this->clave($bodegaSur), 'user_id' => $this->luis->id,
            'tipo' => 'Llegada tarde', 'gravedad' => 'leve', 'descripcion' => 'Llegó 7:20.',
        ])->assertSessionHasErrors(['user_id']);
        // No se registran novedades de mañana
        $this->post('/lineas/aseo-general/novedades', ['fecha' => today()->addDay()->toDateString(), 'lugar' => $this->clave(), 'tipo' => 'Otra', 'gravedad' => 'leve', 'descripcion' => 'x'])
            ->assertSessionHasErrors(['fecha']);

        $novedad = NovedadLinea::sole();
        $this->patch("/novedades/{$novedad->id}", ['estado' => 'cerrada'])->assertSessionHasErrors(['seguimiento']);
        $this->patch("/novedades/{$novedad->id}", ['estado' => 'cerrada', 'seguimiento' => 'Se repuso del inventario.', 'accion' => TipoAccion::Retroalimentacion->value])
            ->assertSessionHasNoErrors();

        $novedad->refresh();
        $this->assertSame('cerrada', $novedad->estado);
        $this->assertSame($this->coordinador->id, $novedad->cerrada_por);
        $accion = AccionDesempeno::sole();
        $this->assertSame([$this->ana->id, $this->aseo->id, $novedad->id], [$accion->user_id, $accion->linea_servicio_id, $accion->novedad_id]);

        // Las acciones de aseo no aparecen en el seguimiento de logística
        $this->actingAs(User::factory()->admin()->create())->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p->has('acciones', 0));

        $this->actingAs($this->coordinador)->get('/lineas/aseo-general/novedades')->assertInertia(fn (Assert $p) => $p
            ->component('lineas/novedades')
            ->has('novedades.data', 0)
            ->where('conteo.cerrada', 1));
        $this->get('/lineas/aseo-general/novedades?estado=cerrada')->assertInertia(fn (Assert $p) => $p
            ->where('novedades.data.0.acciones.0.tipo', 'retroalimentacion'));
    }

    public function test_el_informe_diario_resume_la_jornada_y_se_descarga_en_excel(): void
    {
        $programacion = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 2, 'observaciones' => 'Lavado de tanques']);
        $programacion->asignaciones()->create(['user_id' => $this->ana->id, 'hora_entrada' => '06:00', 'hora_salida' => '14:00', 'asistencia' => EstadoAsistencia::Asistio]);
        $programacion->asignaciones()->create(['user_id' => $this->luis->id, 'asistencia' => EstadoAsistencia::Falta]);
        NovedadLinea::create(['linea_servicio_id' => $this->aseo->id, 'fecha' => today(), 'empresa_id' => $this->bodegas->id, 'user_id' => $this->luis->id, 'tipo' => 'Inasistencia', 'gravedad' => 'grave', 'descripcion' => 'No avisó.', 'estado' => 'abierta']);

        $this->actingAs($this->coordinador)->get('/lineas/aseo-general/informe')->assertInertia(fn (Assert $p) => $p
            ->component('lineas/informe')
            ->where('fecha', today()->toDateString())
            ->where('resumen.cobertura', 50)
            ->where('resumen.faltas', 1)
            ->where('resumen.novedades', 1)
            ->where('lugares.0.personas.1.nombre', 'Luis Mora')
            ->where('lugares.0.personas.1.novedades.0', 'Inasistencia: No avisó.'));

        // El tablero de la línea muestra la operación de hoy y la novedad sin cerrar
        $this->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->where('hoy.presentes', 1)
            ->where('hoy.cobertura', 50)
            ->where('novedades.abiertas', 1)
            ->where('novedades.graves', 1));

        $respuesta = $this->get('/lineas/aseo-general/informe/descargar?desde='.today()->toDateString().'&hasta='.today()->toDateString());
        $respuesta->assertOk();
        $ruta = tempnam(sys_get_temp_dir(), 'informe');
        file_put_contents($ruta, $respuesta->streamedContent());
        $libro = IOFactory::load($ruta);
        $this->assertSame(['Informe Diario', 'Novedades', 'Resumen por lugar'], $libro->getSheetNames());
        $hoja = $libro->getSheet(0);
        $this->assertSame('Ana Ríos', $hoja->getCell('C5')->getValue());
        $this->assertSame('06:00 a 14:00', $hoja->getCell('F5')->getValue());
        $this->assertSame('No asistió', $hoja->getCell('G6')->getValue());
        $this->assertSame('Inasistencia: No avisó.', $hoja->getCell('J6')->getValue());
        $this->assertEqualsWithDelta(0.5, $libro->getSheet(2)->getCell('J5')->getValue(), 0.001);
        @unlink($ruta);
    }

    public function test_quien_no_trabaja_en_ninguna_linea_no_abre_sus_herramientas(): void
    {
        $sinLinea = User::factory()->coordinador()->create(['linea_servicio_id' => null]);

        $this->actingAs($sinLinea)->get('/lineas/aseo-general/programacion')
            ->assertForbidden()
            ->assertInertia(fn (Assert $p) => $p->where('mensaje', 'Esta herramienta es de las líneas de servicio: aún no trabajas en ninguna.'));
    }

    public function test_cada_persona_ve_sus_turnos_en_el_tablero(): void
    {
        $programacion = Programacion::create(['fecha' => today()->addDays(2), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 1]);
        $programacion->asignaciones()->create(['user_id' => $this->coordinador->id, 'hora_entrada' => '07:00']);

        $this->actingAs($this->coordinador)->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->has('misTurnos', 1)
            ->where('misTurnos.0.lugar', 'Bodegas del Valle')
            ->where('misTurnos.0.turno', '07:00'));
    }
}
