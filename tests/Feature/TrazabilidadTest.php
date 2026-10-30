<?php

namespace Tests\Feature;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoEvidencia;
use App\Models\AuditoriaPod;
use App\Models\Bitacora;
use App\Models\Carga;
use App\Models\Evidencia;
use App\Models\InformeDiario;
use App\Models\Orden;
use App\Models\User;
use App\Services\Drivin\ImportadorPreliquidacion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** El recorrido de una orden: qué pasó, cuándo y quién fue el responsable. */
class TrazabilidadTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Carga $carga;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create(['name' => 'Quien Revisa']);
        $this->carga = Carga::create(['archivo_nombre' => 'preliquidacion.xlsx', 'archivo_path' => 'a.xlsx', 'archivo_hash' => str_repeat('a', 64), 'estado' => 'procesada', 'cargado_por' => $this->admin->id, 'procesado_en' => '2026-10-03 13:00:00']);
    }

    private function orden(string $codigo, array $datos = []): Orden
    {
        return Orden::create([
            'carga_id' => $this->carga->id, 'fecha_operacion' => '2026-10-02', 'codigo_orden' => $codigo, 'estado' => EstadoOrden::Aprobada,
            'sede_id' => $this->sede('TuGo '.uniqid())->id, 'ruta' => 'CALI SUR 2-10', 'placa' => 'WOL163', 'auxiliar_nombre' => 'JUAN PLAZA',
            'destinatario' => 'DIANA CUELLAR', 'productos' => 2, 'productos_entregados' => 2, 'hora_entrega' => '2026-10-02 12:42:00', ...$datos,
        ]);
    }

    public function test_muestra_el_recorrido_con_fecha_hora_y_responsable(): void
    {
        $orden = $this->orden('NP100', ['faltante' => true, 'faltante_detalle' => 'No entregado: MESA', 'productos_entregados' => 1]);
        Evidencia::create(['orden_id' => $orden->id, 'tipo' => TipoEvidencia::Fachada, 'path' => 'a.jpg', 'hash' => 'abc', 'nombre_original' => 'fachada.jpg', 'mime' => 'image/jpeg', 'tamano_bytes' => 10, 'subido_por' => $this->admin->id]);
        AuditoriaPod::create(['orden_id' => $orden->id, 'auditado_por' => $this->admin->id, 'auditado_en' => '2026-10-03 15:00:00']);
        $this->actingAs($this->admin);
        Bitacora::registrar('auditada', $orden, ['cumple' => false]);

        $this->get('/trazabilidad?q=NP100')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->component('trazabilidad/index')
            ->where('traza.codigo', 'NP100')
            ->where('traza.resumen.destinatario', 'DIANA CUELLAR')
            ->where('traza.eventos', function ($eventos) {
                $eventos = collect($eventos);
                $titulos = $eventos->pluck('titulo');
                // La jornada, la entrega y su faltante van antes de lo que se registró después
                $this->assertSame('En la operación de la jornada', $titulos[0]);
                $this->assertSame('Entregada con faltante', $titulos[1]);
                $this->assertSame('Faltante', $titulos[2]);
                $this->assertContains('Importada desde Drivin', $titulos);
                $this->assertContains('Evidencia subida', $titulos);
                $this->assertContains('Auditoría: no cumple el protocolo', $titulos);
                // La hora de Drivin ya viene en hora de Colombia: no se convierte
                $this->assertSame('12:42', $eventos[1]['hora']);
                $this->assertSame('JUAN PLAZA', $eventos[1]['responsable']);
                $this->assertSame('Quien Revisa', $eventos->firstWhere('titulo', 'Importada desde Drivin')['responsable']);

                return true;
            })
        );
    }

    public function test_el_mismo_codigo_en_dos_jornadas_es_un_solo_recorrido(): void
    {
        $this->orden('NP200', ['estado' => EstadoOrden::Rechazada, 'productos_entregados' => 0, 'motivo_texto' => 'Cliente ausente', 'hora_entrega' => '2026-10-02 10:00:00']);
        $this->orden('NP200', ['fecha_operacion' => '2026-10-03', 'hora_entrega' => '2026-10-03 11:00:00']);

        $this->actingAs($this->admin)->get('/trazabilidad?q=NP200')->assertInertia(fn (Assert $p) => $p
            ->has('resultados', 1)
            ->where('resultados.0.jornadas', 2)
            ->where('traza.resumen.jornadas', 2)
            ->where('traza.eventos', function ($eventos) {
                $titulos = collect($eventos)->pluck('titulo');
                $this->assertTrue($titulos->search('Rechazada: genera devolución') < $titulos->search('Entregada'));

                return true;
            })
        );
    }

    public function test_varias_coincidencias_se_listan_para_elegir(): void
    {
        $this->orden('NP301');
        $this->orden('NP302');

        $this->actingAs($this->admin)->get('/trazabilidad?q=wol 163')->assertInertia(fn (Assert $p) => $p->has('resultados', 2)->where('traza', null));
        $this->get('/trazabilidad?q=wol 163&codigo=NP302')->assertInertia(fn (Assert $p) => $p->where('traza.codigo', 'NP302'));
        $this->get('/trazabilidad?q=NO-EXISTE')->assertInertia(fn (Assert $p) => $p->has('resultados', 0)->where('traza', null));
    }

    public function test_el_cierre_del_informe_queda_en_el_recorrido(): void
    {
        $orden = $this->orden('NP400');
        $informe = InformeDiario::create(['fecha_operacion' => '2026-10-02', 'sede_id' => $orden->sede_id, 'estado' => EstadoInforme::Borrador]);
        $orden->update(['informe_id' => $informe->id]);

        $this->actingAs($this->admin)->patch("/informes/{$informe->id}/estado", ['estado' => 'cerrado'])->assertSessionHas('success');
        $this->patch("/informes/{$informe->id}/estado", ['estado' => 'seguimiento'])->assertSessionHas('success');

        $this->get('/trazabilidad?q=NP400')->assertInertia(fn (Assert $p) => $p->where('traza.eventos', function ($eventos) {
            $titulos = collect($eventos)->pluck('titulo');
            $this->assertContains('Informe diario cerrado', $titulos);
            $this->assertContains('Informe diario reabierto', $titulos);

            return true;
        }));
    }

    public function test_una_orden_de_una_carga_anulada_conserva_su_rastro(): void
    {
        $this->orden('NP500');
        $this->actingAs($this->admin);
        app(ImportadorPreliquidacion::class)->anular($this->carga);
        $this->assertSame(0, Orden::count());

        $this->get('/trazabilidad?q=NP500')->assertInertia(fn (Assert $p) => $p
            ->where('traza.codigo', 'NP500')
            ->where('traza.resumen', null)
            ->where('traza.eventos.0.titulo', 'Importación anulada')
            ->where('traza.eventos.0.responsable', 'Quien Revisa')
        );
    }

    public function test_pide_el_permiso_de_ver_la_auditoria(): void
    {
        $this->actingAs(User::factory()->sinAcceso()->create(['acceso' => true]))->get('/trazabilidad')->assertForbidden();
    }
}
