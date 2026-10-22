<?php

namespace Tests\Feature;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Carga;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * El informe diario como el Excel de la operación: una fila por auxiliar, ruta y placa, con sus entregas, novedades
 * y la acción de seguimiento; se pasa a seguimiento, se cierra y se descarga con el mismo formato.
 */
class InformeDiarioTest extends TestCase
{
    use RefreshDatabase;

    private Sede $tugo;

    private User $juan;

    private User $coordinador;

    private InformeDiario $informe;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tugo = $this->sede('TuGo');
        $caliSur = $this->tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $this->juan = User::factory()->sinAcceso()->create(['cedula' => '1144203579', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'linea_servicio_id' => null]);
        $this->coordinador = User::factory()->coordinador()->create();

        // Como Juan Plaza el 2 de octubre: 6 órdenes (8 productos), 1 rechazada con 3 productos; 2 sin imágenes
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('a', 64)]);
        foreach (range(1, 6) as $i) {
            Orden::create([
                'carga_id' => $carga->id, 'fecha_operacion' => '2026-10-02', 'sede_id' => $this->tugo->id, 'sucursal_id' => $caliSur->id,
                'ruta' => 'CALI SUR CROSS 2-10-2026', 'placa' => 'SNX708', 'auxiliar_id' => $this->juan->id, 'auxiliar_nombre' => 'JUAN FERNANDO PLAZA BENAVIDES',
                'codigo_orden' => "PDVT{$i}", 'estado' => $i === 6 ? EstadoOrden::Rechazada : EstadoOrden::Aprobada,
                'motivo_texto' => $i === 6 ? 'Cliente reprograma fecha de recibo' : null,
                'productos' => $i === 6 ? 3 : 1, 'productos_entregados' => $i === 6 ? 0 : 1, 'tiene_imagenes' => $i > 2,
            ]);
        }
        $this->informe = app(ConsolidadorInforme::class)->consolidar('2026-10-02', $this->tugo->id, $caliSur->id);
    }

    public function test_muestra_la_jornada_como_el_excel_de_la_operacion(): void
    {
        $this->actingAs($this->coordinador)->get('/informes')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('informes/index')
                ->where('fecha', '2026-10-02')
                ->has('informes', 1)
                ->where('informes.0.sede', 'TuGo')
                ->where('informes.0.sucursal', 'Cali Sur')
                ->where('informes.0.ciudad', 'Cali')
                ->where('informes.0.lineas.0.auxiliar', 'Juan Fernando Plaza')
                // Por producto, como el informe real de ese día: 8 asignadas, 5 realizadas y 3 devoluciones (62,5 %)
                ->where('informes.0.lineas.0.asignadas', 8)
                ->where('informes.0.lineas.0.realizadas', 5)
                ->where('informes.0.lineas.0.pendientes', 3)
                ->where('informes.0.lineas.0.devoluciones', 3)
                ->where('informes.0.lineas.0.ordenes', 6)
                ->where('informes.0.lineas.0.cumplimiento', 62.5)
                ->where('informes.0.lineas.0.novedades', 'Sin evidencias en 2 órdenes · 3 devoluciones (Cliente reprograma fecha de recibo)')
                ->where('informes.0.lineas.0.pod', false)
                // Por debajo del 70 %: llamado de atención
                ->where('informes.0.lineas.0.sugerencia', TipoAccion::LlamadoAtencion->value)
                ->where('resumen.cumplimiento', 62.5)
                ->where('porCiudad.0.ciudad', 'Cali'));

        // El tablero cuenta igual que el informe
        $this->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p
            ->where('kpis.asignadas', 8)
            ->where('kpis.aprobadas', 5)
            ->where('kpis.devoluciones', 3)
            ->where('kpis.efectividad', 62.5)
            ->where('motivos.0.total', 3));

        // El auxiliar solo ve lo suyo: el informe no se le abre
        $this->actingAs(User::factory()->create())->get('/informes')->assertForbidden();
    }

    public function test_la_observacion_escrita_a_mano_se_conserva_al_recalcular(): void
    {
        $linea = $this->informe->lineas()->sole();
        $this->actingAs($this->coordinador)->patch("/informes/filas/{$linea->id}/observacion", ['observacion' => 'Verificar el Drivin'])->assertSessionHasNoErrors();

        // Una auditoría o una carga nueva recalculan el informe
        app(ConsolidadorInforme::class)->consolidar('2026-10-02', $this->tugo->id, $this->informe->sucursal_id);

        $this->assertSame('Verificar el Drivin', $this->informe->lineas()->sole()->observacion);
    }

    public function test_pasa_a_seguimiento_se_cierra_y_se_reabre(): void
    {
        $this->actingAs($this->coordinador)->patch("/informes/{$this->informe->id}/estado", ['estado' => 'seguimiento'])->assertSessionHas('success');
        $this->assertSame(EstadoInforme::Seguimiento, $this->informe->fresh()->estado);

        $this->patch("/informes/{$this->informe->id}/estado", ['estado' => 'cerrado'])->assertSessionHas('success');
        $cerrado = $this->informe->fresh();
        $this->assertSame([EstadoInforme::Cerrado, $this->coordinador->id], [$cerrado->estado, $cerrado->cerrado_por]);

        // Cerrado no admite cambios ni acciones
        $linea = $this->informe->lineas()->sole();
        $this->patch("/informes/filas/{$linea->id}/observacion", ['observacion' => 'Tarde'])->assertStatus(303);
        $this->assertNull($linea->fresh()->observacion);
        $this->post('/seguimiento/acciones', ['user_id' => $this->juan->id, 'informe_id' => $this->informe->id, 'tipo' => 'felicitacion'])
            ->assertSessionHasErrors(['tipo' => 'El informe está cerrado: reábrelo para registrar acciones.']);

        $this->patch("/informes/{$this->informe->id}/estado", ['estado' => 'seguimiento'])->assertSessionHas('success', 'Informe de TuGo · Cali Sur reabierto: queda en seguimiento.');
        $this->assertNull($this->informe->fresh()->cerrado_por);
    }

    public function test_la_accion_de_seguimiento_queda_en_la_fila_y_en_el_historial(): void
    {
        $this->actingAs($this->coordinador)->post('/seguimiento/acciones', [
            'user_id' => $this->juan->id, 'informe_id' => $this->informe->id,
            'tipo' => TipoAccion::LlamadoEscrito->value, 'descripcion' => 'No hay evidencias en algunas órdenes',
        ])->assertSessionHas('success', 'Llamado de atención escrito registrada para Juan Fernando Plaza.');

        $accion = AccionDesempeno::sole();
        $this->assertSame([$this->juan->id, $this->informe->id, 62.5, $this->coordinador->id], [$accion->user_id, $accion->informe_id, (float) $accion->efectividad_referencia, $accion->registrado_por]);

        $this->get('/informes')->assertInertia(fn (Assert $p) => $p->where('informes.0.lineas.0.acciones.0.tipoLabel', 'Llamado de atención escrito'));
        $this->get('/seguimiento')->assertInertia(fn (Assert $p) => $p->component('seguimiento/index')
            ->where('personas.0.nombre', 'Juan Fernando Plaza')
            ->where('personas.0.cumplimiento', 62.5)
            ->where('personas.0.sinEvidencia', 2)
            ->where('personas.0.conteo.llamado_escrito', 1));

        // Nadie se registra acciones a sí mismo
        $this->post('/seguimiento/acciones', ['user_id' => $this->coordinador->id, 'tipo' => 'felicitacion'])
            ->assertSessionHasErrors(['tipo' => 'No puedes registrarte acciones a ti mismo.']);
    }

    public function test_se_descarga_en_excel_con_las_hojas_de_la_operacion(): void
    {
        $respuesta = $this->actingAs($this->coordinador)->get('/informes/descargar?desde=2026-10-02&hasta=2026-10-02');
        $respuesta->assertOk()->assertDownload('Informe diario de operaciones 2026-10-02.xlsx');

        $ruta = tempnam(sys_get_temp_dir(), 'informe');
        file_put_contents($ruta, $respuesta->streamedContent());
        $libro = IOFactory::load($ruta);

        $this->assertSame(['Informe Diario', 'Seguimiento', 'Resumen por ciudad', 'Dashboard Gerencial'], $libro->getSheetNames());
        $hoja = $libro->getSheetByName('Informe Diario');
        $this->assertSame('Fecha operación', $hoja->getCell('A4')->getValue());
        $this->assertSame(['TuGo · Cali Sur', 'Juan Fernando Plaza', 'Cali', 'RUTA / SNX708', 8, 5, 3], [
            $hoja->getCell('B5')->getValue(), $hoja->getCell('C5')->getValue(), $hoja->getCell('D5')->getValue(), $hoja->getCell('E5')->getValue(),
            $hoja->getCell('F5')->getValue(), $hoja->getCell('G5')->getValue(), $hoja->getCell('H5')->getValue(),
        ]);
        $this->assertSame('No', $hoja->getCell('N5')->getValue());
        // Una fila por orden en la hoja de seguimiento
        $this->assertSame('PDVT1', $libro->getSheetByName('Seguimiento')->getCell('D3')->getValue());

        $this->get('/informes/descargar?desde=2026-01-01&hasta=2026-10-02')->assertSessionHasErrors(['hasta' => 'El periodo puede ser de hasta tres meses.']);
    }

    public function test_cada_quien_ve_los_informes_de_sus_asignaciones(): void
    {
        $otra = $this->sede('Sodimac', [], $this->empresa('Logística Sur'));
        $deOtra = User::factory()->coordinador()->create(['empresa_id' => $otra->empresa_id]);

        $this->actingAs($deOtra)->get('/informes')->assertOk()->assertInertia(fn (Assert $p) => $p->where('fecha', null)->has('informes', 0));
        $this->patch("/informes/{$this->informe->id}/estado", ['estado' => 'cerrado'])->assertNotFound();
        $this->post('/seguimiento/acciones', ['user_id' => $this->juan->id, 'informe_id' => $this->informe->id, 'tipo' => 'felicitacion'])->assertNotFound();
    }
}
