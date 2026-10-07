<?php

namespace Tests\Feature;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Models\AuditoriaPod;
use App\Models\Carga;
use App\Models\Cliente;
use App\Models\Evidencia;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use App\Services\Pod\EvaluadorProtocolo;
use App\Services\Pod\GeneradorPodEjemplo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuditoriaPodTest extends TestCase
{
    use RefreshDatabase;

    private User $coordinador;

    private Cliente $cliente;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->cliente = Cliente::create(['nombre' => 'TuGo', 'meta_efectividad' => 95]);
        $this->coordinador = User::factory()->coordinador()->create();
        TipoNovedad::create(['nombre' => 'Buen protocolo de entrega']);

        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('b', 64)]);
        foreach (['PDVT1001', 'PDVT1002', 'PDVT1003'] as $i => $codigo) {
            Orden::create([
                'carga_id' => $carga->id,
                'fecha_operacion' => '2026-10-05',
                'cliente_id' => $this->cliente->id,
                'codigo_orden' => $codigo,
                'auxiliar_nombre' => 'JUAN PLAZA',
                'estado' => $i < 2 ? EstadoOrden::Aprobada : EstadoOrden::Rechazada,
            ]);
        }
        app(ConsolidadorInforme::class)->consolidar('2026-10-05', $this->cliente->id, null);
    }

    private function pdf(string $nombre, bool $completo = true): UploadedFile
    {
        $g = new GeneradorPodEjemplo;
        $ruta = sys_get_temp_dir().'/'.uniqid('pod_').'.pdf';
        file_put_contents($ruta, $g->pdf('POD', $g->fotosEntrega(true, 4, $completo ? 4 : 0, true)));

        return new UploadedFile($ruta, $nombre, 'application/pdf', null, true);
    }

    private function checklist(array $cambios = []): array
    {
        return [
            'foto_fachada' => true, 'fotos_sellado' => 4, 'fotos_destapado' => 4, 'foto_remesa' => true,
            'foto_rotulo' => false, 'recibe_sin_destapar' => false, 'sin_evidencia' => false, ...$cambios,
        ];
    }

    public function test_la_cola_muestra_solo_entregas_aprobadas_pendientes_y_abre_la_primera()
    {
        $this->actingAs($this->coordinador)->get('/auditoria')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('auditoria/index')
                ->where('filtros.fecha', '2026-10-05')
                ->where('resumen.aprobadas', 2)
                ->where('resumen.pendientes', 2)
                ->has('ordenes', 2)
                ->where('seleccionada.codigo', 'PDVT1001')
                ->where('seleccionada.auditoria.sin_evidencia', true) // sin archivos: se detecta sola
                ->where('siguiente.codigo', 'PDVT1002')
            );
    }

    public function test_reglas_del_protocolo_y_excepcion_sin_destapar()
    {
        $this->assertTrue(EvaluadorProtocolo::evaluar($this->checklist())['cumple']);

        $sinDestapar = EvaluadorProtocolo::evaluar($this->checklist(['fotos_destapado' => 0]));
        $this->assertFalse($sinDestapar['cumple']);
        $this->assertSame('Faltan fotos de producto destapado', $sinDestapar['novedad']);

        // RF-10: con la nota firmada en la remesa no se exigen fotos destapadas
        $conNota = EvaluadorProtocolo::evaluar($this->checklist(['fotos_destapado' => 0, 'recibe_sin_destapar' => true]));
        $this->assertTrue($conNota['cumple']);
        $this->assertSame('Entregado sin destapar con nota en remesa', $conNota['novedad']);

        $grave = EvaluadorProtocolo::evaluar($this->checklist(['foto_fachada' => false, 'foto_remesa' => false, 'fotos_sellado' => 2]));
        $this->assertSame('Falta foto de fachada y remesa firmada', $grave['novedad']);
        $this->assertStringContainsString('2 de 4', $grave['concepto']);
    }

    public function test_guardar_actualiza_el_informe_y_pasa_a_la_siguiente()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $siguiente = Orden::firstWhere('codigo_orden', 'PDVT1002');

        $this->actingAs($this->coordinador)
            ->post("/auditoria/{$orden->id}", [...$this->checklist(), 'concepto' => 'Buen protocolo', 'siguiente' => $siguiente->id])
            ->assertRedirect("/auditoria/{$siguiente->id}");

        $auditoria = AuditoriaPod::firstWhere('orden_id', $orden->id);
        $this->assertTrue($auditoria->cumple_protocolo);
        $this->assertSame($this->coordinador->id, $auditoria->auditado_por);

        $linea = InformeDiario::first()->lineas()->first();
        $this->assertTrue($linea->pod_cumple);
        $this->assertSame('Buen protocolo', $linea->novedades);
    }

    public function test_sin_evidencia_anula_la_lista_y_no_cumple()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}", $this->checklist(['sin_evidencia' => true]));

        $a = AuditoriaPod::firstWhere('orden_id', $orden->id);
        $this->assertTrue($a->sin_evidencia);
        $this->assertFalse($a->cumple_protocolo);
        $this->assertSame(0, $a->fotos_sellado);
    }

    public function test_carga_masiva_asigna_por_codigo_y_cuenta_las_fotos_del_pdf()
    {
        $this->actingAs($this->coordinador)
            ->post('/auditoria/lote', [
                'archivos' => [
                    $this->pdf('POD_PDVT1001_20261005.pdf'),
                    $this->pdf('POD_PDVT1001_20261005.pdf'),       // mismo contenido: no se duplica
                    UploadedFile::fake()->image('PDVT1002_fachada_1.jpg'),
                    UploadedFile::fake()->image('foto_sin_codigo.jpg'),
                ],
                'fecha' => '2026-10-05',
            ])
            ->assertSessionHas('success')
            ->assertSessionHas('lote', fn ($l) => $l['sinOrden'] === ['foto_sin_codigo.jpg']);

        $pdf = Evidencia::where('mime', 'application/pdf')->sole();
        $this->assertSame(10, $pdf->imagenes); // fachada + 4 sellado + 4 destapado + remesa
        $this->assertSame('pdf_pod', $pdf->tipo->value);

        $foto = Evidencia::where('mime', '!=', 'application/pdf')->sole();
        $this->assertSame('fachada', $foto->tipo->value); // preclasificada por el nombre
        $this->assertSame('PDVT1002', $foto->orden->codigo_orden);

        // Al abrir la orden, la lista de chequeo parte de las fotos clasificadas
        $this->get("/auditoria/{$foto->orden_id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.auditoria.foto_fachada', true)
            ->where('seleccionada.auditoria.sin_evidencia', false)
        );

        $this->get(route('evidencias.ver', $pdf))->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_clasificar_y_eliminar_evidencias()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}/evidencias", ['archivos' => [UploadedFile::fake()->image('foto.jpg')]]);

        $e = Evidencia::sole();
        $this->assertSame('otro', $e->tipo->value);

        $this->patch("/evidencias/{$e->id}", ['tipo' => 'remesa'])->assertRedirect();
        $this->assertSame('remesa', $e->fresh()->tipo->value);

        $this->delete("/evidencias/{$e->id}")->assertRedirect();
        $this->assertSame(0, Evidencia::count());
        Storage::disk('local')->assertMissing($e->path);
    }

    public function test_un_informe_cerrado_no_admite_cambios()
    {
        InformeDiario::first()->update(['estado' => EstadoInforme::Cerrado]);
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');

        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}", $this->checklist())->assertSessionHas('error');
        $this->assertSame(0, AuditoriaPod::count());
    }

    public function test_las_entregas_rechazadas_no_se_auditan_y_el_auxiliar_no_entra()
    {
        $rechazada = Orden::firstWhere('codigo_orden', 'PDVT1003');
        $this->actingAs($this->coordinador)->get("/auditoria/{$rechazada->id}")->assertNotFound();

        $this->actingAs(User::factory()->create())->get('/auditoria')->assertForbidden();
    }
}
