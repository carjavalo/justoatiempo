<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Los roles dentro de la empresa (auxiliar, conductor, supervisor…): los crea la administración y cada uno da
 * un nivel de acceso en la plataforma a quien lo tenga.
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

    /** Datos de un usuario nuevo con el rol dado. */
    private function usuario(int $rolId, array $extra = []): array
    {
        return [
            'nombres' => 'Carlos', 'primer_apellido' => 'Ruiz', 'email' => 'carlos@example.com', 'cargo' => 'Conductor',
            'rol_id' => $rolId, 'empresa_id' => 'propia', 'linea_id' => LineaServicio::logistica()->id, 'password' => 'Clave-segura-1', ...$extra,
        ];
    }

    public function test_la_plataforma_trae_los_tres_roles_base_y_cada_usuario_tiene_el_suyo(): void
    {
        $this->assertSame(3, RolUsuario::where('base', true)->count());
        foreach (Rol::cases() as $nivel) {
            $this->assertSame($nivel, RolUsuario::base($nivel)->nivel);
        }

        // Quien se crea con un nivel (p. ej. desde la consola) queda con su rol base
        $coordinador = User::factory()->coordinador()->create();
        $this->assertSame($this->rolBase(Rol::Coordinador), $coordinador->rol_id);
        $this->assertSame('Coordinador / Supervisor', $coordinador->nombreRol());
    }

    public function test_solo_la_administracion_maneja_los_roles(): void
    {
        $coordinador = User::factory()->coordinador()->create();

        $this->actingAs($coordinador)->get('/roles')->assertForbidden();
        $this->actingAs($coordinador)->post('/roles', ['nombre' => 'Conductor', 'nivel' => 'auxiliar'])->assertForbidden();
        $this->assertDatabaseMissing('roles', ['nombre' => 'Conductor']);
    }

    public function test_lista_los_roles_con_su_acceso_y_sus_usuarios(): void
    {
        $conductor = RolUsuario::create(['nombre' => 'Conductor', 'nivel' => Rol::Auxiliar, 'activo' => true]);
        User::factory()->count(2)->create(['rol_id' => $conductor->id]);

        $this->actingAs($this->admin)->get('/roles?q=conduc')
            ->assertInertia(fn (Assert $p) => $p->component('roles/index')
                ->where('total', 4)
                ->has('roles.data', 1)
                ->where('roles.data.0.nombre', 'Conductor')
                ->where('roles.data.0.nivelLabel', 'Auxiliar operativo')
                ->where('roles.data.0.usuarios', 2)
                ->where('roles.data.0.base', false)
                ->has('niveles', 3));

        // Desde el conteo se llega a sus usuarios
        $this->actingAs($this->admin)->get("/usuarios?rol={$conductor->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 2)->where('usuarios.data.0.rolNombre', 'Conductor'));

        // El panel cuenta los roles activos
        $this->actingAs($this->admin)->get('/panel')->assertInertia(fn (Assert $p) => $p->where('resumen.roles.activos', 4));
    }

    public function test_crea_un_rol_y_se_asigna_al_crear_un_usuario(): void
    {
        $this->actingAs($this->admin)->post('/roles', ['nombre' => '  Conductor ', 'descripcion' => 'Hace las entregas', 'nivel' => 'auxiliar'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Rol creado: Conductor. Ya puedes asignarlo al crear usuarios.');

        $conductor = RolUsuario::where('nombre', 'Conductor')->sole();
        $this->assertSame([Rol::Auxiliar, false, true], [$conductor->nivel, $conductor->base, $conductor->activo]);

        $this->actingAs($this->admin)->post('/usuarios', $this->usuario($conductor->id))->assertSessionHasNoErrors();

        $carlos = User::where('email', 'carlos@example.com')->sole();
        // El acceso sale del rol
        $this->assertSame([$conductor->id, Rol::Auxiliar], [$carlos->rol_id, $carlos->rol]);
        $this->assertSame('Conductor', $carlos->nombreRol());
    }

    public function test_valida_el_nombre_y_el_acceso(): void
    {
        $this->actingAs($this->admin)->post('/roles', ['nombre' => '', 'nivel' => 'jefe'])
            ->assertSessionHasErrors(['nombre' => 'Escribe el nombre del rol.', 'nivel']);
        $this->actingAs($this->admin)->post('/roles', ['nombre' => 'administrador', 'nivel' => 'admin'])
            ->assertSessionHasErrors(['nombre' => 'Ya hay un rol con este nombre.']);
    }

    public function test_un_rol_en_uso_no_cambia_de_acceso_y_uno_base_tampoco(): void
    {
        $supervisor = RolUsuario::create(['nombre' => 'Supervisor de ruta', 'nivel' => Rol::Auxiliar, 'activo' => true]);

        // Sin usuarios todavía, el acceso se puede corregir
        $this->actingAs($this->admin)->put("/roles/{$supervisor->id}", ['nombre' => 'Supervisor de ruta', 'nivel' => 'coordinador'])->assertSessionHasNoErrors();
        $this->assertSame(Rol::Coordinador, $supervisor->fresh()->nivel);

        User::factory()->create(['rol_id' => $supervisor->id]);
        $this->actingAs($this->admin)->put("/roles/{$supervisor->id}", ['nombre' => 'Supervisor de ruta', 'nivel' => 'admin'])
            ->assertSessionHasErrors(['nivel' => 'Este rol ya tiene usuarios: para darles otro acceso, crea un rol nuevo y asígnaselo.']);
        // Su nombre sí se puede cambiar
        $this->actingAs($this->admin)->put("/roles/{$supervisor->id}", ['nombre' => 'Supervisor', 'nivel' => 'coordinador'])->assertSessionHasNoErrors();

        $base = RolUsuario::base(Rol::Auxiliar);
        $this->actingAs($this->admin)->put("/roles/{$base->id}", ['nombre' => $base->nombre, 'nivel' => 'admin'])
            ->assertSessionHasErrors(['nivel' => 'Es un rol base de la plataforma: su acceso no se cambia.']);
        $this->assertSame(Rol::Auxiliar, $base->fresh()->nivel);
    }

    public function test_un_rol_inactivo_no_se_asigna_pero_quien_lo_tiene_lo_conserva(): void
    {
        $conductor = RolUsuario::create(['nombre' => 'Conductor', 'nivel' => Rol::Auxiliar, 'activo' => true]);
        $ana = User::factory()->create(['rol_id' => $conductor->id, 'cargo' => 'Conductora']);

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

    public function test_al_cambiar_el_rol_de_un_usuario_cambia_su_acceso(): void
    {
        $ana = User::factory()->create();
        $this->assertSame(Rol::Auxiliar, $ana->rol);

        $this->actingAs($this->admin)->put("/usuarios/{$ana->id}", [
            ...$this->usuario($this->rolBase(Rol::Coordinador)), 'email' => $ana->email, 'password' => '',
        ])->assertSessionHasNoErrors();

        $this->assertSame(Rol::Coordinador, $ana->fresh()->rol);
        // Ya entra a las herramientas de la operación de su línea
        $this->actingAs($ana->fresh())->get('/cargas')->assertOk();
    }

    public function test_un_rol_con_usuarios_no_se_borra(): void
    {
        $conductor = RolUsuario::create(['nombre' => 'Conductor', 'nivel' => Rol::Auxiliar, 'activo' => true]);
        User::factory()->create(['rol_id' => $conductor->id]);

        $this->expectException(QueryException::class);
        $conductor->delete();
    }
}
