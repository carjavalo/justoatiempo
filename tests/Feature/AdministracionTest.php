<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\Cliente;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdministracionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    // --- Panel e ingreso ---------------------------------------------------------------

    public function test_al_ingresar_llega_al_panel_y_registra_el_ultimo_acceso(): void
    {
        $user = User::factory()->admin()->create(['ultimo_acceso_en' => null]);

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect('/panel');

        $this->assertNotNull($user->fresh()->ultimo_acceso_en);
    }

    public function test_el_panel_del_administrador_muestra_las_tres_opciones_con_sus_conteos(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas del Valle']);
        Sede::create(['cliente_id' => $empresa->id, 'nombre' => 'Yumbo', 'ciudad' => 'Yumbo']);
        Sede::create(['cliente_id' => null, 'nombre' => 'Oficina Cali', 'ciudad' => 'Cali']);

        $this->actingAs($this->admin)->get('/panel')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('panel')
                ->where('resumen.empresas.total', 1)
                ->where('resumen.sedes.total', 2)
                ->where('resumen.sedes.propias', 1)
                ->where('resumen.usuarios.activos', 1));
    }

    public function test_quien_no_es_administrador_ve_su_asignacion_y_no_entra_a_los_modulos(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas del Valle']);
        $sede = Sede::create(['cliente_id' => $empresa->id, 'nombre' => 'Yumbo', 'ciudad' => 'Yumbo']);
        $coordinador = User::factory()->coordinador()->create(['cliente_id' => $empresa->id, 'sede_id' => $sede->id]);

        $this->actingAs($coordinador)->get('/panel')
            ->assertInertia(fn (Assert $p) => $p->missing('resumen')->where('asignacion.empresa', 'Bodegas del Valle')->where('asignacion.sede', 'Yumbo'));

        foreach (['/usuarios', '/empresas', '/sedes'] as $url) {
            $this->actingAs($coordinador)->get($url)->assertForbidden();
        }
        $this->actingAs($coordinador)->post('/empresas', ['nombre' => 'X'])->assertForbidden();
    }

    public function test_la_direccion_anterior_del_panel_redirige(): void
    {
        $this->actingAs($this->admin)->get('/dashboard')->assertRedirect('/panel');
    }

    // --- Empresas ----------------------------------------------------------------------

    public function test_crea_una_empresa_y_calcula_el_digito_de_verificacion_del_nit(): void
    {
        $this->actingAs($this->admin)->from('/empresas')->post('/empresas', [
            'nombre' => 'Bodegas del Valle S.A.S',
            'nit' => '900.123.456',
            'contacto_email' => 'Compras@Bodegas.com',
        ])->assertRedirect('/empresas')->assertSessionHas('success');

        $empresa = Cliente::sole();
        $this->assertSame('900123456-8', $empresa->nit);
        $this->assertSame('compras@bodegas.com', $empresa->contacto_email);
        $this->assertTrue($empresa->activo);
    }

    public function test_rechaza_un_nit_con_digito_de_verificacion_errado_o_repetido(): void
    {
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'A', 'nit' => '900123456-3'])
            ->assertSessionHasErrors(['nit' => 'El dígito de verificación no corresponde: para 900123456 es 8.']);

        Cliente::create(['nombre' => 'Existente', 'nit' => '900123456-8']);
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Otra', 'nit' => '900123456-8'])
            ->assertSessionHasErrors(['nit' => 'Ya hay una empresa registrada con este NIT.']);

        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Existente'])->assertSessionHasErrors('nombre');
    }

    public function test_edita_y_desactiva_una_empresa(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas', 'nit' => '900123456-8']);

        // Conservar su propio NIT no cuenta como repetido
        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Bodegas del Valle', 'nit' => '900123456-8'])->assertSessionHasNoErrors();
        $this->assertSame('Bodegas del Valle', $empresa->fresh()->nombre);

        $this->actingAs($this->admin)->patch("/empresas/{$empresa->id}/estado", ['activo' => false]);
        $this->assertFalse($empresa->fresh()->activo);
    }

    // --- Sedes -------------------------------------------------------------------------

    public function test_crea_sedes_propias_y_de_empresa_sin_repetir_nombres(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        $otra = Cliente::create(['nombre' => 'Logística Sur']);

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Principal', 'ciudad' => 'Cali'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Principal', 'ciudad' => 'Cali', 'empresa_id' => $empresa->id])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Principal', 'ciudad' => 'Yumbo', 'empresa_id' => $otra->id])->assertSessionHasNoErrors();

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Principal', 'ciudad' => 'Cali'])
            ->assertSessionHasErrors(['nombre' => 'Ya hay una sede propia con ese nombre.']);
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Principal', 'ciudad' => 'Cali', 'empresa_id' => $empresa->id])
            ->assertSessionHasErrors(['nombre' => 'Esta empresa ya tiene una sede con ese nombre.']);

        $this->assertSame(1, Sede::whereNull('cliente_id')->count());
        $this->assertSame(3, Sede::count());
    }

    public function test_una_empresa_inactiva_no_recibe_sedes_nuevas(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas', 'activo' => false]);

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Yumbo', 'ciudad' => 'Yumbo', 'empresa_id' => $empresa->id])
            ->assertSessionHasErrors('empresa_id');
    }

    public function test_filtra_sedes_propias_o_por_empresa(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        Sede::create(['cliente_id' => $empresa->id, 'nombre' => 'Yumbo', 'ciudad' => 'Yumbo']);
        Sede::create(['cliente_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);

        $this->actingAs($this->admin)->get('/sedes?empresa=propias')
            ->assertInertia(fn (Assert $p) => $p->has('sedes.data', 1)->where('sedes.data.0.nombre', 'Oficina'));
        $this->actingAs($this->admin)->get("/sedes?empresa={$empresa->id}")
            ->assertInertia(fn (Assert $p) => $p->has('sedes.data', 1)->where('sedes.data.0.empresa', 'Bodegas'));
    }

    // --- Usuarios ----------------------------------------------------------------------

    public function test_crea_un_usuario_con_rol_empresa_y_sede(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        $sede = Sede::create(['cliente_id' => $empresa->id, 'nombre' => 'Yumbo', 'ciudad' => 'Yumbo']);

        $this->actingAs($this->admin)->post('/usuarios', [
            'name' => 'Laura Gómez',
            'email' => 'Laura@Example.com',
            'rol' => 'coordinador',
            'empresa_id' => $empresa->id,
            'sede_id' => $sede->id,
            'password' => 'Clave-segura-1',
        ])->assertSessionHasNoErrors();

        $usuario = User::where('email', 'laura@example.com')->sole();
        $this->assertSame('laura@example.com', $usuario->email);
        $this->assertSame(Rol::Coordinador, $usuario->rol);
        $this->assertSame($sede->id, $usuario->sede_id);
        $this->assertNotNull($usuario->email_verified_at);
        $this->assertTrue(Hash::check('Clave-segura-1', $usuario->password));
    }

    public function test_la_sede_del_usuario_debe_ser_de_su_empresa(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        $otra = Cliente::create(['nombre' => 'Logística Sur']);
        $sedeOtra = Sede::create(['cliente_id' => $otra->id, 'nombre' => 'Acopi', 'ciudad' => 'Yumbo']);
        $base = ['name' => 'Ana', 'email' => 'ana@example.com', 'rol' => 'auxiliar', 'password' => 'Clave-segura-1'];

        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'empresa_id' => $empresa->id, 'sede_id' => $sedeOtra->id])
            ->assertSessionHasErrors(['sede_id' => 'Esta sede no pertenece a la empresa elegida.']);
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'sede_id' => $sedeOtra->id])
            ->assertSessionHasErrors(['sede_id' => 'Esta sede es de una empresa cliente: elige primero esa empresa.']);
    }

    public function test_valida_correo_repetido_rol_y_contrasena(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', ['name' => 'X', 'email' => strtoupper($this->admin->email), 'rol' => 'jefe', 'password' => 'corta'])
            ->assertSessionHasErrors(['email', 'rol', 'password']);
        $this->actingAs($this->admin)->post('/usuarios', ['name' => 'X', 'email' => 'x@example.com', 'rol' => 'auxiliar'])
            ->assertSessionHasErrors('password');
    }

    public function test_al_editar_sin_contrasena_se_conserva_la_actual(): void
    {
        $usuario = User::factory()->create(['password' => 'Original-123']);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", ['name' => 'Nuevo nombre', 'email' => $usuario->email, 'rol' => 'auxiliar', 'password' => ''])
            ->assertSessionHasNoErrors();

        $this->assertSame('Nuevo nombre', $usuario->fresh()->name);
        $this->assertTrue(Hash::check('Original-123', $usuario->fresh()->password));
    }

    public function test_el_administrador_no_se_quita_su_rol_ni_se_desactiva(): void
    {
        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", ['name' => $this->admin->name, 'email' => $this->admin->email, 'rol' => 'auxiliar'])
            ->assertSessionHasErrors('rol');

        $this->actingAs($this->admin)->patch("/usuarios/{$this->admin->id}/estado", ['activo' => false])->assertSessionHas('error');
        $this->assertTrue($this->admin->fresh()->activo);
    }

    public function test_al_desactivar_un_usuario_pierde_la_sesion_y_no_puede_ingresar(): void
    {
        $usuario = User::factory()->coordinador()->create();
        DB::table('sessions')->insert(['id' => 'sesion-abierta', 'user_id' => $usuario->id, 'payload' => '', 'last_activity' => time()]);

        $this->actingAs($this->admin)->patch("/usuarios/{$usuario->id}/estado", ['activo' => false])->assertSessionHas('success');

        $this->assertFalse($usuario->fresh()->activo);
        $this->assertDatabaseMissing('sessions', ['id' => 'sesion-abierta']);

        // Con la sesión todavía en memoria, el siguiente clic lo saca
        $this->actingAs($usuario->fresh())->get('/panel')->assertRedirect('/login');

        auth()->logout();
        $this->post('/login', ['email' => $usuario->email, 'password' => 'password'])
            ->assertSessionHasErrors(['email' => 'Tu usuario está desactivado. Habla con el administrador para recuperar el acceso.']);
        $this->assertGuest();
    }

    public function test_al_cambiar_la_contrasena_se_cierran_las_otras_sesiones_del_usuario(): void
    {
        $usuario = User::factory()->coordinador()->create();
        DB::table('sessions')->insert(['id' => 'sesion-vieja', 'user_id' => $usuario->id, 'payload' => '', 'last_activity' => time()]);

        // Sin contraseña nueva, la sesión sigue
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", ['name' => 'Otro', 'email' => $usuario->email, 'rol' => 'coordinador']);
        $this->assertDatabaseHas('sessions', ['id' => 'sesion-vieja']);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", ['name' => 'Otro', 'email' => $usuario->email, 'rol' => 'coordinador', 'password' => 'Nueva-clave-9']);
        $this->assertDatabaseMissing('sessions', ['id' => 'sesion-vieja']);
    }

    public function test_una_sede_con_usuarios_no_cambia_de_empresa(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        $otra = Cliente::create(['nombre' => 'Logística Sur']);
        $sede = Sede::create(['cliente_id' => $empresa->id, 'nombre' => 'Yumbo', 'ciudad' => 'Yumbo']);
        User::factory()->create(['cliente_id' => $empresa->id, 'sede_id' => $sede->id]);

        $this->actingAs($this->admin)->put("/sedes/{$sede->id}", ['nombre' => 'Yumbo', 'ciudad' => 'Yumbo', 'empresa_id' => $otra->id])
            ->assertSessionHasErrors('empresa_id');
        // Editar sus otros datos sí se puede
        $this->actingAs($this->admin)->put("/sedes/{$sede->id}", ['nombre' => 'Yumbo Norte', 'ciudad' => 'Yumbo', 'empresa_id' => $empresa->id])
            ->assertSessionHasNoErrors();
        $this->assertSame($empresa->id, $sede->fresh()->cliente_id);
    }

    public function test_el_personal_de_una_empresa_cliente_no_entra_a_los_modulos_de_operacion(): void
    {
        $empresa = Cliente::create(['nombre' => 'Bodegas']);
        $deEmpresa = User::factory()->coordinador()->create(['cliente_id' => $empresa->id]);
        $propio = User::factory()->coordinador()->create();

        foreach (['/indicadores', '/cargas', '/auditoria'] as $url) {
            $this->actingAs($deEmpresa)->get($url)->assertForbidden();
            $this->actingAs($propio)->get($url)->assertOk();
        }
    }

    public function test_un_inactivo_que_envia_un_patch_es_redirigido_con_303(): void
    {
        $inactivo = User::factory()->admin()->create(['activo' => false]);

        $this->actingAs($inactivo)->patch('/settings/profile', ['name' => 'X', 'email' => $inactivo->email])
            ->assertStatus(303)
            ->assertRedirect('/login');
    }

    public function test_un_campo_enviado_como_arreglo_es_un_error_de_validacion(): void
    {
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => ['a', 'b']])->assertSessionHasErrors('nombre');
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'X', 'ciudad' => ['Cali']])->assertSessionHasErrors('ciudad');
        $this->actingAs($this->admin)->post('/usuarios', ['name' => 'X', 'email' => ['a@b.co'], 'rol' => 'auxiliar', 'password' => 'Clave-segura-1'])->assertSessionHasErrors('email');
    }

    public function test_filtra_usuarios_por_sede_desde_el_conteo(): void
    {
        $sede = Sede::create(['cliente_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);
        User::factory()->create(['sede_id' => $sede->id, 'name' => 'En la sede']);
        User::factory()->create(['name' => 'Fuera de la sede']);

        $this->actingAs($this->admin)->get("/usuarios?sede={$sede->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 1)->where('usuarios.data.0.nombre', 'En la sede')->where('contexto.sede', 'Oficina'));
    }
}
