<?php

namespace Tests\Feature;

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Models\Carga;
use App\Models\Cliente;
use App\Models\Empleado;
use App\Models\InformeDiario;
use App\Models\MotivoRechazo;
use App\Models\Orden;
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

        $tugo = Cliente::create(['nombre' => 'TuGo', 'codigo' => 'TUGO', 'meta_efectividad' => 95]);
        $tugo->sedes()->create(['nombre' => 'Cali Sur', 'alias_drivin' => 'CALI SUR CROSS', 'ciudad' => 'Cali']);
        $sodimac = Cliente::create(['nombre' => 'Sodimac', 'codigo' => 'SODIMAC', 'meta_efectividad' => 95]);
        $sodimac->sedes()->create(['nombre' => 'Cali', 'ciudad' => 'Cali']);

        Vehiculo::create(['placa' => 'SNX 708']);
        Empleado::create(['cedula' => '111', 'nombres' => 'Juan Fernando', 'apellidos' => 'Plaza']);
        MotivoRechazo::create(['nombre' => 'Cliente ausente en domicilio']);

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
                ->where('analisis.totales.aprobadas', 1)
                ->where('analisis.totalErrores', 0)
                ->where('analisis.grupos.0.cliente', 'TuGo')
                ->where('analisis.grupos.0.sede', 'Cali Sur')
                ->where('analisis.grupos.0.auxiliarReconocido', true)
                ->where('analisis.grupos.0.vehiculoRegistrado', true)
                ->where('analisis.grupos.0.efectividad', 50)
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
        $this->assertNotNull($primera->empleado_id);

        $informe = InformeDiario::firstOrFail();
        $this->assertSame(4, $informe->total_asignadas);
        $this->assertSame(2, $informe->total_aprobadas);
        $this->assertEquals(50, $informe->efectividad); // RF-06
        $this->assertSame(1, $informe->total_averias);
        $this->assertSame(1, $informe->total_faltantes);
        $this->assertSame(2, $informe->total_devoluciones);
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
        $tugo = Cliente::firstWhere('nombre', 'TuGo');
        InformeDiario::create(['fecha_operacion' => '2026-10-02', 'cliente_id' => $tugo->id, 'sede_id' => $tugo->sedes->first()->id, 'estado' => EstadoInforme::Cerrado]);

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

    public function test_cliente_por_defecto_para_planes_no_reconocidos()
    {
        $carga = $this->subir($this->archivo([$this->fila('PDVT1', 'Aprobada', ['Nombre Plan' => 'RUTA ESPECIAL 2-10', 'Cliente' => 'OTRO'])]));
        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p->where('analisis.totalErrores', 1));

        $sodimac = Cliente::firstWhere('nombre', 'Sodimac');
        $this->patch("/cargas/{$carga->id}", ['cliente_id' => $sodimac->id, 'sede_id' => $sodimac->sedes->first()->id]);

        $this->get("/cargas/{$carga->id}")->assertInertia(fn (Assert $p) => $p
            ->where('analisis.totalErrores', 0)
            ->where('analisis.grupos.0.cliente', 'Sodimac')
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
