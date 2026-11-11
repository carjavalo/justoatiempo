<?php

namespace Tests\Feature;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoEvidencia;
use App\Models\AuditoriaPod;
use App\Models\Carga;
use App\Models\Evidencia;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Services\ConsolidadorInforme;
use App\Services\Pod\AvisosPod;
use App\Services\Pod\EvaluadorProtocolo;
use App\Services\Pod\GeneradorPodEjemplo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as PeticionHttp;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuditoriaPodTest extends TestCase
{
    use RefreshDatabase;

    private User $coordinador;

    private Sede $sede;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->sede = $this->sede('TuGo');
        $this->coordinador = User::factory()->coordinador()->create();
        TipoNovedad::firstOrCreate(['nombre' => 'Buen protocolo de entrega']);

        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('b', 64)]);
        foreach (['PDVT1001', 'PDVT1002', 'PDVT1003'] as $i => $codigo) {
            Orden::create([
                'carga_id' => $carga->id,
                'fecha_operacion' => '2026-10-05',
                'sede_id' => $this->sede->id,
                'codigo_orden' => $codigo,
                'auxiliar_nombre' => 'JUAN PLAZA',
                'estado' => $i < 2 ? EstadoOrden::Aprobada : EstadoOrden::Rechazada,
            ]);
        }
        app(ConsolidadorInforme::class)->consolidar('2026-10-05', $this->sede->id, null);
    }

    private function pdf(string $nombre, bool $completo = true): UploadedFile
    {
        $g = new GeneradorPodEjemplo;
        $ruta = sys_get_temp_dir().'/'.uniqid('pod_').'.pdf';
        file_put_contents($ruta, $g->pdf('POD', $g->fotosEntrega(true, 4, $completo ? 4 : 0, true)));

        return new UploadedFile($ruta, $nombre, 'application/pdf', null, true);
    }

    /** Un PDF como el de Drivin (con logo, sello, firma y comentario) para la orden dada. */
    private function pdfDrivin(string $codigo, string $nombre, array $opciones = [], int $destapado = 4): UploadedFile
    {
        $g = new GeneradorPodEjemplo;
        $ruta = sys_get_temp_dir().'/'.uniqid('pod_').'.pdf';
        file_put_contents($ruta, $g->pdfDrivin($codigo, $g->fotosEntrega(true, 4, $destapado, true), $opciones));

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
                // Se audita por orden, y cada una dice cuántos productos (entregas del informe) lleva
                ->where('ordenes.0.productos', 1)
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

    public function test_las_fotos_borrosas_no_cuentan_y_dejan_su_novedad()
    {
        // Con 4 fotos selladas que se ven bien, cumple; las borrosas quedan anotadas
        $cumple = EvaluadorProtocolo::evaluar($this->checklist(['fotos_ilegibles' => 2]));
        $this->assertTrue($cumple['cumple']);
        $this->assertSame('Buen protocolo de entrega pero puede mejorar', $cumple['novedad']);
        $this->assertStringContainsString('2 fotos borrosas o ilegibles no se tuvieron en cuenta', $cumple['concepto']);

        // Si por ellas faltan fotos del producto, la novedad son las fotos borrosas
        $noCumple = EvaluadorProtocolo::evaluar($this->checklist(['fotos_sellado' => 2, 'fotos_ilegibles' => 2]));
        $this->assertFalse($noCumple['cumple']);
        $this->assertSame('Fotos borrosas o ilegibles', $noCumple['novedad']);

        // Una foto clasificada como borrosa se cuenta en la lista de las órdenes aún sin auditar, y al guardar va al informe
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $orden->evidencias()->create(['tipo' => TipoEvidencia::Ilegible, 'nombre_original' => 'borrosa.jpg', 'path' => 'x/borrosa.jpg', 'hash' => str_repeat('b', 64), 'mime' => 'image/jpeg', 'tamano_bytes' => 10]);
        $this->actingAs($this->coordinador)->get("/auditoria/{$orden->id}")
            ->assertInertia(fn (Assert $p) => $p->where('seleccionada.auditoria.fotos_ilegibles', 1));

        $this->post("/auditoria/{$orden->id}", $this->checklist(['fotos_ilegibles' => 1]))->assertSessionHasNoErrors();
        $this->assertSame(1, AuditoriaPod::firstWhere('orden_id', $orden->id)->fotos_ilegibles);
        $this->assertStringContainsString('Fotos borrosas o ilegibles en 1 orden', InformeDiario::first()->lineas()->first()->novedades);
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
        // La fila resume las novedades de la jornada; el concepto de cada orden va en la hoja de seguimiento
        $this->assertSame('1 devolución', $linea->novedades);
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
        // Sus fotos se separan, sin clasificar, ligadas al PDF
        $this->assertSame(10, $pdf->separadas()->where('tipo', 'otro')->count());

        $foto = Evidencia::where('mime', '!=', 'application/pdf')->whereNull('origen_id')->sole();
        $this->assertSame('fachada', $foto->tipo->value); // preclasificada por el nombre
        $this->assertSame('PDVT1002', $foto->orden->codigo_orden);

        // Al abrir la orden, la lista de chequeo parte de las fotos clasificadas
        $this->get("/auditoria/{$foto->orden_id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.auditoria.foto_fachada', true)
            ->where('seleccionada.auditoria.sin_evidencia', false)
        );

        $this->get(route('evidencias.ver', $pdf))->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_el_pdf_de_drivin_se_lee_y_sus_fotos_se_separan_sin_logo_sello_ni_firma()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');

        // El nombre no trae el código: la orden sale del código que el PDF trae adentro
        $this->actingAs($this->coordinador)
            ->post('/auditoria/lote', ['archivos' => [$this->pdfDrivin('PDVT1001', 'prueba de entrega (1).pdf')], 'fecha' => '2026-10-05'])
            ->assertSessionHas('success');

        $pdf = Evidencia::where('mime', 'application/pdf')->sole();
        $this->assertSame($orden->id, $pdf->orden_id);
        $this->assertSame(10, $pdf->imagenes); // las fotos de la entrega, sin el logo ni el sello
        $this->assertSame('10:00', $pdf->datos['hora']);
        $this->assertSame(['07:00', '17:00'], $pdf->datos['ventana']);
        $this->assertSame(1, $pdf->datos['intento']);
        $this->assertEquals(['entregadas' => 1, 'pedidas' => 1], $pdf->datos['unidades']);
        $this->assertSame('Entrega exitosa, el cliente revisa y está en buen estado', $pdf->datos['comentario']);

        $this->assertSame(10, $pdf->separadas()->where('tipo', 'otro')->count());
        $firma = $pdf->separadas()->where('tipo', 'firma')->sole();
        $this->assertSame(3, $firma->pagina_pdf);
        Storage::disk('local')->assertExists($firma->path);

        // La orden muestra lo que dice el PDF; la firma va con su aviso, no entre las fotos del protocolo
        $this->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.lecturaPdf.avisos', fn ($avisos) => collect($avisos)->pluck('texto')->all() === [
                'Entregó 1 de 1 unidad',
                'A las 10:00, dentro de la ventana de 07:00 a 17:00',
                'En el primer intento',
                'El cliente firmó en la app',
            ] && collect($avisos)->firstWhere('texto', 'El cliente firmó en la app')['imagen'] === route('evidencias.ver', $firma))
            ->where('seleccionada.comentarioPod', 'Entrega exitosa, el cliente revisa y está en buen estado')
            ->where('seleccionada.auditoria.sin_evidencia', false)
            ->where('seleccionada.auditoria.fotos_sellado', 0) // sin clasificar, aún no cuentan
        );

        // La cola cuenta el archivo subido, no sus fotos
        $this->get('/auditoria')->assertInertia(fn (Assert $p) => $p->where('ordenes.0.evidencias', 1));

        // La firma no se clasifica como foto
        $this->patch("/evidencias/{$firma->id}", ['tipo' => 'sellado'])->assertStatus(422);
        $this->patch('/evidencias/'.$pdf->separadas()->first()->id, ['tipo' => 'firma'])->assertSessionHasErrors('tipo');

        // Al eliminar el PDF, sus fotos y su firma se van con él (marcadas, sin borrarse)
        $this->delete("/evidencias/{$pdf->id}")->assertRedirect();
        $this->assertSame(0, Evidencia::count());
        $this->assertSame(12, Evidencia::onlyTrashed()->count());
    }

    public function test_lo_que_dice_el_pdf_avisa_lo_que_hay_que_mirar()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}/evidencias", ['archivos' => [$this->pdfDrivin('PDVT1001', 'POD_PDVT1001.pdf', [
            'hora' => '18:10', 'intento' => 2, 'unidades' => '1.0 / 2.0', 'firma' => false,
            'comentario' => 'Sin novedad, pero la caja llegó con un golpe. Recibe sin destapar a conformidad',
        ], destapado: 0)]]);

        $this->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.lecturaPdf.avisos', fn ($avisos) => collect($avisos)->map(fn ($a) => "{$a['nivel']}: {$a['texto']}")->all() === [
                'atencion: Entregó 1 de 2 unidades',
                'atencion: A las 18:10, fuera de la ventana de 07:00 a 17:00',
                'atencion: En el intento n.° 2',
                'info: El cliente no firmó en la app',
                'atencion: El comentario habla de un posible daño («golpe»): revisa las fotos del producto',
                'info: El comentario dice que el cliente recibió sin destapar: confírmalo en la remesa',
            ])
            // La excepción del protocolo queda sugerida en la lista; el auditor la confirma en la remesa
            ->where('seleccionada.auditoria.recibe_sin_destapar', true)
        );
    }

    public function test_el_comentario_que_niega_el_dano_no_es_un_aviso()
    {
        $this->assertNull(AvisosPod::posibleDano('Entrega exitosa, sin daños y en buen estado'));
        $this->assertNull(AvisosPod::posibleDano('No hay golpes ni rayones'));
        $this->assertSame('rayado', AvisosPod::posibleDano('Sin novedad, rayado en la puerta'));
        $this->assertSame('roto', AvisosPod::posibleDano('El vidrio llegó roto'));
    }

    public function test_el_pdf_de_otra_orden_no_se_agrega_a_esta()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');

        $this->actingAs($this->coordinador)
            ->postJson("/auditoria/{$orden->id}/evidencias", ['archivos' => [$this->pdfDrivin('PDVT1002', 'POD_PDVT1001.pdf')]])
            ->assertOk()
            ->assertJson(['asignados' => 0, 'errores' => ['«POD_PDVT1001.pdf» es la prueba de entrega de la orden PDVT1002, no de esta.']]);

        $this->assertSame(0, Evidencia::count());
    }

    public function test_el_pdf_de_una_orden_que_aun_no_esta_no_se_agrega_a_otra()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');

        // Subido en otra orden: se rechaza aunque la suya (PDVT9999) todavía no se haya importado
        $this->actingAs($this->coordinador)
            ->postJson("/auditoria/{$orden->id}/evidencias", ['archivos' => [$this->pdfDrivin('PDVT9999', 'POD.pdf')]])
            ->assertOk()
            ->assertJson(['asignados' => 0, 'errores' => ['«POD.pdf» es la prueba de entrega de la orden PDVT9999, no de esta.']]);

        // En la carga masiva tampoco se asigna por el nombre del archivo, que dice otra cosa
        $this->postJson('/auditoria/lote', ['archivos' => [$this->pdfDrivin('PDVT9999', 'POD_PDVT1001_20261005.pdf')], 'fecha' => '2026-10-05'])
            ->assertOk()
            ->assertJson(['asignados' => 0, 'errores' => ['«POD_PDVT1001_20261005.pdf» es la prueba de entrega de la orden PDVT9999, que todavía no está en la plataforma: importa primero su carga de Drivin.']]);

        $this->assertSame(0, Evidencia::count());
    }

    public function test_avisa_si_el_pdf_es_de_otra_fecha_y_usa_la_hora_real_de_la_carga()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $orden->update(['hora_entrega' => '2026-10-05 11:18:27']);
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}/evidencias", ['archivos' => [$this->pdfDrivin('PDVT1001', 'POD.pdf', ['fecha' => '2026-10-30'])]]);

        $this->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.lecturaPdf.avisos', fn ($avisos) => collect($avisos)->pluck('texto')->take(4)->all() === [
                'El PDF es de una entrega del 30 de octubre y esta orden es del 5 de octubre: revisa que sea su PDF',
                'Entregó 1 de 1 unidad',
                // La hora real es la de la carga de Drivin (la del PDF puede ser la programada)
                'A las 11:18, dentro de la ventana de 07:00 a 17:00',
                'En el primer intento',
            ])
        );
    }

    public function test_clasificar_y_eliminar_evidencias()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}/evidencias", ['archivos' => [UploadedFile::fake()->image('foto.jpg')]]);

        $e = Evidencia::sole();
        $this->assertSame('otro', $e->tipo->value);

        $this->patch("/evidencias/{$e->id}", ['tipo' => 'remesa'])->assertRedirect();
        $this->assertSame('remesa', $e->fresh()->tipo->value);

        // Una copia de otra foto se marca como repetida: no cuenta para el protocolo
        $this->patch("/evidencias/{$e->id}", ['tipo' => 'repetida'])->assertRedirect();
        $this->assertSame('repetida', $e->fresh()->tipo->value);

        // Se elimina sin borrarse: deja de verse, queda marcada y su archivo se conserva
        $this->delete("/evidencias/{$e->id}")->assertRedirect();
        $this->assertSame(0, Evidencia::count());
        $this->assertSoftDeleted($e);
        Storage::disk('local')->assertExists($e->path);
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

    /** La respuesta de Groq con las fotos que "vio" la IA. */
    private function respuestaIa(array $fotos): array
    {
        return ['choices' => [['message' => ['content' => json_encode(['fotos' => $fotos])]]]];
    }

    /** La orden PDVT1001 con su PDF: fotos 1 fachada, 2-5 sellado, 6-9 destapado, 10 remesa. */
    private function ordenConPdfParaIa(): Orden
    {
        config(['services.groq.key' => 'clave-de-prueba']);
        Http::preventStrayRequests();
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        $this->actingAs($this->coordinador)->post("/auditoria/{$orden->id}/evidencias", ['archivos' => [$this->pdfDrivin('PDVT1001', 'POD_PDVT1001.pdf')]]);

        return $orden;
    }

    public function test_la_ia_clasifica_las_fotos_marca_las_copias_y_revisa_el_producto_y_la_remesa()
    {
        $orden = $this->ordenConPdfParaIa();
        $tipos = [1 => 'fachada', 2 => 'sellado', 3 => 'sellado', 4 => 'sellado', 5 => 'sellado', 6 => 'destapado', 7 => 'destapado', 8 => 'destapado', 9 => 'destapado', 10 => 'remesa'];
        $bien = fn (int $n) => ['n' => $n, 'estado' => 'bien', 'detalle' => '', 'firmada' => false, 'sin_destapar' => false, 'novedad' => false];

        Http::fake(['api.groq.com/*' => Http::sequence()
            // 1. Clasificar: la 5 es la foto de la pantalla de otro celular y la 7 repite la toma de la 6
            ->push($this->respuestaIa(collect($tipos)->map(fn ($tipo, $n) => ['n' => $n, 'tipo' => $tipo, 'pantalla' => $n === 5, 'copia_de' => $n === 7 ? 6 : 0, 'girar' => '0'])->values()->all()))
            // 2. Revisar el producto (2, 3, 4 y 6) y la remesa (10), que está firmada. Más grande, la 3 también se ve que es
            // de la pantalla de otro celular
            ->push($this->respuestaIa([$bien(2), [...$bien(3), 'pantalla' => true], $bien(4), $bien(6), ['n' => 10, 'estado' => 'bien', 'detalle' => '', 'firmada' => true, 'sin_destapar' => false, 'novedad' => false]]))
            // 3. El resto del producto: la 8 con un posible daño
            ->push($this->respuestaIa([['n' => 8, 'estado' => 'posible_dano', 'detalle' => 'esquina de la caja hundida', 'firmada' => false, 'sin_destapar' => false, 'novedad' => false], $bien(9)])),
        ]);

        $this->postJson("/auditoria/{$orden->id}/ia")->assertOk()->assertJson(['listo' => false, 'revisadas' => 10]);
        $this->postJson("/auditoria/{$orden->id}/ia")->assertOk()->assertJson(['listo' => false, 'revisadas' => 5]);
        $this->postJson("/auditoria/{$orden->id}/ia")->assertOk()->assertJson(['listo' => true, 'revisadas' => 2]);

        // Cada consulta lleva a lo sumo 2 imágenes (el plan gratis cuenta 2048 tokens por imagen) y pide JSON con esquema
        Http::assertSentCount(3);
        Http::assertSent(fn (PeticionHttp $p) => $p['model'] === 'qwen/qwen3.8-27b' && $p['response_format']['type'] === 'json_schema'
            && collect($p['messages'][0]['content'])->where('type', 'image_url')->count() <= 2);

        $fotos = $orden->evidencias()->where('tipo', '!=', 'pdf_pod')->where('tipo', '!=', 'firma')->orderBy('id')->pluck('tipo')->map->value->all();
        $this->assertSame(['fachada', 'sellado', 'repetida', 'sellado', 'repetida', 'destapado', 'repetida', 'destapado', 'destapado', 'remesa'], $fotos);

        $this->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p
            ->where('seleccionada.ia.pendientes', 0)
            ->where('seleccionada.ia.avisos', fn ($avisos) => collect($avisos)->pluck('texto')->all() === [
                'Foto 8: posible daño (esquina de la caja hundida)',
                'La remesa está firmada',
                '3 fotos son copias de otras (foto de la pantalla de un celular): quedaron como repetidas',
            ])
            // La lista de chequeo parte de lo que propuso la IA, sin contar las copias
            ->where('seleccionada.auditoria.foto_fachada', true)
            ->where('seleccionada.auditoria.fotos_sellado', 2)
            ->where('seleccionada.auditoria.fotos_destapado', 3)
            ->where('seleccionada.auditoria.foto_remesa', true)
            ->where('seleccionada.evidencias.8.ia.estado', 'posible_dano')
        );
    }

    public function test_la_ia_no_cambia_lo_que_ya_clasifico_el_auditor()
    {
        $orden = $this->ordenConPdfParaIa();
        $primera = $orden->evidencias()->where('tipo', 'otro')->orderBy('id')->first();
        $this->patch("/evidencias/{$primera->id}", ['tipo' => 'remesa']);

        Http::fake(['api.groq.com/*' => Http::response($this->respuestaIa(collect(range(1, 10))->map(fn ($n) => ['n' => $n, 'tipo' => 'sellado', 'pantalla' => false, 'copia_de' => 0, 'girar' => '0'])->all()))]);
        $this->postJson("/auditoria/{$orden->id}/ia")->assertOk();

        $this->assertSame('remesa', $primera->fresh()->tipo->value);
        $this->assertSame('sellado', $primera->fresh()->ia['clasificacion']['tipo']); // lo que propuso queda aparte
    }

    public function test_cuando_groq_pide_esperar_el_paso_espera_y_sin_cupo_avisa()
    {
        $orden = $this->ordenConPdfParaIa();

        Http::fake(['api.groq.com/*' => Http::sequence()
            ->push(['error' => ['message' => 'Rate limit']], 429, ['retry-after' => '18'])
            ->push(['error' => ['message' => 'Rate limit']], 429, ['retry-after' => '3600'])]);

        $this->postJson("/auditoria/{$orden->id}/ia")->assertOk()->assertJson(['listo' => false, 'esperar' => 18]);
        $this->postJson("/auditoria/{$orden->id}/ia")->assertStatus(429)->assertJson(['message' => 'Se acabó el cupo de la IA por ahora (plan gratis de Groq). Vuelve a intentarlo en unos 60 minutos.']);

        // Nada quedó a medias: las fotos siguen pendientes
        $this->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p->where('seleccionada.ia.pendientes', 10));
    }

    public function test_sin_la_clave_de_groq_no_se_ofrece_la_ia()
    {
        $orden = Orden::firstWhere('codigo_orden', 'PDVT1001');
        Http::preventStrayRequests();

        $this->actingAs($this->coordinador)->get("/auditoria/{$orden->id}")->assertInertia(fn (Assert $p) => $p->where('seleccionada.ia.disponible', false));
        $this->postJson("/auditoria/{$orden->id}/ia")->assertStatus(422);
    }
}
