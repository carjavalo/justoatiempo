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

    /** Lo que envía el formulario de usuarios al editar a alguien sin cambiar nada. */
    private function datosUsuario(User $base, array $extra = []): array
    {
        return [
            'nombres' => $base->nombres ?? 'Ana', 'primer_apellido' => $base->primer_apellido ?? 'Torres', 'email' => $base->email,
            'cargo' => $base->cargo ?? 'Supervisora', 'rol_id' => $base->rol_id, ...$extra,
        ];
    }

    /** Lo que envía el formulario de asignaciones. */
    private function asignacion(?User $persona, array $extra = []): array
    {
        return [
            ...($persona ? ['usuario_id' => $persona->id] : []),
            'empresa_id' => '', 'sede_id' => '', 'sucursal_id' => '', 'lineas' => [LineaServicio::logistica()->id],
            'fecha_inicio' => today()->toDateString(), 'duracion' => 'indefinida', ...$extra,
        ];
    }

    public function test_quien_ve_solo_su_empresa_no_se_quita_ese_limite(): void
    {
        $ditranza = $this->empresa();
        $otra = $this->empresa('Logística Sur');
        $rol = $this->rol(
            ['usuarios.ver', 'usuarios.crear', 'asignaciones.ver', 'asignaciones.crear', 'asignaciones.editar', 'asignaciones.terminar', 'tablero.ver', 'cargas.ver'],
            Permisos::ALCANCE_ASIGNACION,
            'Supervisor cliente',
        );
        $supervisora = User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $ditranza->id]);
        $this->actingAs($supervisora)->get('/cargas')->assertForbidden();

        // Ni asignándose a sí misma a toda la línea…
        $this->actingAs($supervisora)->post('/asignaciones', $this->asignacion($supervisora))
            ->assertSessionHasErrors(['usuario_id' => 'No puedes cambiar tus propias asignaciones: pídeselo a otra persona.']);
        // …ni terminando su propia asignación…
        $suya = $supervisora->asignaciones()->sole();
        $this->actingAs($supervisora)->patch("/asignaciones/{$suya->id}/terminar")->assertSessionHas('error');
        $this->assertNull($suya->fresh()->fecha_fin);

        // …ni con una cuenta gemela: a otra persona solo la asigna a su empresa
        $gemela = User::factory()->create(['rol_id' => $rol->id, 'linea_servicio_id' => null]);
        $this->actingAs($supervisora)->post('/asignaciones', $this->asignacion($gemela))
            ->assertSessionHasErrors(['empresa_id' => 'En «'.LineaServicio::logistica()->nombre.'» solo puedes asignar personas a los lugares donde tú trabajas.']);
        $this->actingAs($supervisora)->post('/asignaciones', $this->asignacion($gemela, ['empresa_id' => $otra->id]))
            ->assertSessionHasErrors(['empresa_id' => 'En «'.LineaServicio::logistica()->nombre.'» solo puedes asignar personas a los lugares donde tú trabajas.']);
        $this->actingAs($gemela)->get('/cargas')->assertForbidden();

        // Dentro de su empresa, sí
        $this->actingAs($supervisora)->post('/asignaciones', $this->asignacion($gemela, ['empresa_id' => $ditranza->id]))->assertSessionHasNoErrors();
        $this->actingAs($gemela->fresh())->get('/cargas')->assertForbidden();
    }

    public function test_quien_ve_solo_su_linea_no_asigna_otra(): void
    {
        $aseo = LineaServicio::where('slug', 'aseo-general')->sole();
        $rol = $this->rol(['usuarios.ver', 'asignaciones.ver', 'asignaciones.crear', 'tablero.ver', 'auditoria.ver'], Permisos::ALCANCE_TODO, 'Coordinador de aseo');
        $coordinador = User::factory()->create(['rol_id' => $rol->id, 'linea_servicio_id' => $aseo->id]);
        $nueva = User::factory()->create(['rol_id' => $rol->id, 'linea_servicio_id' => null]);
        $this->actingAs($coordinador)->get('/auditoria')->assertForbidden();

        $this->actingAs($coordinador)->post('/asignaciones', $this->asignacion($nueva))
            ->assertSessionHasErrors(['lineas' => 'No trabajas en «'.LineaServicio::logistica()->nombre.'»: solo puedes asignar tus líneas de servicio.']);
        $this->actingAs($nueva->fresh())->get('/auditoria')->assertForbidden();

        $this->actingAs($coordinador)->post('/asignaciones', $this->asignacion($nueva, ['lineas' => [$aseo->id]]))->assertSessionHasNoErrors();
    }

    public function test_quien_ve_solo_su_empresa_administra_solo_a_su_personal(): void
    {
        $ditranza = $this->empresa();
        $otra = $this->empresa('Logística Sur');
        $rol = $this->rol(['usuarios.ver', 'usuarios.estado', 'tablero.ver', 'roles.ver', 'empresas.ver', 'asignaciones.ver'], Permisos::ALCANCE_ASIGNACION, 'Talento cliente');
        $talento = User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $ditranza->id]);
        $deDitranza = User::factory()->create(['empresa_id' => $ditranza->id]);
        $deOtra = User::factory()->create(['empresa_id' => $otra->id]);
        // Quien aún no tiene asignación sí se ve: hay que poder asignarlo
        $sinAsignar = User::factory()->create(['rol_id' => $this->rol([], Permisos::ALCANCE_PROPIO, 'Visitante')->id, 'linea_servicio_id' => null]);

        $this->actingAs($talento)->get('/usuarios')->assertInertia(fn (Assert $p) => $p
            ->where('usuarios.data', fn ($filas) => collect($filas)->pluck('id')->sort()->values()->all() === collect([$talento->id, $deDitranza->id, $sinAsignar->id])->sort()->values()->all()));
        foreach (['carnet', 'foto', 'arl'] as $parte) {
            $this->actingAs($talento)->get("/usuarios/{$deOtra->id}/{$parte}")->assertNotFound();
        }
        $this->actingAs($talento)->patch("/usuarios/{$deOtra->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($deOtra->fresh()->activo);

        // En Asignaciones tampoco ve a las de otras empresas
        $this->actingAs($talento)->get('/asignaciones')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('personas.data', fn ($filas) => ! collect($filas)->pluck('id')->contains($deOtra->id))
            ->has('opciones.empresas', 1)
            ->where('opciones.sinEmpresa', false));

        // Los módulos que reúnen a todas las empresas no se le abren
        $this->actingAs($talento)->get('/roles')->assertForbidden();
        $this->actingAs($talento)->get('/empresas')->assertForbidden();
        // Su menú: solo lo que su rol abre (sin roles ni empresas)
        $this->actingAs($talento)->get('/panel')->assertInertia(fn (Assert $p) => $p
            ->where('menu', fn ($menu) => collect($menu)->flatMap(fn ($g) => collect($g['items'])->pluck('titulo'))->intersect(['Roles', 'Empresas'])->isEmpty())
            ->where('menu', fn ($menu) => collect($menu)->flatMap(fn ($g) => collect($g['items'])->pluck('titulo'))->contains('Usuarios')));
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
            ->assertSessionHasErrors(['rol_id' => 'Es la única persona con el rol Administrador que puede entrar a la plataforma: dáselo antes a otra persona.']);

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
