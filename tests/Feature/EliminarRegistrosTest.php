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
use App\Models\Programacion;
use App\Models\RolUsuario;
use App\Models\SolicitudContacto;
use App\Models\Sucursal;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Eliminar pide confirmación en la pantalla y aquí, su propio permiso. Nada se borra de la base: lo eliminado queda
 * marcado (deleted_at), deja de verse y su rastro queda en la bitácora. Lo que lo referencia (órdenes, informes…) se
 * conserva, y quienes estaban asignados a lo eliminado quedan sin esa asignación (termina ayer, sigue en su historial).
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

    public function test_una_empresa_se_elimina_sin_borrarse_con_sus_sedes_y_su_personal_queda_sin_asignacion(): void
    {
        $vacia = Empresa::create(['nombre' => 'Vacía', 'nit' => '900123456']);
        $vacia->lineas()->attach(LineaServicio::logistica());
        $this->delete("/empresas/{$vacia->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($vacia);
        $this->assertDatabaseHas('bitacora', ['accion' => 'eliminada', 'modelo_tipo' => Empresa::class, 'modelo_id' => $vacia->id]);
        // Su razón social y su NIT quedan libres para una empresa nueva
        Empresa::create(['nombre' => 'Vacía', 'nit' => '900123456']);

        $sede = $this->sede('TuGo');
        $sucursal = Sucursal::create(['nombre' => 'Cali Sur', 'sede_id' => $sede->id, 'ciudad' => 'Cali']);
        $persona = User::factory()->sinAcceso()->create(['empresa_id' => $sede->empresa_id]);
        $persona->asignaciones()->update(['fecha_inicio' => today()->subMonth()]);
        $this->delete("/empresas/{$sede->empresa_id}")->assertSessionHas('success');

        $this->assertSoftDeleted($sede);
        $this->assertSoftDeleted($sucursal);
        $asignacion = $persona->asignaciones()->sole();
        $this->assertSame(today()->subDay()->toDateString(), $asignacion->fecha_fin->toDateString());
        $this->assertSame(0, $persona->asignacionesVigentes()->count());
    }

    public function test_sede_y_sucursal_se_eliminan_conservando_su_operacion_y_sin_dejar_a_nadie_asignado(): void
    {
        $sede = $this->sede('TuGo');
        $sucursal = Sucursal::create(['nombre' => 'Cali Sur', 'sede_id' => $sede->id, 'ciudad' => 'Cali']);
        $orden = $this->orden(['sede_id' => $sede->id, 'sucursal_id' => $sucursal->id]);
        $persona = User::factory()->sinAcceso()->create(['empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'sucursal_id' => $sucursal->id]);
        $persona->asignaciones()->update(['fecha_inicio' => today()->subMonth()]);
        $futura = Programacion::create(['fecha' => today()->addDays(2), 'linea_servicio_id' => LineaServicio::logistica()->id, 'empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'sucursal_id' => $sucursal->id, 'personas_requeridas' => 1]);

        $this->delete("/sucursales/{$sucursal->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($sucursal);
        // Su operación pasada se conserva; quien estaba asignado queda sin asignación y la programación por venir se quita
        $this->assertModelExists($orden);
        $this->assertSame($sucursal->id, $orden->fresh()->sucursal_id);
        $this->assertSame('Cali Sur', $orden->fresh()->sucursal->nombre);
        $this->assertSame(0, $persona->asignacionesVigentes()->count());
        $this->assertSoftDeleted($futura);

        // El nombre queda libre en la sede
        $this->post('/sucursales', ['nombre' => 'Cali Sur', 'ciudad' => 'Cali', 'sede_id' => $sede->id])->assertSessionHasNoErrors();

        $this->delete("/sedes/{$sede->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($sede);
        $this->assertSame(0, Sucursal::where('sede_id', $sede->id)->count());
    }

    public function test_un_vehiculo_se_elimina_conservando_sus_ordenes_y_su_placa_queda_libre(): void
    {
        $vehiculo = Vehiculo::create(['placa' => 'SNX708']);
        $orden = $this->orden(['vehiculo_id' => $vehiculo->id, 'placa' => 'SNX708']);
        $this->delete("/vehiculos/{$vehiculo->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($vehiculo);
        $this->assertSame($vehiculo->id, $orden->fresh()->vehiculo?->id);

        Vehiculo::create(['placa' => 'SNX708']);
        $this->assertSame(1, Vehiculo::where('placa', 'SNX708')->count());
    }

    public function test_un_usuario_se_elimina_conservando_su_historial(): void
    {
        $conEntregas = User::factory()->sinAcceso()->create(['cedula' => '1144203579']);
        $conEntregas->asignaciones()->update(['fecha_inicio' => today()->subMonth()]);
        $orden = $this->orden(['auxiliar_id' => $conEntregas->id]);
        $this->delete("/usuarios/{$conEntregas->id}")->assertSessionHas('success');

        $this->assertSoftDeleted($conEntregas);
        $this->assertFalse(User::withTrashed()->find($conEntregas->id)->activo);
        // Sus entregas siguen diciendo quién las hizo; su asignación terminó y sigue en su historial
        $this->assertSame($conEntregas->id, $orden->fresh()->auxiliar?->id);
        $this->assertSame(1, Asignacion::where('user_id', $conEntregas->id)->count());
        $this->assertSame(0, $conEntregas->asignacionesVigentes()->count());

        // Su cédula queda libre para registrarla de nuevo
        User::factory()->sinAcceso()->create(['cedula' => '1144203579']);
        $this->assertSame(1, User::where('cedula', '1144203579')->count());
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

    public function test_un_rol_base_no_se_elimina_y_uno_con_personas_las_pasa_a_otro_rol(): void
    {
        $this->delete('/roles/'.$this->rolBase(Rol::Auxiliar))->assertSessionHas('error');

        $rol = RolUsuario::create(['nombre' => 'Conductor', 'permisos' => [], 'alcance' => 'propio', 'activo' => true]);
        $persona = User::factory()->sinAcceso()->create(['rol_id' => $rol->id]);
        // Nadie queda sin rol: hay que elegir a cuál pasan
        $this->delete("/roles/{$rol->id}")->assertSessionHasErrors(['pasar_a']);
        $this->assertNotSoftDeleted($rol);

        $this->delete("/roles/{$rol->id}", ['pasar_a' => $this->rolBase(Rol::Auxiliar)])->assertSessionHas('success');
        $this->assertSoftDeleted($rol);
        $this->assertSame($this->rolBase(Rol::Auxiliar), $persona->fresh()->rol_id);
        $this->assertDatabaseHas('bitacora', ['accion' => 'eliminada', 'modelo_tipo' => RolUsuario::class, 'modelo_id' => $rol->id]);
    }

    public function test_la_linea_de_drivin_no_se_elimina_y_otra_si_sin_dejar_a_nadie_en_ella(): void
    {
        $this->delete('/lineas-de-servicio/'.LineaServicio::logistica()->id)->assertSessionHas('error');

        $nueva = LineaServicio::create(['nombre' => 'Fumigación', 'slug' => 'fumigacion', 'icono' => 'layers', 'orden' => 99, 'activa' => true]);
        $empresa = Empresa::create(['nombre' => 'Con línea']);
        $empresa->lineas()->attach($nueva);
        $soloEsta = User::factory()->sinAcceso()->create(['empresa_id' => $empresa->id, 'linea_servicio_id' => $nueva->id]);
        $soloEsta->asignaciones()->update(['fecha_inicio' => today()->subMonth()]);

        $this->delete("/lineas-de-servicio/{$nueva->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($nueva);
        $this->assertSame(0, $soloEsta->asignacionesVigentes()->count());
    }

    public function test_los_catalogos_se_eliminan_y_lo_que_los_usa_los_conserva(): void
    {
        $motivo = MotivoRechazo::create(['nombre' => 'Motivo de prueba']);
        $orden = $this->orden(['motivo_rechazo_id' => $motivo->id]);
        $this->delete("/parametros/motivos/{$motivo->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($motivo);
        $this->assertSame('Motivo de prueba', $orden->fresh()->motivoRechazo?->nombre);

        $sistema = TipoNovedad::firstOrCreate(['nombre' => TipoNovedad::DEL_SISTEMA[0]], ['severidad' => 'leve']);
        $this->delete("/parametros/novedades/{$sistema->id}")->assertSessionHas('error');
        $propio = TipoNovedad::create(['nombre' => 'Propio', 'severidad' => 'leve']);
        $this->delete("/parametros/novedades/{$propio->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($propio);
    }

    public function test_una_asignacion_y_una_solicitud_se_eliminan_sin_borrarse(): void
    {
        $persona = User::factory()->sinAcceso()->create();
        $asignacion = $persona->asignaciones()->sole();
        $this->delete("/asignaciones/{$asignacion->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($asignacion);
        $this->assertModelExists($persona);

        $solicitud = SolicitudContacto::create(['nombre' => 'Ana', 'email' => 'ana@ejemplo.com', 'mensaje' => 'Hola', 'autoriza_datos' => true]);
        $this->delete("/solicitudes/{$solicitud->id}")->assertSessionHas('success');
        $this->assertSoftDeleted($solicitud);
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
        $this->assertSoftDeleted($empresa);
    }
}
