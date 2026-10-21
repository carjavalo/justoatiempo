<?php

namespace Tests\Feature;

use App\Models\MotivoRechazo;
use App\Models\Parametro;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Flota (los vehículos por placa, como los trae Drivin) y Parámetros (los umbrales del informe y los catálogos de
 * motivos de rechazo y tipos de novedad).
 */
class FlotaParametrosTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_la_flota_registra_vehiculos_con_la_placa_como_la_trae_drivin(): void
    {
        $conductor = User::factory()->sinAcceso()->create(['cedula' => '94000111', 'cargo' => 'Conductor']);

        $this->actingAs($this->admin)->post('/vehiculos', ['placa' => 'snx-708', 'codigo_interno' => ' 12 ', 'tipo' => 'NHR', 'conductor_id' => $conductor->id])
            ->assertSessionHasNoErrors();
        $vehiculo = Vehiculo::sole();
        $this->assertSame('SNX708', $vehiculo->placa);
        $this->assertSame('12', $vehiculo->codigo_interno);
        $this->assertSame($conductor->id, $vehiculo->conductor_id);

        // La misma placa escrita de otra forma ya existe
        $this->post('/vehiculos', ['placa' => 'SNX 708'])->assertSessionHasErrors(['placa' => 'Ya hay un vehículo con esta placa.']);
        // Un conductor inactivo no se puede elegir
        $inactivo = User::factory()->sinAcceso()->create(['activo' => false]);
        $this->put("/vehiculos/{$vehiculo->id}", ['placa' => 'SNX708', 'conductor_id' => $inactivo->id])->assertSessionHasErrors(['conductor_id']);

        $this->patch("/vehiculos/{$vehiculo->id}/estado", ['activo' => false])->assertSessionHas('success');
        $this->assertFalse($vehiculo->fresh()->activo);

        $this->get('/vehiculos?q=snx')->assertInertia(fn (Assert $p) => $p
            ->component('vehiculos/index')
            ->where('vehiculos.data.0.placa', 'SNX708')
            ->where('vehiculos.data.0.conductor', $conductor->name)
            ->where('personas.0.id', $conductor->id));
    }

    public function test_un_coordinador_sin_permisos_de_flota_ni_parametros_no_los_abre(): void
    {
        $coordinador = User::factory()->coordinador()->create();

        $this->actingAs($coordinador)->get('/vehiculos')->assertForbidden();
        $this->get('/parametros')->assertForbidden();
        $this->put('/parametros', ['umbral_felicitacion' => 90])->assertForbidden();
    }

    public function test_los_umbrales_se_guardan_y_el_llamado_debe_ser_menor_que_la_felicitacion(): void
    {
        $datos = ['umbral_felicitacion' => 98, 'umbral_llamado_atencion' => 75.5, 'meta_efectividad_global' => 96, 'hora_corte_informe' => '09:30'];

        $this->actingAs($this->admin)->put('/parametros', [...$datos, 'umbral_llamado_atencion' => 99])
            ->assertSessionHasErrors(['umbral_llamado_atencion' => 'Debe ser menor que el umbral de felicitación.']);
        $this->put('/parametros', [...$datos, 'hora_corte_informe' => '9 am'])->assertSessionHasErrors(['hora_corte_informe']);

        $this->put('/parametros', $datos)->assertSessionHasNoErrors();
        $this->assertSame('75.5', Parametro::valor('umbral_llamado_atencion'));
        $this->assertSame('09:30', Parametro::valor('hora_corte_informe'));

        // La sede nueva nace con la meta de Parámetros
        $this->get('/sedes')->assertInertia(fn (Assert $p) => $p->where('metaPorDefecto', 96));
        $this->get('/parametros')->assertInertia(fn (Assert $p) => $p
            ->component('parametros/index')
            ->where('valores.umbral_felicitacion', 98)
            ->where('valores.hora_corte_informe', '09:30'));
    }

    public function test_los_catalogos_se_amplian_y_los_tipos_de_la_auditoria_conservan_su_nombre(): void
    {
        $this->actingAs($this->admin)->post('/parametros/motivos', ['nombre' => ' Local cerrado ', 'imputable' => false])->assertSessionHasNoErrors();
        $this->post('/parametros/motivos', ['nombre' => 'local cerrado', 'imputable' => true])->assertSessionHasErrors(['nombre']);
        $motivo = MotivoRechazo::firstWhere('nombre', 'Local cerrado');
        $this->patch("/parametros/motivos/{$motivo->id}/estado", ['activo' => false]);
        $this->assertFalse($motivo->fresh()->activo);

        // Viene con los catálogos base (migración)
        $sistema = TipoNovedad::where('nombre', 'Falta remesa firmada')->firstOrFail();
        $this->put("/parametros/novedades/{$sistema->id}", ['nombre' => 'Sin remesa', 'severidad' => 'leve'])->assertSessionHasErrors(['nombre']);
        $this->put("/parametros/novedades/{$sistema->id}", ['nombre' => 'Falta remesa firmada', 'severidad' => 'leve'])->assertSessionHasNoErrors();
        $this->assertSame('leve', $sistema->fresh()->severidad);

        $this->post('/parametros/novedades', ['nombre' => 'Producto en mal estado', 'severidad' => 'urgente'])->assertSessionHasErrors(['severidad']);

        $this->get('/parametros')->assertInertia(fn (Assert $p) => $p
            ->where('novedades', fn ($novedades) => collect($novedades)->firstWhere('id', $sistema->id)['sistema'] === true));
    }
}
