<?php

namespace Tests\Feature;

use App\Enums\EstadoOrden;
use App\Enums\Rol;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\Asignacion;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\MotivoRechazo;
use App\Models\Orden;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Models\SolicitudContacto;
use App\Models\Sucursal;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Eliminar pide confirmación en la pantalla y aquí, su propio permiso. Lo que tiene historial no se borra: se explica y
 * se desactiva. Lo que se borra queda en la bitácora.
 */
class EliminarRegistrosTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        $this->actingAs($this->admin);
    }

    private function orden(array $datos = []): Orden
    {
        $carga = Carga::create(['archivo_nombre' => 'a.xlsx', 'archivo_path' => 'a.xlsx', 'archivo_hash' => uniqid().str_repeat('0', 51), 'estado' => 'procesada']);

        return Orden::create(['carga_id' => $carga->id, 'fecha_operacion' => '2026-10-02', 'codigo_orden' => uniqid('NP'), 'estado' => EstadoOrden::Aprobada, ...$datos]);
    }

    public function test_sin_permiso_no_se_elimina_nada(): void
    {
        $empresa = Empresa::create(['nombre' => 'Vacía']);
        $this->actingAs(User::factory()->coordinador()->create());

        $this->delete("/empresas/{$empresa->id}")->assertForbidden();
        $this->delete('/usuarios/'.$this->admin->id)->assertForbidden();
        $this->assertModelExists($empresa);
    }

    public function test_una_empresa_sin_historial_se_elimina_y_con_sedes_no(): void
    {
        $vacia = Empresa::create(['nombre' => 'Vacía', 'nit' => '900123456']);
        $vacia->lineas()->attach(LineaServicio::logistica());
        $this->delete("/empresas/{$vacia->id}")->assertSessionHas('success');
        $this->assertDatabaseMissing('empresas', ['id' => $vacia->id]);
        $this->assertDatabaseHas('bitacora', ['accion' => 'eliminada', 'modelo_tipo' => Empresa::class, 'modelo_id' => $vacia->id]);

        // Se borra del todo: su razón social y su NIT quedan libres
        $this->assertSame(0, Empresa::withTrashed()->where('nit', '900123456')->count());

        $sede = $this->sede('TuGo');
        $this->delete("/empresas/{$sede->empresa_id}")->assertSessionHas('error');
        $this->assertModelExists($sede->empresa);
    }

    public function test_sede_y_sucursal_con_operacion_no_se_eliminan(): void
    {
        $sede = $this->sede('TuGo');
        $sucursal = Sucursal::create(['nombre' => 'Cali Sur', 'sede_id' => $sede->id, 'ciudad' => 'Cali']);
        $this->delete("/sedes/{$sede->id}")->assertSessionHas('error');

        $orden = $this->orden(['sede_id' => $sede->id, 'sucursal_id' => $sucursal->id]);
        $this->delete("/sucursales/{$sucursal->id}")->assertSessionHas('error');
        $this->assertModelExists($sucursal);

        $orden->delete();
        $this->delete("/sucursales/{$sucursal->id}")->assertSessionHas('success');
        $this->assertDatabaseMissing('sucursales', ['id' => $sucursal->id]);
        $this->delete("/sedes/{$sede->id}")->assertSessionHas('success');
        $this->assertDatabaseMissing('sedes', ['id' => $sede->id]);
    }

    public function test_un_vehiculo_con_ordenes_no_se_elimina(): void
    {
        $vehiculo = Vehiculo::create(['placa' => 'SNX708']);
        $orden = $this->orden(['vehiculo_id' => $vehiculo->id, 'placa' => 'SNX708']);
        $this->delete("/vehiculos/{$vehiculo->id}")->assertSessionHas('error');
        $this->assertModelExists($vehiculo);

        $orden->delete();
        $this->delete("/vehiculos/{$vehiculo->id}")->assertSessionHas('success');
        $this->assertDatabaseMissing('vehiculos', ['id' => $vehiculo->id]);
    }

    public function test_un_usuario_con_historial_no_se_elimina_y_uno_sin_historial_si(): void
    {
        $conEntregas = User::factory()->sinAcceso()->create();
        $this->orden(['auxiliar_id' => $conEntregas->id]);
        $this->delete("/usuarios/{$conEntregas->id}")->assertSessionHas('error');
        $this->assertModelExists($conEntregas);

        $porError = User::factory()->sinAcceso()->create();
        $this->assertSame(1, $porError->asignaciones()->count());
        $this->delete("/usuarios/{$porError->id}")->assertSessionHas('success');
        $this->assertModelMissing($porError);
        $this->assertSame(0, Asignacion::where('user_id', $porError->id)->count());
    }

    public function test_nadie_se_elimina_a_si_mismo_ni_al_unico_administrador(): void
    {
        $this->delete('/usuarios/'.$this->admin->id)->assertSessionHas('error', 'No puedes eliminar tu propio usuario.');

        $otroAdmin = User::factory()->admin()->create();
        $this->actingAs($otroAdmin);
        User::whereKey($this->admin->id)->update(['activo' => false]);
        // Con el único administrador activo sin poder quitarse, tampoco a sí mismo
        $this->delete("/usuarios/{$otroAdmin->id}")->assertSessionHas('error');
        $this->assertModelExists($otroAdmin);
    }

    public function test_no_se_elimina_a_quien_tiene_mas_acceso(): void
    {
        $talento = RolUsuario::create(['nombre' => 'Talento', 'permisos' => ['usuarios.ver', 'usuarios.eliminar'], 'alcance' => 'todo', 'activo' => true]);
        $this->actingAs(User::factory()->create(['rol_id' => $talento->id]));

        $this->delete('/usuarios/'.$this->admin->id)->assertSessionHas('error');
        $this->assertModelExists($this->admin);
    }

    public function test_un_rol_base_o_con_personas_no_se_elimina(): void
    {
        $this->delete('/roles/'.$this->rolBase(Rol::Auxiliar))->assertSessionHas('error');

        $rol = RolUsuario::create(['nombre' => 'Conductor', 'permisos' => [], 'alcance' => 'propio', 'activo' => true]);
        $persona = User::factory()->sinAcceso()->create(['rol_id' => $rol->id]);
        $this->delete("/roles/{$rol->id}")->assertSessionHas('error');

        $persona->update(['rol_id' => $this->rolBase(Rol::Auxiliar)]);
        $this->delete("/roles/{$rol->id}")->assertSessionHas('success');
        $this->assertModelMissing($rol);
    }

    public function test_la_linea_de_drivin_o_una_con_empresas_no_se_elimina(): void
    {
        $this->delete('/lineas-de-servicio/'.LineaServicio::logistica()->id)->assertSessionHas('error');

        $nueva = LineaServicio::create(['nombre' => 'Fumigación', 'slug' => 'fumigacion', 'icono' => 'layers', 'orden' => 99, 'activa' => true]);
        $empresa = Empresa::create(['nombre' => 'Con línea']);
        $empresa->lineas()->attach($nueva);
        $this->delete("/lineas-de-servicio/{$nueva->id}")->assertSessionHas('error');

        $empresa->lineas()->detach($nueva);
        $this->delete("/lineas-de-servicio/{$nueva->id}")->assertSessionHas('success');
        $this->assertModelMissing($nueva);
    }

    public function test_catalogos_en_uso_no_se_eliminan(): void
    {
        $motivo = MotivoRechazo::create(['nombre' => 'Motivo de prueba']);
        $orden = $this->orden(['motivo_rechazo_id' => $motivo->id]);
        $this->delete("/parametros/motivos/{$motivo->id}")->assertSessionHas('error');
        $orden->delete();
        $this->delete("/parametros/motivos/{$motivo->id}")->assertSessionHas('success');
        $this->assertModelMissing($motivo);

        $sistema = TipoNovedad::firstOrCreate(['nombre' => TipoNovedad::DEL_SISTEMA[0]], ['severidad' => 'leve']);
        $this->delete("/parametros/novedades/{$sistema->id}")->assertSessionHas('error');
        $propio = TipoNovedad::create(['nombre' => 'Propio', 'severidad' => 'leve']);
        $this->delete("/parametros/novedades/{$propio->id}")->assertSessionHas('success');
        $this->assertModelMissing($propio);
    }

    public function test_una_asignacion_y_una_solicitud_se_eliminan(): void
    {
        $persona = User::factory()->sinAcceso()->create();
        $asignacion = $persona->asignaciones()->sole();
        $this->delete("/asignaciones/{$asignacion->id}")->assertSessionHas('success');
        $this->assertModelMissing($asignacion);
        $this->assertModelExists($persona);

        $solicitud = SolicitudContacto::create(['nombre' => 'Ana', 'email' => 'ana@ejemplo.com', 'mensaje' => 'Hola', 'autoriza_datos' => true]);
        $this->delete("/solicitudes/{$solicitud->id}")->assertSessionHas('success');
        $this->assertModelMissing($solicitud);
    }

    public function test_quien_asigna_no_elimina_lo_que_no_ve(): void
    {
        $persona = User::factory()->sinAcceso()->create(['empresa_id' => $this->empresa('Ajena')->id]);
        $rol = RolUsuario::create(['nombre' => 'Asigna', 'permisos' => ['asignaciones.ver', 'asignaciones.eliminar'], 'alcance' => 'asignacion', 'activo' => true]);
        $this->actingAs(User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $this->empresa('Suya')->id]));

        $this->delete('/asignaciones/'.$persona->asignaciones()->sole()->id)->assertSessionHas('error');
        $this->assertSame(1, $persona->asignaciones()->count());
    }

    public function test_una_accion_de_desempeno_se_modifica_y_solo_por_quien_la_registro(): void
    {
        $persona = User::factory()->sinAcceso()->create();
        $coordinador = User::factory()->coordinador()->create();
        $accion = AccionDesempeno::create([
            'user_id' => $persona->id, 'linea_servicio_id' => LineaServicio::logistica()->id, 'fecha' => today(),
            'tipo' => TipoAccion::Felicitacion, 'descripcion' => 'Buen trabajo', 'registrado_por' => $coordinador->id,
        ]);

        $this->actingAs($coordinador)->put("/seguimiento/acciones/{$accion->id}", ['tipo' => TipoAccion::Retroalimentacion->value, 'descripcion' => 'Corregida'])->assertSessionHas('success');
        $this->assertSame(TipoAccion::Retroalimentacion, $accion->fresh()->tipo);
        $this->assertSame('Corregida', $accion->fresh()->descripcion);

        // El detalle es opcional: se puede dejar en blanco, al corregir y al registrar
        $this->put("/seguimiento/acciones/{$accion->id}", ['tipo' => TipoAccion::Felicitacion->value, 'descripcion' => ''])->assertSessionHas('success');
        $this->post('/seguimiento/acciones', ['user_id' => $persona->id, 'tipo' => TipoAccion::Felicitacion->value])->assertSessionHas('success');

        $this->actingAs(User::factory()->coordinador()->create())->put("/seguimiento/acciones/{$accion->id}", ['tipo' => TipoAccion::Felicitacion->value])->assertForbidden();
    }

    public function test_el_permiso_de_eliminar_se_puede_dar_en_un_rol(): void
    {
        $empresa = Empresa::create(['nombre' => 'Vacía']);
        $rol = RolUsuario::create(['nombre' => 'Clientes', 'permisos' => ['empresas.eliminar'], 'alcance' => 'todo', 'activo' => true]);
        $this->actingAs(User::factory()->create(['rol_id' => $rol->id]));

        $this->delete("/empresas/{$empresa->id}")->assertSessionHas('success');
        $this->assertDatabaseMissing('empresas', ['id' => $empresa->id]);
    }
}
