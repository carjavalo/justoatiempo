<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\SolicitudContacto;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Los roles dentro de la empresa (auxiliar, conductor, supervisor…): los crea la administración y en cada uno se
 * decide qué módulos ve quien lo tenga, qué puede hacer en cada uno y cuánto ve de la operación.
 */
class RolesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function rol(array $permisos, string $alcance = Permisos::ALCANCE_ASIGNACION, string $nombre = 'Rol de prueba'): RolUsuario
    {
        return RolUsuario::create(['nombre' => $nombre, 'permisos' => $permisos, 'alcance' => $alcance, 'activo' => true]);
    }

    private function persona(RolUsuario $rol, array $datos = []): User
    {
        return User::factory()->create(['rol_id' => $rol->id, ...$datos]);
    }

    /** Datos de un usuario nuevo con el rol dado. */
    private function usuario(int $rolId, array $extra = []): array
    {
        return [
            'nombres' => 'Carlos', 'primer_apellido' => 'Ruiz', 'email' => 'carlos@example.com', 'cargo' => 'Conductor',
            'rol_id' => $rolId, 'password' => 'Clave-segura-1', ...$extra,
        ];
    }

    /** Lo que envía el formulario de roles. */
    private function datosRol(array $permisos, string $alcance = Permisos::ALCANCE_ASIGNACION, string $nombre = 'Conductor'): array
    {
        return ['nombre' => $nombre, 'descripcion' => null, 'permisos' => $permisos, 'alcance' => $alcance];
    }

    // --- Roles base -------------------------------------------------------------------

    public function test_los_roles_base_traen_los_permisos_de_siempre(): void
    {
        $this->assertTrue(RolUsuario::base(Rol::Admin)->esTotal());

        $coordinador = RolUsuario::base(Rol::Coordinador);
        $this->assertSame(Permisos::ALCANCE_ASIGNACION, $coordinador->alcance);
        foreach (['tablero.ver', 'cargas.ver', 'cargas.subir', 'cargas.confirmar', 'auditoria.revisar'] as $permiso) {
            $this->assertTrue($coordinador->permite($permiso), $permiso);
        }
        $this->assertFalse($coordinador->permite('usuarios.ver'));

        $auxiliar = RolUsuario::base(Rol::Auxiliar);
        // El auxiliar operativo solo ve su carnet
        $this->assertSame([Permisos::ALCANCE_PROPIO, []], [$auxiliar->alcance, $auxiliar->permisos]);

        // Quien se crea con un nivel (p. ej. desde la consola) queda con su rol base
        $persona = User::factory()->coordinador()->create();
        $this->assertSame([$coordinador->id, 'Coordinador / Supervisor'], [$persona->rol_id, $persona->nombreRol()]);
    }

    public function test_el_administrador_de_la_plataforma_siempre_lo_puede_todo(): void
    {
        $base = RolUsuario::base(Rol::Admin);

        $this->actingAs($this->admin)->put("/roles/{$base->id}", $this->datosRol(['tablero.ver'], Permisos::ALCANCE_PROPIO, 'Gerencia'))
            ->assertSessionHasNoErrors();

        // Cambia el nombre, pero no sus permisos
        $base->refresh();
        $this->assertSame('Gerencia', $base->nombre);
        $this->assertTrue($base->esTotal());

        $this->actingAs($this->admin)->patch("/roles/{$base->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($base->fresh()->activo);
    }

    // --- Crear y listar ----------------------------------------------------------------

    public function test_crea_un_rol_con_sus_permisos_y_se_asigna_a_un_usuario(): void
    {
        // Subir cargas incluye verlas y ver el tablero desde el que se usan
        $this->actingAs($this->admin)->post('/roles', $this->datosRol(['cargas.subir'], Permisos::ALCANCE_TODO))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Rol creado: Conductor. Ya puedes asignarlo al crear usuarios.');

        $conductor = RolUsuario::where('nombre', 'Conductor')->sole();
        $this->assertSame(['tablero.ver', 'cargas.ver', 'cargas.subir'], $conductor->permisos);
        $this->assertSame([Permisos::ALCANCE_TODO, false, true], [$conductor->alcance, $conductor->base, $conductor->activo]);

        $this->actingAs($this->admin)->post('/usuarios', $this->usuario($conductor->id))->assertSessionHasNoErrors();
        $carlos = User::where('email', 'carlos@example.com')->sole();
        $this->assertSame([$conductor->id, 'Conductor'], [$carlos->rol_id, $carlos->nombreRol()]);
        // Las herramientas de logística le aplican cuando se le asigna esa línea
        $this->assertSame(['tablero.ver'], $carlos->permisos());
        $this->actingAs($this->admin)->post('/asignaciones', [
            'usuario_id' => $carlos->id, 'lineas' => [LineaServicio::logistica()->id], 'fecha_inicio' => today()->toDateString(), 'duracion' => 'indefinida',
        ])->assertSessionHasNoErrors();
        $this->assertSame(['tablero.ver', 'cargas.ver', 'cargas.subir'], $carlos->fresh()->permisos());
    }

    public function test_lista_los_roles_con_lo_que_ven_y_sus_usuarios(): void
    {
        $conductor = $this->rol(['tablero.ver', 'cargas.ver'], Permisos::ALCANCE_TODO, 'Conductor');
        $this->persona($conductor);
        $this->persona($conductor);

        $this->actingAs($this->admin)->get('/roles?q=conduc')
            ->assertInertia(fn (Assert $p) => $p->component('roles/index')
                ->where('total', 4)
                ->has('roles.data', 1)
                ->where('roles.data.0.nombre', 'Conductor')
                ->where('roles.data.0.resumen', 'Tablero de la línea y Cargas Drivin')
                ->where('roles.data.0.alcance', Permisos::ALCANCE_TODO)
                ->where('roles.data.0.usuarios', 2)
                ->where('roles.data.0.editable', true)
                ->has('catalogo', count(Permisos::CATALOGO))
                ->has('alcances', 3)
                ->has('modelos', 4));

        $this->actingAs($this->admin)->get("/usuarios?rol={$conductor->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 2)->where('usuarios.data.0.rolNombre', 'Conductor'));
    }

    public function test_valida_el_nombre_los_permisos_y_el_alcance(): void
    {
        $this->actingAs($this->admin)->post('/roles', ['nombre' => '', 'permisos' => ['inventado.ver'], 'alcance' => 'mucho'])
            ->assertSessionHasErrors(['nombre' => 'Escribe el nombre del rol.', 'permisos.0', 'alcance']);
        $this->actingAs($this->admin)->post('/roles', $this->datosRol([], Permisos::ALCANCE_PROPIO, 'administrador'))
            ->assertSessionHasErrors(['nombre' => 'Ya hay un rol con este nombre.']);

        // Sin permisos es válido: quien lo tenga solo verá su carnet
        $this->actingAs($this->admin)->post('/roles', $this->datosRol([], Permisos::ALCANCE_PROPIO, 'Visitante'))->assertSessionHasNoErrors();
        $this->assertSame('Solo su carnet', RolUsuario::where('nombre', 'Visitante')->sole()->resumen());
    }

    // --- Lo que abre cada permiso ------------------------------------------------------

    public function test_cada_accion_pide_su_permiso(): void
    {
        $consulta = $this->persona($this->rol(['usuarios.ver', 'usuarios.crear'], Permisos::ALCANCE_ASIGNACION, 'Talento humano'));
        $otro = User::factory()->create();

        $this->actingAs($consulta)->get('/usuarios')->assertOk();
        $this->actingAs($consulta)->get("/usuarios/{$otro->id}/carnet")->assertOk();
        // Crear sí; editar, desactivar y los demás módulos no
        $visitante = $this->rol([], Permisos::ALCANCE_PROPIO, 'Visitante');
        $this->actingAs($consulta)->post('/usuarios', $this->usuario($visitante->id))->assertSessionHasNoErrors();
        $this->actingAs($consulta)->put("/usuarios/{$otro->id}", $this->usuario($otro->rol_id, ['email' => $otro->email]))->assertForbidden();
        $this->actingAs($consulta)->patch("/usuarios/{$otro->id}/estado", ['activo' => false])->assertForbidden();
        foreach (['/roles', '/empresas', '/sedes', '/sucursales', '/solicitudes', '/cargas', '/lineas/logisticos'] as $url) {
            $this->actingAs($consulta)->get($url)->assertForbidden();
        }

        // El aviso dice la causa
        $this->actingAs($consulta)->get('/empresas')
            ->assertInertia(fn (Assert $p) => $p->component('error')->where('mensaje', 'Tu rol no tiene permiso para entrar a esta sección.'));

        // Su inicio y su menú muestran solo lo suyo, y las pantallas reciben sus permisos
        $this->actingAs($consulta)->get('/panel')
            ->assertInertia(fn (Assert $p) => $p->component('panel')
                ->where('menu', [
                    ['titulo' => null, 'items' => [['titulo' => 'Inicio', 'href' => '/panel', 'icono' => 'inicio', 'linea' => null, 'rutas' => ['/panel'], 'contador' => null]]],
                    ['titulo' => 'Personas', 'items' => [['titulo' => 'Usuarios', 'href' => '/usuarios', 'icono' => 'usuarios', 'linea' => null, 'rutas' => ['/usuarios'], 'contador' => null]]],
                ])
                ->where('pendientes', [])
                ->where('lineas', [])
                ->where('auth.permisos', ['usuarios.ver', 'usuarios.crear']));
    }

    public function test_quien_no_administra_nada_entra_a_su_linea_y_sin_tablero_ve_su_carnet(): void
    {
        $conductor = $this->persona($this->rol(['tablero.ver'], Permisos::ALCANCE_PROPIO, 'Conductor'));
        $this->actingAs($conductor)->get('/panel')->assertRedirect('/lineas/logisticos');

        // Sin módulos, su inicio es su carnet
        $visitante = $this->persona($this->rol([], Permisos::ALCANCE_PROPIO, 'Visitante'));
        $this->actingAs($visitante)->get('/panel')->assertRedirect('/mi-carnet');
        $this->actingAs($visitante)->get('/lineas/logisticos')->assertForbidden();
        $this->actingAs($visitante)->get('/mi-carnet')->assertOk();
    }

    public function test_cambiar_los_permisos_de_un_rol_aplica_de_inmediato_a_quienes_lo_tienen(): void
    {
        $coordinador = User::factory()->coordinador()->create();
        $this->actingAs($coordinador)->get('/cargas')->assertOk();

        $rol = RolUsuario::base(Rol::Coordinador);
        $this->actingAs($this->admin)->put("/roles/{$rol->id}", $this->datosRol(['tablero.ver', 'auditoria.ver'], Permisos::ALCANCE_ASIGNACION, $rol->nombre))
            ->assertSessionHas('success', "Cambios guardados en el rol {$rol->nombre}: ya aplican a la persona que lo tiene.");

        $this->actingAs($coordinador->fresh())->get('/cargas')->assertForbidden();
        $this->actingAs($coordinador->fresh())->get('/auditoria')->assertOk();
    }

    // --- Alcance y líneas -------------------------------------------------------------

    public function test_el_alcance_decide_si_ve_toda_la_operacion_aunque_tenga_empresa(): void
    {
        $empresa = $this->empresa();
        $permisos = ['tablero.ver', 'cargas.ver'];
        $deSuEmpresa = $this->persona($this->rol($permisos, Permisos::ALCANCE_ASIGNACION, 'Supervisor de cliente'), ['empresa_id' => $empresa->id]);
        $deTodo = $this->persona($this->rol($permisos, Permisos::ALCANCE_TODO, 'Supervisor general'), ['empresa_id' => $empresa->id]);

        $this->assertSame([$empresa->id], $deSuEmpresa->alcanceEn()->empresas());
        $this->actingAs($deSuEmpresa)->get('/cargas')->assertForbidden()
            ->assertInertia(fn (Assert $p) => $p->where('mensaje', 'Esta sección reúne la operación de todas las empresas: no está disponible para quien solo ve las suyas.'));

        $this->assertTrue($deTodo->alcanceEn()->todo);
        $this->actingAs($deTodo)->get('/cargas')->assertOk();
        $this->actingAs($deTodo)->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p->where('alcanceFijo', null)->where('vista', 'gerencial'));

        // Con "solo lo suyo", el tablero muestra únicamente su desempeño
        $propio = $this->persona($this->rol(['tablero.ver'], Permisos::ALCANCE_PROPIO, 'Conductor'));
        $this->actingAs($propio)->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p->where('vista', 'auxiliar'));
    }

    public function test_ver_todas_las_lineas_es_un_permiso(): void
    {
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $soloLaSuya = $this->persona($this->rol(['tablero.ver', 'cargas.ver'], Permisos::ALCANCE_TODO, 'Supervisor'));
        $todas = $this->persona($this->rol(['tablero.ver', Permisos::TODAS_LAS_LINEAS], Permisos::ALCANCE_TODO, 'Gerente de operaciones'), ['linea_servicio_id' => $aseo->id]);

        $this->actingAs($soloLaSuya)->get('/lineas/aseo-general')->assertForbidden();
        $this->actingAs($todas)->get('/lineas/logisticos')->assertOk();
        $this->actingAs($todas)->get('/lineas/aseo-general')->assertOk();
        // Las herramientas de logística son de quien trabaja en ella o ve todas las líneas
        $deAseo = $this->persona($soloLaSuya->rolUsuario, ['linea_servicio_id' => $aseo->id]);
        $this->actingAs($deAseo)->get('/cargas')->assertForbidden()
            ->assertInertia(fn (Assert $p) => $p->where('mensaje', 'Esta herramienta es de otra línea de servicio.'));

        // Su panel muestra todas las líneas
        $this->actingAs($todas)->get('/panel')->assertInertia(fn (Assert $p) => $p->has('lineas', LineaServicio::activas()->count()));
    }

    // --- Nadie da ni toma más acceso del que tiene -------------------------------------

    public function test_solo_se_dan_permisos_que_el_propio_rol_tiene(): void
    {
        $gestor = $this->persona($this->rol(['roles.ver', 'roles.crear', 'roles.editar', 'tablero.ver'], Permisos::ALCANCE_ASIGNACION, 'Gestor de roles'));

        $this->actingAs($gestor)->post('/roles', $this->datosRol(['tablero.ver', 'usuarios.ver']))
            ->assertSessionHasErrors(['permisos' => 'Solo puedes dar permisos que tu propio rol tiene. Quita: «Usuarios: Ver».']);
        $this->actingAs($gestor)->post('/roles', $this->datosRol(['tablero.ver'], Permisos::ALCANCE_TODO))
            ->assertSessionHasErrors(['alcance' => 'Tu propio rol no ve tanto de la operación: elige un alcance igual o más limitado que el tuyo.']);
        $this->actingAs($gestor)->post('/roles', $this->datosRol(['tablero.ver'], Permisos::ALCANCE_PROPIO))->assertSessionHasNoErrors();

        // Tampoco cambia un rol con más acceso que el suyo
        $base = RolUsuario::base(Rol::Coordinador);
        $this->actingAs($gestor)->put("/roles/{$base->id}", $this->datosRol(['tablero.ver'], Permisos::ALCANCE_ASIGNACION, $base->nombre))
            ->assertSessionHasErrors(['permisos' => 'Este rol tiene permisos que el tuyo no tiene: no puedes cambiarlo.']);
        $this->actingAs($gestor)->get('/roles')->assertInertia(fn (Assert $p) => $p->where('roles.data', fn ($filas) => collect($filas)
            ->firstWhere('nombre', 'Coordinador / Supervisor')['editable'] === false));
    }

    public function test_nadie_se_quita_lo_que_necesita_para_corregir_su_rol(): void
    {
        $permisos = ['usuarios.ver', 'usuarios.editar', 'roles.ver', 'roles.editar'];
        $rol = $this->rol($permisos, Permisos::ALCANCE_TODO, 'Coordinador de talento');
        $persona = $this->persona($rol);

        $this->actingAs($persona)->put("/roles/{$rol->id}", $this->datosRol(['usuarios.ver', 'roles.ver', 'roles.editar'], Permisos::ALCANCE_TODO, $rol->nombre))
            ->assertSessionHasErrors(['permisos' => 'No puedes quitarle a tu propio rol «Usuarios: Editar»: pídeselo a otra persona con ese permiso.']);
        $this->assertSame($permisos, $rol->fresh()->permisos);
    }

    public function test_solo_se_asignan_y_editan_personas_con_igual_o_menos_acceso(): void
    {
        $talento = $this->persona($this->rol(['usuarios.ver', 'usuarios.crear', 'usuarios.editar', 'usuarios.estado', 'tablero.ver', 'entregas.ver'], Permisos::ALCANCE_ASIGNACION, 'Talento humano'));

        // No crea administradores…
        $this->actingAs($talento)->post('/usuarios', $this->usuario(RolUsuario::base(Rol::Admin)->id))
            ->assertSessionHasErrors(['rol_id' => 'Este rol tiene permisos que el tuyo no tiene: no puedes asignarlo.']);
        // …ni edita ni desactiva a quien tiene más acceso (podría tomar su cuenta)
        $this->actingAs($talento)->put("/usuarios/{$this->admin->id}", $this->usuario($this->admin->rol_id, ['email' => $this->admin->email]))
            ->assertForbidden();
        $this->actingAs($talento)->patch("/usuarios/{$this->admin->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($this->admin->fresh()->activo);

        // A quien tiene menos acceso, sí
        $auxiliar = User::factory()->create();
        $this->actingAs($talento)->patch("/usuarios/{$auxiliar->id}/estado", ['activo' => false])->assertSessionHas('success');
        $this->actingAs($talento)->get('/usuarios')->assertInertia(fn (Assert $p) => $p
            // Solo ve a los de su línea (el administrador, que las ve todas, no le aparece) y puede editarlos
            ->where('usuarios.data', fn ($filas) => collect($filas)->firstWhere('id', $this->admin->id) === null
                && collect($filas)->firstWhere('id', $auxiliar->id)['editable'] === true)
            ->where('roles', fn ($roles) => collect($roles)->firstWhere('nombre', 'Administrador')['asignable'] === false));
    }

    // --- Estado y otros ----------------------------------------------------------------

    public function test_un_rol_inactivo_no_se_asigna_pero_quien_lo_tiene_lo_conserva(): void
    {
        $conductor = $this->rol(['tablero.ver'], Permisos::ALCANCE_PROPIO, 'Conductor');
        $ana = $this->persona($conductor, ['cargo' => 'Conductora']);

        $this->actingAs($this->admin)->patch("/roles/{$conductor->id}/estado", ['activo' => false])->assertSessionHas('success');
        $this->assertFalse($conductor->fresh()->activo);

        $this->actingAs($this->admin)->post('/usuarios', $this->usuario($conductor->id))
            ->assertSessionHasErrors(['rol_id' => 'Este rol está inactivo: actívalo en Roles antes de asignarlo.']);

        // Al editar a quien ya lo tiene, lo conserva
        $this->actingAs($this->admin)->put("/usuarios/{$ana->id}", [...$this->usuario($conductor->id), 'email' => $ana->email, 'password' => ''])
            ->assertSessionHasNoErrors();
        $this->assertSame($conductor->id, $ana->fresh()->rol_id);

        // Los roles base no se desactivan
        $base = RolUsuario::base(Rol::Auxiliar);
        $this->actingAs($this->admin)->patch("/roles/{$base->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($base->fresh()->activo);
    }

    public function test_las_solicitudes_del_sitio_avisan_a_quienes_las_atienden(): void
    {
        config(['mail.contacto' => null]);
        $comercial = $this->persona($this->rol(['solicitudes.atender'], Permisos::ALCANCE_TODO, 'Comercial'), ['email' => 'comercial@example.com']);
        User::factory()->coordinador()->create(['email' => 'coordinador@example.com']);

        $this->assertSame([$this->admin->email, $comercial->email], SolicitudContacto::destinatarios());
    }

    public function test_un_rol_con_usuarios_no_se_borra(): void
    {
        $conductor = $this->rol(['tablero.ver'], Permisos::ALCANCE_PROPIO, 'Conductor');
        $this->persona($conductor);

        $this->expectException(QueryException::class);
        $conductor->delete();
    }
}
