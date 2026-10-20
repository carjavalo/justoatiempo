<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\Carga;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Nadie gana más acceso del que su rol le da: ni quitándose sus propios límites, ni volviendo un rol cualquiera en
 * el Administrador, ni dejando la plataforma sin quien la gestione.
 */
class PermisosSeguridadTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function rol(array $permisos, string $alcance, string $nombre): RolUsuario
    {
        return RolUsuario::create(['nombre' => $nombre, 'permisos' => $permisos, 'alcance' => $alcance, 'activo' => true]);
    }

    private function datosUsuario(User|array $base, array $extra = []): array
    {
        $u = $base instanceof User ? [
            'nombres' => $base->nombres ?? 'Ana', 'primer_apellido' => $base->primer_apellido ?? 'Torres', 'email' => $base->email,
            'cargo' => $base->cargo ?? 'Supervisora', 'rol_id' => $base->rol_id, 'empresa_id' => $base->empresa_id ?? '',
            'sede_id' => $base->sede_id ?? '', 'sucursal_id' => $base->sucursal_id ?? '', 'linea_id' => $base->linea_servicio_id ?? 'todas',
        ] : $base;

        return [...$u, ...$extra];
    }

    public function test_quien_ve_solo_su_empresa_no_se_quita_ese_limite(): void
    {
        $ditranza = $this->empresa();
        $rol = $this->rol(['usuarios.ver', 'usuarios.crear', 'usuarios.editar', 'tablero.ver', 'cargas.ver'], Permisos::ALCANCE_ASIGNACION, 'Supervisor cliente');
        $supervisora = User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $ditranza->id]);
        $this->actingAs($supervisora)->get('/cargas')->assertForbidden();

        // Ni editándose sin empresa…
        $this->actingAs($supervisora)->put("/usuarios/{$supervisora->id}", $this->datosUsuario($supervisora, ['empresa_id' => '']))
            ->assertSessionHasErrors(['empresa_id' => 'Solo puedes asignar personas a tu empresa (Ditranza).']);
        $this->assertSame($ditranza->id, $supervisora->fresh()->empresa_id);

        // …ni creando una cuenta gemela sin empresa
        $this->actingAs($supervisora)->post('/usuarios', $this->datosUsuario($supervisora, [
            'email' => 'gemela@example.com', 'empresa_id' => '', 'password' => 'Clave-segura-1',
        ]))->assertSessionHasErrors('empresa_id');
        $this->assertDatabaseMissing('users', ['email' => 'gemela@example.com']);

        // Dentro de su empresa, sí
        $this->actingAs($supervisora)->post('/usuarios', $this->datosUsuario($supervisora, [
            'email' => 'nueva@example.com', 'password' => 'Clave-segura-1',
        ]))->assertSessionHasNoErrors();
        $this->actingAs($supervisora)->get('/cargas')->assertForbidden();
    }

    public function test_quien_ve_solo_su_linea_no_se_cambia_a_otra(): void
    {
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $rol = $this->rol(['usuarios.ver', 'usuarios.editar', 'tablero.ver', 'auditoria.ver'], Permisos::ALCANCE_TODO, 'Coordinador de aseo');
        $coordinador = User::factory()->create(['rol_id' => $rol->id, 'linea_servicio_id' => $aseo->id]);
        $this->actingAs($coordinador)->get('/auditoria')->assertForbidden();

        $this->actingAs($coordinador)->put("/usuarios/{$coordinador->id}", $this->datosUsuario($coordinador, ['linea_id' => LineaServicio::logistica()->id]))
            ->assertSessionHasErrors(['linea_id' => "Solo puedes asignar personas a tu línea de servicio ({$aseo->nombre})."]);
        $this->actingAs($coordinador->fresh())->get('/auditoria')->assertForbidden();
    }

    public function test_quien_ve_solo_su_empresa_administra_solo_a_su_personal(): void
    {
        $ditranza = $this->empresa();
        $otra = $this->empresa('Logística Sur');
        $rol = $this->rol(['usuarios.ver', 'usuarios.estado', 'tablero.ver', 'roles.ver', 'empresas.ver'], Permisos::ALCANCE_ASIGNACION, 'Talento cliente');
        $talento = User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $ditranza->id]);
        $deDitranza = User::factory()->create(['empresa_id' => $ditranza->id]);
        $deOtra = User::factory()->create(['empresa_id' => $otra->id]);

        $this->actingAs($talento)->get('/usuarios')->assertInertia(fn (Assert $p) => $p
            ->where('usuarios.data', fn ($filas) => collect($filas)->pluck('id')->sort()->values()->all() === collect([$talento->id, $deDitranza->id])->sort()->values()->all())
            ->where('limites.empresaId', $ditranza->id)
            ->has('empresas', 1));
        foreach (['carnet', 'foto', 'arl'] as $parte) {
            $this->actingAs($talento)->get("/usuarios/{$deOtra->id}/{$parte}")->assertNotFound();
        }
        $this->actingAs($talento)->patch("/usuarios/{$deOtra->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($deOtra->fresh()->activo);

        // Los módulos que reúnen a todas las empresas no se le abren
        $this->actingAs($talento)->get('/roles')->assertForbidden();
        $this->actingAs($talento)->get('/empresas')->assertForbidden();
        $this->actingAs($talento)->get('/panel')->assertInertia(fn (Assert $p) => $p->where('resumen.usuarios.total', 2)->missing('resumen.roles'));
    }

    public function test_solo_lo_suyo_no_abre_la_operacion_de_los_demas(): void
    {
        $rol = $this->rol(['tablero.ver', 'auditoria.subir', 'cargas.ver', 'usuarios.ver'], Permisos::ALCANCE_PROPIO, 'Auxiliar que sube');
        // Al guardar, con "solo lo suyo" quedan únicamente el tablero (y Mis entregas)
        $this->assertSame(['tablero.ver'], $rol->permisos);

        $auxiliar = User::factory()->create(['rol_id' => $rol->id]);
        $this->actingAs($auxiliar)->get('/auditoria')->assertForbidden();
        $this->actingAs($auxiliar)->get('/usuarios')->assertForbidden();

        // Aunque el permiso quedara en la base de datos, no le aplica
        $rol->forceFill(['permisos' => ['tablero.ver', 'auditoria.ver']])->saveQuietly();
        $this->actingAs($auxiliar->fresh())->get('/auditoria')->assertForbidden()
            ->assertInertia(fn (Assert $p) => $p->where('mensaje', 'Tu rol solo ve tu propia información: esta sección no está disponible.'));
    }

    public function test_el_tablero_solo_muestra_la_ultima_carga_a_quien_abre_cargas(): void
    {
        Carga::create(['archivo_nombre' => 'preliquidacion.xlsx', 'archivo_path' => 'cargas/x.xlsx', 'archivo_hash' => str_repeat('a', 64), 'estado' => 'procesada', 'total_filas' => 3, 'procesado_en' => now(), 'cargado_por' => $this->admin->id]);
        $soloTablero = User::factory()->create(['rol_id' => $this->rol(['tablero.ver'], Permisos::ALCANCE_ASIGNACION, 'Solo tablero')->id]);

        $this->actingAs($soloTablero)->get('/lineas/logisticos')->assertInertia(fn (Assert $p) => $p->where('pendientes.ultimaCarga', null));
        $this->actingAs($this->admin)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->where('pendientes.ultimaCarga.archivo_nombre', 'preliquidacion.xlsx'));
    }

    public function test_ver_todas_las_lineas_incluye_su_tablero(): void
    {
        $rol = $this->rol([Permisos::TODAS_LAS_LINEAS], Permisos::ALCANCE_TODO, 'Gerencia de líneas');
        $this->assertSame(['tablero.ver', Permisos::TODAS_LAS_LINEAS], $rol->permisos);

        $gerente = User::factory()->create(['rol_id' => $rol->id]);
        $this->actingAs($gerente)->get('/panel')->assertInertia(fn (Assert $p) => $p->has('lineas', LineaServicio::count()));
        $this->actingAs($gerente)->get('/lineas/aseo-general')->assertOk();
    }

    public function test_un_rol_base_no_se_vuelve_el_administrador(): void
    {
        $gestor = User::factory()->create(['rol_id' => $this->rol(
            ['usuarios.ver', 'usuarios.editar', 'roles.ver', 'roles.editar', 'tablero.ver', 'entregas.ver'], Permisos::ALCANCE_ASIGNACION, 'Gestor RRHH',
        )->id]);
        $auxiliar = RolUsuario::base(Rol::Auxiliar);

        $this->actingAs($gestor)->put("/roles/{$auxiliar->id}", [
            'nombre' => $auxiliar->nombre, 'permisos' => ['tablero.ver', 'entregas.ver'], 'alcance' => Permisos::ALCANCE_PROPIO,
        ])->assertSessionHasNoErrors();

        // Sigue siendo el auxiliar base: ni lo puede todo ni pasa por el Administrador
        $auxiliar->refresh();
        $this->assertFalse($auxiliar->esAdministradorBase());
        $this->assertSame(Rol::Auxiliar, $auxiliar->nivel);
        $this->assertSame($auxiliar->id, RolUsuario::base(Rol::Auxiliar)->id);
        $this->assertSame('administrador', RolUsuario::administrador()->clave);
    }

    public function test_siempre_queda_alguien_con_el_rol_administrador(): void
    {
        $gestor = $this->rol(['usuarios.ver', 'usuarios.editar', 'roles.ver', 'roles.editar'], Permisos::ALCANCE_TODO, 'Gestor');

        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", $this->datosUsuario($this->admin, ['rol_id' => $gestor->id, 'linea_id' => LineaServicio::logistica()->id]))
            ->assertSessionHasErrors(['rol_id' => 'Es la única persona activa con el rol Administrador: dáselo antes a otra persona.']);

        // Con otra persona activa con ese rol, sí se puede
        $otro = User::factory()->admin()->create();
        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", $this->datosUsuario($this->admin, ['rol_id' => $gestor->id, 'linea_id' => LineaServicio::logistica()->id]))
            ->assertSessionHasNoErrors();

        // Y a la última persona con el rol no se la desactiva
        $this->actingAs($otro)->patch("/usuarios/{$this->admin->id}/estado", ['activo' => false])->assertSessionHas('success');
        $tercero = User::factory()->create(['rol_id' => $this->rol(['usuarios.ver', 'usuarios.estado', 'usuarios.editar', 'roles.editar', 'roles.ver'], Permisos::ALCANCE_TODO, 'Soporte')->id]);
        $this->actingAs($tercero)->patch("/usuarios/{$otro->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($otro->fresh()->activo);
    }

    public function test_solo_quien_lo_tiene_todo_cambia_el_rol_administrador(): void
    {
        $administrador = RolUsuario::administrador();
        $editorDeRoles = User::factory()->create(['rol_id' => $this->rol(['roles.ver', 'roles.editar'], Permisos::ALCANCE_PROPIO, 'Editor de roles')->id]);

        $this->actingAs($editorDeRoles)->put("/roles/{$administrador->id}", ['nombre' => 'Sin acceso', 'permisos' => [], 'alcance' => Permisos::ALCANCE_PROPIO])
            ->assertForbidden();
        $this->assertSame('Administrador', $administrador->fresh()->nombre);
    }
}
