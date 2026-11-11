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
use Illuminate\Support\Facades\DB;
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
            // El selector de fecha nombra el día frente al hoy del servidor
            ->where('hoy', $hoy)
            // Las cuentas del día con las reglas del tablero y el inicio: un lugar, con menos personas de las requeridas
            ->where('resumen.lugares', 1)
            ->where('resumen.incompletos', 1)
            ->where('resumen.necesarias', 3)
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

        // La asistencia de mañana aún no se registra
        $manana = Programacion::create(['fecha' => today()->addDay(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 1]);
        $fila = $manana->asignaciones()->create(['user_id' => $this->ana->id]);
        $this->patch("/programacion/personas/{$fila->id}/asistencia", ['asistencia' => 'asistio'])->assertSessionHasErrors(['asistencia']);

        // Con asistencia el lugar también se quita: queda marcado y su asistencia se conserva en el historial
        $this->delete("/programacion/{$programacion->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($programacion);
        $this->assertSame(2, $programacion->asignaciones()->whereNotNull('asistencia')->count());
        $this->assertDatabaseHas('bitacora', ['accion' => 'eliminada', 'modelo_tipo' => Programacion::class, 'modelo_id' => $programacion->id]);
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

    public function test_cualquiera_de_la_linea_se_programa_en_cualquier_lugar_se_ordena_y_se_pasa_a_otro(): void
    {
        // Marta trabaja en otra sede de Bodegas: igual se puede programar en la planta
        $sur = $this->sede('Bodega Sur', [], $this->bodegas);
        $marta = User::factory()->sinAcceso()->create(['name' => 'Marta Gil', 'cedula' => '1004', 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $sur->id]);
        $planta = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id, 'personas_requeridas' => 3]);
        $enSur = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $sur->id, 'personas_requeridas' => 1]);

        $this->actingAs($this->coordinador)
            ->post("/programacion/{$planta->id}/personas", ['personas' => [$this->ana->id, $this->luis->id, $marta->id]])
            ->assertSessionHasNoErrors();
        $this->assertSame(3, $planta->asignaciones()->count());

        // El orden lo pone quien programa
        $fila = fn (User $u) => ProgramacionAsignacion::where('user_id', $u->id)->sole();
        $this->patch("/programacion/{$planta->id}/orden", ['personas' => [$fila($marta)->id, $fila($this->luis)->id, $fila($this->ana)->id]])
            ->assertSessionHas('success');
        $this->get('/lineas/aseo-general/programacion')->assertInertia(fn (Assert $p) => $p
            ->where('programaciones', fn ($l) => collect(collect($l)->firstWhere('id', $planta->id)['personas'])->pluck('nombre')->all() === ['Marta Gil', 'Luis Mora', 'Ana Ríos'])
            // Toda la línea, con dónde está asignada cada persona
            ->where('personasLinea', fn ($l) => collect($l)->firstWhere('id', $marta->id)['asignadaEn'] === 'Bodegas del Valle · Bodega Sur'));

        // Pasa a otro lugar el mismo día, con su asistencia
        $fila($this->ana)->update(['asistencia' => EstadoAsistencia::Asistio]);
        $this->patch("/programacion/personas/{$fila($this->ana)->id}/mover", ['programacion_id' => $planta->id])->assertSessionHasErrors(['programacion_id']);
        $this->patch("/programacion/personas/{$fila($this->ana)->id}/mover", ['programacion_id' => $enSur->id])->assertSessionHasNoErrors();
        $this->assertSame($enSur->id, $fila($this->ana)->programacion_id);
        $this->assertSame(EstadoAsistencia::Asistio, $fila($this->ana)->asistencia);
        $this->assertDatabaseHas('bitacora', ['accion' => 'movida', 'modelo_id' => $fila($this->ana)->id]);
        // A un lugar donde ya está, no
        $enSur->asignaciones()->create(['user_id' => $this->luis->id]);
        $luisEnPlanta = ProgramacionAsignacion::where('user_id', $this->luis->id)->where('programacion_id', $planta->id)->sole();
        $this->patch("/programacion/personas/{$luisEnPlanta->id}/mover", ['programacion_id' => $enSur->id])->assertSessionHasErrors(['programacion_id']);
    }

    public function test_se_quita_la_programacion_del_dia_y_se_programa_otra_vez_desde_cero(): void
    {
        $hoy = today()->toDateString();
        $planta = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id, 'personas_requeridas' => 1]);
        $planta->asignaciones()->create(['user_id' => $this->luis->id, 'asistencia' => EstadoAsistencia::Asistio]);
        $empresa = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 1]);

        $this->actingAs($this->coordinador)->delete("/lineas/aseo-general/programacion/dia?fecha={$hoy}")
            ->assertSessionHas('success', 'Se quitó la programación del día (2 lugares).');
        // Nada se borra: quedan marcadas, con la asistencia y el rastro
        $this->assertSoftDeleted($planta);
        $this->assertSoftDeleted($empresa);
        $this->assertSame(1, ProgramacionAsignacion::whereNotNull('asistencia')->count());
        $this->assertSame(2, DB::table('bitacora')->where('accion', 'eliminada')->where('modelo_tipo', Programacion::class)->count());
        $this->delete("/lineas/aseo-general/programacion/dia?fecha={$hoy}")->assertSessionHas('error');

        // El día queda libre para programarlo desde cero
        $this->post('/lineas/aseo-general/programacion', ['fecha' => $hoy, 'lugar' => $this->clave($this->planta), 'personas_requeridas' => 2])->assertSessionHasNoErrors();
        $nueva = Programacion::whereDate('fecha', today())->sole();
        $this->post("/programacion/{$nueva->id}/personas", ['personas' => [$this->luis->id]])->assertSessionHasNoErrors();
        $this->assertNull($nueva->asignaciones()->sole()->asistencia);

        // Lo de otra empresa no se toca
        $otra = Empresa::create(['nombre' => 'Clínica Norte']);
        $ajena = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $otra->id, 'personas_requeridas' => 1]);
        $this->delete("/lineas/aseo-general/programacion/dia?fecha={$hoy}")->assertSessionHas('success');
        $this->assertNotSoftDeleted($ajena);
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

    public function test_una_novedad_se_corrige_y_se_elimina(): void
    {
        $novedad = NovedadLinea::create([
            'linea_servicio_id' => $this->aseo->id, 'fecha' => today(), 'empresa_id' => $this->bodegas->id, 'user_id' => $this->ana->id,
            'tipo' => 'Llegada tarde', 'gravedad' => 'leve', 'descripcion' => 'Llegó tarde', 'estado' => 'abierta', 'registrada_por' => $this->coordinador->id,
        ]);
        $datos = ['fecha' => today()->toDateString(), 'lugar' => $this->clave(), 'user_id' => $this->ana->id, 'tipo' => 'Inasistencia', 'gravedad' => 'grave', 'descripcion' => 'No llegó'];

        $this->actingAs($this->coordinador)->put("/novedades/{$novedad->id}", $datos)->assertSessionHas('success');
        $this->assertSame(['Inasistencia', 'grave', 'No llegó'], [$novedad->fresh()->tipo, $novedad->fresh()->gravedad, $novedad->fresh()->descripcion]);
        $this->assertDatabaseHas('bitacora', ['accion' => 'editada', 'modelo_id' => $novedad->id]);

        // Quien ya estaba se conserva aunque hoy no tenga asignación allí
        $this->ana->asignaciones()->delete();
        $this->put("/novedades/{$novedad->id}", [...$datos, 'descripcion' => 'Otra vez'])->assertSessionHasNoErrors();

        // Cerrada ya no se corrige
        $novedad->update(['estado' => 'cerrada']);
        $this->put("/novedades/{$novedad->id}", $datos)->assertSessionHas('error');

        // Eliminar pide su propio permiso: el coordinador base no lo tiene
        $this->delete("/novedades/{$novedad->id}")->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->delete("/novedades/{$novedad->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($novedad);
        $this->assertDatabaseHas('bitacora', ['accion' => 'eliminada', 'modelo_id' => $novedad->id]);
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
        // Una primera nota: queda en seguimiento
        $this->patch("/novedades/{$novedad->id}", ['estado' => 'en_seguimiento', 'seguimiento' => 'Se pidió a la bodega.'])->assertSessionHasNoErrors();
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
        // Ninguna nota se reemplaza: las dos quedan, en orden, con quién las escribió y qué hizo con el estado
        $this->get('/lineas/aseo-general/novedades?estado=cerrada')->assertInertia(fn (Assert $p) => $p
            ->where('novedades.data.0.acciones.0.tipo', 'retroalimentacion')
            ->has('novedades.data.0.seguimientos', 2)
            ->where('novedades.data.0.seguimientos.0.nota', 'Se pidió a la bodega.')
            ->where('novedades.data.0.seguimientos.0.estado', 'en_seguimiento')
            ->where('novedades.data.0.seguimientos.1.nota', 'Se repuso del inventario.')
            ->where('novedades.data.0.seguimientos.1.de', 'en_seguimiento')
            ->where('novedades.data.0.seguimientos.1.estado', 'cerrada')
            ->where('novedades.data.0.seguimientos.1.quien', $this->coordinador->name)
            ->where('novedades.data.0.seguimientos.1.accion', TipoAccion::Retroalimentacion->label())
            ->missing('novedades.data.0.seguimiento'));

        // Ya cerrada, se le puede agregar una nota sin repetir cómo se resolvió; reabrirla también queda
        $this->patch("/novedades/{$novedad->id}", ['estado' => 'cerrada', 'seguimiento' => 'El proveedor confirmó el despacho.'])->assertSessionHasNoErrors();
        $this->patch("/novedades/{$novedad->id}", ['estado' => 'en_seguimiento'])->assertSessionHasNoErrors();
        $this->assertSame(['Se pidió a la bodega.', 'Se repuso del inventario.', 'El proveedor confirmó el despacho.', null], collect($novedad->fresh()->historialSeguimiento())->pluck('nota')->all());
        $this->assertSame('El proveedor confirmó el despacho.', $novedad->fresh()->seguimiento);

        // El Excel de la línea lleva todo el seguimiento, no solo la última nota
        $excel = $this->get('/lineas/aseo-general/informe/descargar?desde='.today()->toDateString().'&hasta='.today()->toDateString());
        $excel->assertOk();
        $ruta = tempnam(sys_get_temp_dir(), 'informe');
        file_put_contents($ruta, $excel->streamedContent());
        $celda = (string) IOFactory::load($ruta)->getSheetByName('Novedades')->getCell('H5')->getValue();
        @unlink($ruta);
        $this->assertStringContainsString('Se pidió a la bodega.', $celda);
        $this->assertStringContainsString('El proveedor confirmó el despacho.', $celda);
    }

    public function test_las_novedades_sin_cerrar_van_por_atender_y_lo_que_no_fue_falta_se_cierra_sin_texto(): void
    {
        $novedad = fn (array $d) => NovedadLinea::create(['linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'descripcion' => 'x', ...$d]);
        $felicitacion = $novedad(['fecha' => today(), 'tipo' => 'Felicitación del cliente', 'gravedad' => 'ninguna', 'estado' => 'abierta']);
        $novedad(['fecha' => today()->subDays(4), 'tipo' => 'Uniforme o presentación', 'gravedad' => 'leve', 'estado' => 'abierta']);
        $novedad(['fecha' => today()->subDay(), 'tipo' => 'Accidente o incidente', 'gravedad' => 'grave', 'estado' => 'en_seguimiento']);
        $novedad(['fecha' => today()->subDays(3), 'tipo' => 'Inasistencia', 'gravedad' => 'grave', 'estado' => 'abierta', 'user_id' => $this->luis->id, 'sede_id' => $this->planta->id]);

        // Primero las graves, estén abiertas o en seguimiento; en cada gravedad, la que más lleva sin cerrar
        $this->actingAs($this->coordinador)->get('/lineas/aseo-general/novedades')->assertInertia(fn (Assert $p) => $p
            ->where('novedades.data', fn ($d) => collect($d)->pluck('tipo')->all() === ['Inasistencia', 'Accidente o incidente', 'Uniforme o presentación', 'Felicitación del cliente']));

        // Los conteos de cada estado van con la búsqueda y el lugar elegidos (cuadran con la lista)
        $this->get('/lineas/aseo-general/novedades?q=Luis')->assertInertia(fn (Assert $p) => $p
            ->has('novedades.data', 1)
            ->where('conteo', ['abierta' => 1, 'en_seguimiento' => 0, 'cerrada' => 0]));
        $this->get('/lineas/aseo-general/novedades?lugar='.$this->clave($this->planta))->assertInertia(fn (Assert $p) => $p
            ->where('conteo.abierta', 1));

        // Una felicitación se cierra sin contar cómo se resolvió; una falta, no
        $this->patch("/novedades/{$felicitacion->id}", ['estado' => 'cerrada'])->assertSessionHasNoErrors();
        $this->assertSame('cerrada', $felicitacion->fresh()->estado);
        $leve = NovedadLinea::where('gravedad', 'leve')->sole();
        $this->patch("/novedades/{$leve->id}", ['estado' => 'cerrada'])->assertSessionHasErrors(['seguimiento' => 'Para cerrarla, cuenta cómo se resolvió.']);
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
            // La jornada más reciente (a la que vuelve el selector de fecha) y el hoy del servidor
            ->where('ultima', today()->toDateString())
            ->where('hoy', today()->toDateString())
            // Las cuentas del día de la programación y el tablero: el lugar tiene las 2 personas que requiere
            ->where('resumen.incompletos', 0)
            ->where('resumen.necesarias', 2)
            ->where('resumen.cobertura', 50)
            ->where('resumen.faltas', 1)
            ->where('resumen.novedades', 1)
            ->where('lugares.0.personas.1.nombre', 'Luis Mora')
            ->where('lugares.0.personas.1.novedades.0', 'Inasistencia: No avisó.'));

        // El tablero de la línea muestra la operación de hoy y la novedad sin cerrar
        $this->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->where('hoy.presentes', 1)
            ->where('hoy.faltas', 1)
            ->where('hoy.cobertura', 50)
            ->where('novedades.sinCerrar', 1)
            ->where('novedades.graves', 1)
            ->where('novedades.recientes.0.tipo', 'Inasistencia'));

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

    public function test_hoy_dice_lo_mismo_en_el_tablero_que_en_el_inicio_con_las_ausencias_y_lo_que_falta_registrar(): void
    {
        $eva = User::factory()->sinAcceso()->create(['name' => 'Eva Paz', 'cedula' => '1004', 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id]);
        $programacion = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 3]);
        $programacion->asignaciones()->create(['user_id' => $this->ana->id, 'asistencia' => EstadoAsistencia::Asistio]);
        $programacion->asignaciones()->create(['user_id' => $this->luis->id, 'asistencia' => EstadoAsistencia::Permiso]);
        $programacion->asignaciones()->create(['user_id' => $eva->id]);
        // Un lugar con menos personas de las que pidió el cliente
        Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id, 'personas_requeridas' => 2]);
        NovedadLinea::create(['linea_servicio_id' => $this->aseo->id, 'fecha' => today(), 'empresa_id' => $this->bodegas->id, 'tipo' => 'Faltante', 'gravedad' => 'leve', 'descripcion' => 'Sin guantes.', 'estado' => 'en_seguimiento']);

        $admin = User::factory()->admin()->create();
        $tablero = $this->actingAs($admin)->get('/lineas/aseo-general')->viewData('page')['props'];
        $inicio = collect($this->get('/panel')->viewData('page')['props']['lineas'])->firstWhere('slug', 'aseo-general');

        // La ausencia justificada se cuenta aparte de las faltas; quien no tiene registro no es una falta
        $this->assertEquals([
            'lugares' => 2, 'incompletos' => 1, 'requeridas' => 5, 'necesarias' => 5, 'programadas' => 3,
            'presentes' => 1, 'faltas' => 0, 'justificadas' => 1, 'sinRegistrar' => 1, 'cobertura' => 20,
            'href' => '/lineas/aseo-general/programacion',
        ], $tablero['hoy']);
        $this->assertEquals($inicio['hoy'], $tablero['hoy']);
        // "Sin cerrar": las abiertas y las que están en seguimiento
        $this->assertEquals(['sinCerrar' => 1, 'graves' => 0, 'href' => '/lineas/aseo-general/novedades'], $inicio['novedades']);
        $this->assertEquals($inicio['novedades'], collect($tablero['novedades'])->except('recientes')->all());
    }

    public function test_mientras_la_linea_no_se_ha_programado_el_tablero_dice_que_falta_para_operarla(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->where('primerosPasos.empresas', 1)
            ->where('primerosPasos.personas', fn ($n) => $n >= 2)
            ->where('primerosPasos.marcaEmpresas', true)
            // Las asignaciones de esta línea (ahí se crean) y su programación
            ->where('primerosPasos.asignaciones', "/asignaciones?linea={$this->aseo->id}")
            ->where('primerosPasos.programacion', '/lineas/aseo-general/programacion')
            ->where('cobertura', []));

        // Con la primera programación la guía se va y aparece la cobertura de los 14 días anteriores (hoy va en "Hoy")
        $ayer = Programacion::create(['fecha' => today()->subDay(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 2]);
        $ayer->asignaciones()->create(['user_id' => $this->ana->id, 'asistencia' => EstadoAsistencia::Asistio]);
        // Un día programado sin ninguna asistencia registrada no se califica (como en el informe)
        $antier = Programacion::create(['fecha' => today()->subDays(2), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 2]);
        $antier->asignaciones()->create(['user_id' => $this->ana->id]);
        $this->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->where('primerosPasos', null)
            ->has('cobertura', 14)
            ->where('cobertura.0', ['fecha' => today()->subDays(14)->toDateString(), 'programado' => false, 'cobertura' => null])
            ->where('cobertura.12', ['fecha' => today()->subDays(2)->toDateString(), 'programado' => true, 'cobertura' => null])
            ->where('cobertura.13', ['fecha' => today()->subDay()->toDateString(), 'programado' => true, 'cobertura' => 50])
            ->where('hoy.lugares', 0));
    }

    public function test_a_quien_trabaja_en_una_sede_no_le_sale_la_guia_si_la_linea_ya_se_programa_en_su_empresa(): void
    {
        // Luis trabaja en la Planta Yumbo; la línea se programa en "toda la empresa" y allí tiene su turno
        $programacion = Programacion::create(['fecha' => today(), 'linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'personas_requeridas' => 1]);
        $programacion->asignaciones()->create(['user_id' => $this->luis->id]);
        $supervisor = User::factory()->coordinador()->create(['linea_servicio_id' => $this->aseo->id, 'empresa_id' => $this->bodegas->id, 'sede_id' => $this->planta->id]);
        $programacion->asignaciones()->create(['user_id' => $supervisor->id]);

        $this->actingAs($supervisor)->get('/lineas/aseo-general')->assertInertia(fn (Assert $p) => $p
            ->where('primerosPasos', null)
            ->has('misTurnos', 1));
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
