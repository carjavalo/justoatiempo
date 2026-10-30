<?php

namespace Tests\Feature;

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\MotivoRechazo;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Drivin\GeneradorPreliquidacion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CargaDrivinTest extends TestCase
{
    use RefreshDatabase;

    private User $coordinador;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        // Ditransa atiende a TuGo y a Sodimac (sedes), cada una con su sucursal
        $tugo = $this->sede('TuGo', ['codigo' => 'TUGO']);
        $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'alias_drivin' => 'CALI SUR CROSS', 'ciudad' => 'Cali']);
        $sodimac = $this->sede('Sodimac', ['codigo' => 'SODIMAC']);
        $sodimac->sucursales()->create(['nombre' => 'Cali', 'ciudad' => 'Cali']);

        Vehiculo::create(['placa' => 'SNX 708']);
        // El auxiliar: parte del personal, sin acceso a la plataforma, asignado a la línea logística
        User::factory()->sinAcceso()->create(['cedula' => '111', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza']);
        MotivoRechazo::firstOrCreate(['nombre' => 'Cliente ausente en domicilio']);

        $this->coordinador = User::factory()->coordinador()->create();
    }

    /** Fila con la forma de la exportación de Drivin. */
    private function fila(string $np, string $estado, array $extra = []): array
    {
        return [
            'Nombre Plan' => 'CALI SUR CROSS 2-10-2026',
            'Fecha Plan' => '2026-10-02',
            'Código del Vehículo' => 'SNX708',
            'Código de Dirección' => $np,
            'Código de Orden' => $np,
            'Cliente' => 'TUGÓ',
            'Nombre de Contacto' => 'DIANA CUELLAR',
            'Ciudad' => 'CALI',
            'Descripción del Item' => 'SOFA 3 PUESTOS',
            'Unidades Entregadas' => 1,
            'Estado de la orden' => $estado,
            'Hora de Entrega' => '2026-10-02 12:42:26',
            'Conductor' => 'YANIER ADONIS MURILLO',
            'Asistente' => 'JUAN FERNANDO PLAZA GIRALDO',
            ...$extra,
        ];
    }

    private function archivo(array $filas, string $nombre = 'Preliquidacion_2026-10-02.xlsx', ?array $encabezados = null): UploadedFile
    {
        $ruta = sys_get_temp_dir().'/'.uniqid('drivin_').'.xlsx';
        app(GeneradorPreliquidacion::class)->escribir($ruta, $filas, $encabezados);

        return new UploadedFile($ruta, $nombre, null, null, true);
    }

    private function subir(UploadedFile $archivo): Carga
    {
        $this->actingAs($this->coordinador)->post('/cargas', ['archivo' => $archivo])->assertRedirect();

        return Carga::latest('id')->firstOrFail();
    }

    public function test_la_revision_detecta_hoja_columnas_y_agrupa_productos_en_ordenes()
    {
        $carga = $this->subir($this->archivo([
            $this->fila('PDVT1', 'Aprobada'),
            $this->fila('PDVT1', 'Aprobada', ['Descripción del Item' => 'MESA DE NOCHE']), // mismo NP: misma orden
            $this->fila('PDVT2', 'Rechazada', ['Motivo' => 'Cliente ausente en domicilio']),
        ]));

        $this->assertSame(EstadoCarga::EnRevision, $carga->estado);
        $this->assertSame(0, Orden::count(), 'La revisión no debe escribir órdenes');

        $this->get("/cargas/{$carga->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('cargas/revision')
                ->where('lectura.hoja', 'PoE')
                ->where('lectura.filaEncabezados', 2)
                ->where('analisis.columnasFaltantes', [])
                ->where('analisis.filasLeidas', 3)
                ->where('analisis.totales.ordenes', 2)
                // Las entregas se cuentan por producto, como el informe: 3 asignadas, 2 realizadas
                ->where('analisis.totales.asignadas', 3)
                ->where('analisis.totales.realizadas', 2)
                ->where('analisis.totales.devoluciones', 1)
                ->where('analisis.totalErrores', 0)
                ->where('analisis.grupos.0.sede', 'TuGo')
                ->where('analisis.grupos.0.sucursal', 'Cali Sur')
                ->where('analisis.grupos.0.auxiliarReconocido', true)
                ->where('analisis.grupos.0.vehiculoRegistrado', true)
                ->where('analisis.grupos.0.ordenes', 2)
                ->where('analisis.grupos.0.efectividad', 66.67)
            );
    }

    public function test_confirmar_importa_aplica_las_reglas_y_consolida_el_informe()
    {
        $carga = $this->subir($this->archivo([
            $this->fila('PDVT1', 'Aprobada'),
            $this->fila('PDVT2', 'Rechazada', ['Motivo' => 'Cliente ausente en domicilio']),
            $this->fila('PDVT3', 'Rechazada', ['Motivo' => 'Producto averiado']),
            $this->fila('PDVT4', 'Aprobada'),
            $this->fila('PDVT4', 'Rechazada', ['Motivo' => 'Producto agotado', 'Descripción del Item' => 'MESA']), // parcial
            $this->fila('', 'Aprobada'),          // sin código: error
            $this->fila('PDVT9', 'En validación'), // estado desconocido: error
        ]));

        $this->post("/cargas/{$carga->id}/confirmar")->assertRedirect("/cargas/{$carga->id}");

        $carga->refresh();
        $this->assertSame(EstadoCarga::ConErrores, $carga->estado);
        $this->assertSame(4, $carga->ordenes_importadas);
        $this->assertSame(2, $carga->filas_error);

        $this->assertEqualsCanonicalizing(['PDVT1', 'PDVT2', 'PDVT3', 'PDVT4'], Orden::pluck('codigo_orden')->all());

        $rechazada = Orden::firstWhere('codigo_orden', 'PDVT2');
        $this->assertTrue($rechazada->devolucion);                     // RF-07
        $this->assertNotNull($rechazada->motivo_rechazo_id);          // motivo del catálogo
        $this->assertTrue(Orden::firstWhere('codigo_orden', 'PDVT3')->averia); // RF-08

        $parcial = Orden::firstWhere('codigo_orden', 'PDVT4');
        $this->assertSame('aprobada', $parcial->estado->value);
        $this->assertTrue($parcial->faltante);
        $this->assertStringContainsString('MESA', $parcial->faltante_detalle);

        $primera = Orden::firstWhere('codigo_orden', 'PDVT1');
        $this->assertNotNull($primera->vehiculo_id);
        $this->assertNotNull($primera->auxiliar_id);

        // Por producto: 5 asignadas (PDVT4 lleva 2) y 2 realizadas (PDVT1 y el sofá de PDVT4; la mesa no llegó)
        $informe = InformeDiario::firstOrFail();
        $this->assertSame(5, $informe->total_asignadas);
        $this->assertSame(2, $informe->total_aprobadas);
        $this->assertEquals(40, $informe->efectividad); // RF-06
        $this->assertSame(1, $informe->total_averias);
        $this->assertSame(1, $informe->total_faltantes);
        $this->assertSame(2, $informe->total_devoluciones);
        $this->assertSame(4, $informe->lineas()->first()->ordenes);
    }

    public function test_no_se_importa_dos_veces_el_mismo_archivo_ni_la_misma_orden()
    {
        $filas = [$this->fila('PDVT1', 'Aprobada')];
        $carga = $this->subir($this->archivo($filas));
        $this->post("/cargas/{$carga->id}/confirmar");

        // Mismo archivo (mismo contenido) => rechazado de entrada
        $mismo = Carga::find($carga->id);
        $ruta = Storage::disk('local')->path($mismo->archivo_path);
        $this->post('/cargas', ['archivo' => new UploadedFile($ruta, 'copia.xlsx', null, null, true)])
            ->assertSessionHasErrors('archivo');

        // Otro archivo con la misma orden => la orden se reporta como ya importada
        $otra = $this->subir($this->archivo([...$filas, $this->fila('PDVT2', 'Aprobada')], 'otra.xlsx'));
        $this->get("/cargas/{$otra->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totales.ordenes', 1)
            ->where('analisis.totalErrores', 1)
        );
    }

    public function test_un_informe_cerrado_no_admite_nuevas_ordenes()
    {
        $tugo = Sede::firstWhere('nombre', 'TuGo');
        InformeDiario::create(['fecha_operacion' => '2026-10-02', 'sede_id' => $tugo->id, 'sucursal_id' => $tugo->sucursales->first()->id, 'estado' => EstadoInforme::Cerrado]);

        $carga = $this->subir($this->archivo([$this->fila('PDVT1', 'Aprobada')]));

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totales.ordenes', 0)
            ->where('analisis.totalErrores', 1)
        );
        $this->post("/cargas/{$carga->id}/confirmar")->assertSessionHas('error');
    }

    public function test_sin_columna_obligatoria_no_se_puede_importar_y_el_mapeo_se_corrige_a_mano()
    {
        $encabezados = ['Nombre Plan', 'Fecha Plan', 'Código del Vehículo', 'Código de Orden', 'Estado de la orden', 'Responsable de entrega'];
        $carga = $this->subir($this->archivo([[...$this->fila('PDVT1', 'Aprobada'), 'Responsable de entrega' => 'JUAN FERNANDO PLAZA']], 'x.xlsx', $encabezados));

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p->where('analisis.columnasFaltantes', ['auxiliar']));
        $this->post("/cargas/{$carga->id}/confirmar")->assertSessionHas('error');

        // El usuario asigna la columna "Responsable de entrega" (índice 5) al campo auxiliar
        $mapeo = ['fecha' => 1, 'codigo_orden' => 3, 'estado' => 4, 'placa' => 2, 'auxiliar' => 5, 'ruta' => 0];
        $this->patch("/cargas/{$carga->id}", ['mapeo' => $mapeo])->assertRedirect();

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.columnasFaltantes', [])
            ->where('analisis.totales.ordenes', 1)
        );
    }

    public function test_sede_por_defecto_para_planes_no_reconocidos()
    {
        $carga = $this->subir($this->archivo([$this->fila('PDVT1', 'Aprobada', ['Nombre Plan' => 'RUTA ESPECIAL 2-10', 'Cliente' => 'OTRO'])]));
        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p->where('analisis.totalErrores', 1));

        $sodimac = Sede::firstWhere('nombre', 'Sodimac');
        $this->patch("/cargas/{$carga->id}", ['sede_id' => $sodimac->id, 'sucursal_id' => $sodimac->sucursales->first()->id]);

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totalErrores', 0)
            ->where('analisis.grupos.0.sede', 'Sodimac')
        );
    }

    public function test_anular_retira_las_ordenes_y_descartar_borra_la_revision()
    {
        $carga = $this->subir($this->archivo([$this->fila('PDVT1', 'Aprobada')]));
        $this->post("/cargas/{$carga->id}/confirmar");
        $this->assertSame(1, Orden::count());

        $this->post("/cargas/{$carga->id}/anular")->assertRedirect();
        $this->assertSame(0, Orden::count());
        $this->assertSame(EstadoCarga::Anulada, $carga->fresh()->estado);
        $this->assertSame(0, InformeDiario::count());

        $revision = $this->subir($this->archivo([$this->fila('PDVT5', 'Aprobada')], 'b.xlsx'));
        $this->delete("/cargas/{$revision->id}")->assertRedirect('/cargas');
        $this->assertNull(Carga::find($revision->id));
    }

    public function test_solo_entra_el_personal_de_la_operacion()
    {
        $ditransa = $this->empresa();
        $tugo = Sede::firstWhere('nombre', 'TuGo');
        $sodimac = Sede::firstWhere('nombre', 'Sodimac');
        $otraEmpresa = Empresa::create(['nombre' => 'Otra Empresa']);
        $linea = LineaServicio::logistica()->id;

        $otra = User::factory()->sinAcceso()->create(['cedula' => '222222222', 'nombres' => 'Otra', 'primer_apellido' => 'Empresa', 'linea_servicio_id' => null, 'empresa_id' => $otraEmpresa->id]);
        $otraSede = User::factory()->sinAcceso()->create(['cedula' => '333333333', 'nombres' => 'Otra', 'primer_apellido' => 'Sede', 'linea_servicio_id' => $linea, 'empresa_id' => $ditransa->id, 'sede_id' => $sodimac->id]);
        User::factory()->sinAcceso()->create(['cedula' => '444444444', 'nombres' => 'Sin', 'primer_apellido' => 'Asignar', 'linea_servicio_id' => null]);
        // Trabaja en toda la empresa o en su sede: sí hace parte
        User::factory()->sinAcceso()->create(['cedula' => '555555555', 'nombres' => 'Toda', 'primer_apellido' => 'Empresa', 'linea_servicio_id' => $linea, 'empresa_id' => $ditransa->id]);
        User::factory()->sinAcceso()->create(['cedula' => '666666666', 'nombres' => 'Misma', 'primer_apellido' => 'Sede', 'linea_servicio_id' => $linea, 'empresa_id' => $ditransa->id, 'sede_id' => $tugo->id]);
        // Una asignación que ya había terminado en la fecha de la orden no cuenta
        $terminada = User::factory()->sinAcceso()->create(['cedula' => '777777777', 'nombres' => 'Ya', 'primer_apellido' => 'Termino', 'linea_servicio_id' => $linea, 'empresa_id' => $ditransa->id]);
        $terminada->asignaciones()->update(['fecha_fin' => '2026-10-01', 'duracion' => 'fechas']);

        $persona = fn (string $np, string $cedula) => $this->fila($np, 'Aprobada', ['Entregado por' => "[Mobile] {$cedula}@justoatiempo.com", 'Asistente' => "PERSONA {$cedula}"]);
        $encabezados = ['Nombre Plan', 'Fecha Plan', 'Código del Vehículo', 'Código de Orden', 'Estado de la orden', 'Asistente', 'Entregado por'];
        $carga = $this->subir($this->archivo([
            $persona('A1', '222222222'), $persona('A2', '333333333'), $persona('A3', '444444444'), $persona('A4', '555555555'), $persona('A5', '666666666'), $persona('A6', '777777777'), $persona('A7', '999999999'),
        ], 'operacion.xlsx', $encabezados));

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totales.ordenes', 2)
            ->where('analisis.ordenesFuera', 5)
            ->where('analisis.fueraDeOperacion', fn ($fuera) => collect($fuera)->pluck('motivo', 'clave')->sortKeys()->all() === [
                '222222222' => 'otra_operacion', '333333333' => 'otra_operacion', '444444444' => 'sin_asignacion', '777777777' => 'sin_asignacion', '999999999' => 'sin_registrar',
            ])
            ->where('analisis.grupos.0.operacion', 'Ditransa · TuGo')
        );

        // Se dice dónde está asignada y se puede incluir solo en esta carga
        $this->patch("/cargas/{$carga->id}", ['incluir' => ['222222222', '999999999']])->assertRedirect();
        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totales.ordenes', 4)
            ->where('analisis.ordenesFuera', 3)
            ->where('carga.opciones.incluir', ['222222222', '999999999'])
        );

        // Ajustar otra cosa de la revisión no borra a quién se incluyó
        $this->patch("/cargas/{$carga->id}", ['sede_id' => null, 'sucursal_id' => null])->assertRedirect();
        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p->where('analisis.totales.ordenes', 4));

        $this->post("/cargas/{$carga->id}/confirmar")->assertRedirect();
        $this->assertEqualsCanonicalizing(['A1', 'A4', 'A5', 'A7'], Orden::pluck('codigo_orden')->all());
        $this->assertSame($otra->id, Orden::firstWhere('codigo_orden', 'A1')->auxiliar_id);
        $this->assertNull(Orden::where('auxiliar_id', $otraSede->id)->first());

        // Lo que quedó por fuera se ve en el resultado de la carga
        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->component('cargas/resultado')
            ->where('advertencias', fn ($a) => collect($a)->firstWhere('tipo', 'fuera_operacion')['items'] !== [])
        );
    }

    public function test_quien_trabaja_en_toda_la_linea_hace_parte_de_cualquier_empresa()
    {
        User::factory()->sinAcceso()->create(['cedula' => '888888888', 'nombres' => 'Toda', 'primer_apellido' => 'Linea']);
        $encabezados = ['Nombre Plan', 'Fecha Plan', 'Código del Vehículo', 'Código de Orden', 'Estado de la orden', 'Asistente', 'Entregado por'];
        $carga = $this->subir($this->archivo([$this->fila('B1', 'Aprobada', ['Entregado por' => '[Mobile] 888888888@justoatiempo.com', 'Asistente' => 'TODA LINEA'])], 'linea.xlsx', $encabezados));

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p->where('analisis.totales.ordenes', 1)->where('analisis.ordenesFuera', 0));
    }

    public function test_una_carga_anulada_se_puede_volver_a_subir()
    {
        $archivo = $this->archivo([$this->fila('PDVT1', 'Aprobada')], 'repetido.xlsx');
        $contenido = file_get_contents($archivo->getRealPath());
        $carga = $this->subir($archivo);
        $this->post("/cargas/{$carga->id}/confirmar");
        $this->post("/cargas/{$carga->id}/anular");
        $this->assertSame(0, Orden::count());

        $copia = sys_get_temp_dir().'/'.uniqid('drivin_').'.xlsx';
        file_put_contents($copia, $contenido);
        $this->post('/cargas', ['archivo' => new UploadedFile($copia, 'repetido.xlsx', null, null, true)])->assertRedirect("/cargas/{$carga->id}");
        $this->assertTrue($carga->fresh()->enRevision());

        $this->post("/cargas/{$carga->id}/confirmar")->assertRedirect();
        $this->assertSame(1, Orden::count());
    }

    public function test_solo_coordinador_y_administrador_cargan_archivos()
    {
        $this->actingAs(User::factory()->create())->get('/cargas')->assertForbidden();
        $this->actingAs($this->coordinador)->get('/cargas')->assertOk();
    }

    public function test_mil_lineas_se_importan_en_menos_de_cinco_segundos()
    {
        $filas = [];
        for ($i = 1; $i <= 1000; $i++) {
            $filas[] = $this->fila('PDVT'.(10000 + intdiv($i, 2)), $i % 7 ? 'Aprobada' : 'Rechazada');
        }
        $carga = $this->subir($this->archivo($filas));

        $inicio = microtime(true);
        $this->post("/cargas/{$carga->id}/confirmar")->assertRedirect();
        $segundos = microtime(true) - $inicio;

        $this->assertSame(501, $carga->fresh()->ordenes_importadas);
        $this->assertLessThan(5, $segundos, "La importación tardó {$segundos} s");
    }
}
