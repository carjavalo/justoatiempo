<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\Sucursal;
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

    public function test_el_panel_del_administrador_muestra_las_cuatro_opciones_con_sus_conteos(): void
    {
        $sede = $this->sede('TuGo');
        $sede->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        Sucursal::create(['sede_id' => null, 'nombre' => 'Oficina Cali', 'ciudad' => 'Cali']);

        $this->actingAs($this->admin)->get('/panel')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('panel')
                ->where('resumen.empresas.total', 1)
                ->where('resumen.sedes.total', 1)
                ->where('resumen.sucursales.total', 2)
                ->where('resumen.sucursales.propias', 1)
                ->where('resumen.usuarios.activos', 1));
    }

    public function test_quien_no_es_administrador_ve_su_asignacion_y_no_entra_a_los_modulos(): void
    {
        $sede = $this->sede('TuGo');
        $sucursal = $sede->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        // Sin línea asignada se queda en el panel, que le explica su asignación
        $coordinador = User::factory()->coordinador()->create([
            'empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'sucursal_id' => $sucursal->id, 'linea_servicio_id' => null,
        ]);

        $this->actingAs($coordinador)->get('/panel')
            ->assertInertia(fn (Assert $p) => $p->missing('resumen')
                ->where('asignacion.empresa', 'Ditranza')
                ->where('asignacion.sede', 'TuGo')
                ->where('asignacion.sucursal', 'Cali Sur'));

        foreach (['/usuarios', '/empresas', '/sedes', '/sucursales'] as $url) {
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
            'nombre' => 'Ditranza S.A.S',
            'nit' => '900.123.456',
            'contacto_email' => 'Compras@Ditranza.com',
        ])->assertRedirect('/empresas')->assertSessionHas('success');

        $empresa = Empresa::sole();
        $this->assertSame('900123456-8', $empresa->nit);
        $this->assertSame('compras@ditranza.com', $empresa->contacto_email);
        $this->assertTrue($empresa->activo);
    }

    public function test_rechaza_un_nit_con_digito_de_verificacion_errado_o_repetido(): void
    {
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'A', 'nit' => '900123456-3'])
            ->assertSessionHasErrors(['nit' => 'El dígito de verificación no corresponde: para 900123456 es 8.']);

        Empresa::create(['nombre' => 'Existente', 'nit' => '900123456-8']);
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Otra', 'nit' => '900123456-8'])
            ->assertSessionHasErrors(['nit' => 'Ya hay una empresa registrada con este NIT.']);

        $this->actingAs($this->admin)->post('/empresas', ['nombre' => 'Existente'])->assertSessionHasErrors('nombre');
    }

    public function test_edita_y_desactiva_una_empresa(): void
    {
        $empresa = Empresa::create(['nombre' => 'Ditranza', 'nit' => '900123456-8']);

        // Conservar su propio NIT no cuenta como repetido
        $this->actingAs($this->admin)->put("/empresas/{$empresa->id}", ['nombre' => 'Ditranza S.A.S', 'nit' => '900123456-8'])->assertSessionHasNoErrors();
        $this->assertSame('Ditranza S.A.S', $empresa->fresh()->nombre);

        $this->actingAs($this->admin)->patch("/empresas/{$empresa->id}/estado", ['activo' => false]);
        $this->assertFalse($empresa->fresh()->activo);
    }

    public function test_la_lista_de_empresas_cuenta_sus_sedes(): void
    {
        $this->sede('TuGo');
        $this->sede('Sodimac');

        $this->actingAs($this->admin)->get('/empresas')
            ->assertInertia(fn (Assert $p) => $p->has('empresas.data', 1)->where('empresas.data.0.nombre', 'Ditranza')->where('empresas.data.0.sedes', 2));
    }

    // --- Sedes (los clientes de cada empresa) ------------------------------------------

    public function test_crea_sedes_de_una_empresa_con_su_meta(): void
    {
        $empresa = $this->empresa();

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'TuGo', 'empresa_id' => $empresa->id, 'meta_efectividad' => '92,5'])->assertSessionHasNoErrors();
        $sede = Sede::sole();
        $this->assertSame($empresa->id, $sede->empresa_id);
        $this->assertEquals(92.5, $sede->meta_efectividad);

        // Drivin la reconoce por su nombre: no se repite
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'TuGo', 'empresa_id' => $empresa->id, 'meta_efectividad' => 95])
            ->assertSessionHasErrors(['nombre' => 'Ya hay una sede con ese nombre.']);
        // Toda sede es de una empresa, y la meta es un porcentaje
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Sodimac', 'meta_efectividad' => 95])->assertSessionHasErrors('empresa_id');
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Sodimac', 'empresa_id' => $empresa->id, 'meta_efectividad' => 120])
            ->assertSessionHasErrors(['meta_efectividad' => 'La meta de efectividad va de 1 % a 100 %.']);
    }

    public function test_una_empresa_inactiva_no_recibe_sedes_nuevas(): void
    {
        $empresa = Empresa::create(['nombre' => 'Ditranza', 'activo' => false]);

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'TuGo', 'empresa_id' => $empresa->id, 'meta_efectividad' => 95])
            ->assertSessionHasErrors(['empresa_id' => 'Esta empresa está inactiva: actívala antes de asignarle sedes.']);
    }

    public function test_una_sede_se_traslada_de_empresa_con_su_personal(): void
    {
        // Como quedan los datos de la versión anterior: TuGo era su propia empresa
        $empresaVieja = $this->empresa('TuGo');
        $sede = $this->sede('TuGo', [], $empresaVieja);
        $persona = User::factory()->create(['empresa_id' => $empresaVieja->id, 'sede_id' => $sede->id]);
        $ditranza = $this->empresa();

        $this->actingAs($this->admin)->put("/sedes/{$sede->id}", ['nombre' => 'TuGo', 'empresa_id' => $ditranza->id, 'meta_efectividad' => 95])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'La sede TuGo ahora es de Ditranza, con sus sucursales y su personal.');
        $this->assertSame($ditranza->id, $sede->fresh()->empresa_id);
        // Su personal pasa con ella: nadie queda en una sede de otra empresa
        $this->assertSame($ditranza->id, $persona->fresh()->empresa_id);
    }

    public function test_no_se_traslada_una_sede_a_una_empresa_que_no_recibe_la_linea_de_su_personal(): void
    {
        $sede = $this->sede('TuGo');
        User::factory()->create(['empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id]);
        $sinLogistica = Empresa::create(['nombre' => 'Aseos del Valle']);

        $this->actingAs($this->admin)->put("/sedes/{$sede->id}", ['nombre' => 'TuGo', 'empresa_id' => $sinLogistica->id, 'meta_efectividad' => 95])
            ->assertSessionHasErrors(['empresa_id' => 'El personal de esta sede trabaja en «'.LineaServicio::logistica()->nombre.'», que esa empresa no recibe: márcala primero en la empresa.']);
        $this->assertNotSame($sinLogistica->id, $sede->fresh()->empresa_id);
    }

    public function test_la_sede_guarda_su_codigo_de_drivin_sin_repetirlo(): void
    {
        $empresa = $this->empresa();
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'TuGo', 'codigo' => 'tugo', 'empresa_id' => $empresa->id, 'meta_efectividad' => 95])->assertSessionHasNoErrors();
        $this->assertSame('TUGO', Sede::sole()->codigo);

        $this->actingAs($this->admin)->post('/sedes', ['nombre' => 'Otra', 'codigo' => 'TUGO', 'empresa_id' => $empresa->id, 'meta_efectividad' => 95])
            ->assertSessionHasErrors(['codigo' => 'Ya hay una sede con ese código.']);
    }

    public function test_filtra_sedes_por_empresa(): void
    {
        $this->sede('TuGo');
        $this->sede('Falabella', [], $this->empresa('Logística Sur'));
        $ditranza = Empresa::firstWhere('nombre', 'Ditranza');

        $this->actingAs($this->admin)->get("/sedes?empresa={$ditranza->id}")
            ->assertInertia(fn (Assert $p) => $p->component('sedes/index')->has('sedes.data', 1)->where('sedes.data.0.nombre', 'TuGo')->where('sedes.data.0.empresa', 'Ditranza'));
    }

    // --- Sucursales --------------------------------------------------------------------

    public function test_crea_sucursales_propias_y_de_sede_sin_repetir_nombres(): void
    {
        $tugo = $this->sede('TuGo');
        $sodimac = $this->sede('Sodimac');

        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Principal', 'ciudad' => 'Cali'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Principal', 'ciudad' => 'Cali', 'sede_id' => $tugo->id])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Principal', 'ciudad' => 'Yumbo', 'sede_id' => $sodimac->id])->assertSessionHasNoErrors();

        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Principal', 'ciudad' => 'Cali'])
            ->assertSessionHasErrors(['nombre' => 'Ya hay una sucursal propia con ese nombre.']);
        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Principal', 'ciudad' => 'Cali', 'sede_id' => $tugo->id])
            ->assertSessionHasErrors(['nombre' => 'Esta sede ya tiene una sucursal con ese nombre.']);

        $this->assertSame(1, Sucursal::whereNull('sede_id')->count());
        $this->assertSame(3, Sucursal::count());
    }

    public function test_la_sucursal_guarda_el_nombre_de_su_plan_en_drivin_sin_repetirlo(): void
    {
        $sede = $this->sede('TuGo');

        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Cali Sur', 'ciudad' => 'Cali', 'sede_id' => $sede->id, 'alias_drivin' => ' cali sur cross '])->assertSessionHasNoErrors();
        $this->assertSame('CALI SUR CROSS', Sucursal::sole()->alias_drivin);

        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Cali Sur 2', 'ciudad' => 'Cali', 'sede_id' => $sede->id, 'alias_drivin' => 'CALI SUR CROSS'])
            ->assertSessionHasErrors(['alias_drivin' => 'Otra sucursal ya usa ese nombre de plan en Drivin.']);
    }

    public function test_una_sede_inactiva_no_recibe_sucursales_nuevas(): void
    {
        $sede = $this->sede('TuGo', ['activo' => false]);

        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'Cali Sur', 'ciudad' => 'Cali', 'sede_id' => $sede->id])
            ->assertSessionHasErrors(['sede_id' => 'Esta sede está inactiva: actívala antes de asignarle sucursales.']);
    }

    public function test_filtra_sucursales_propias_o_por_sede(): void
    {
        $sede = $this->sede('TuGo');
        $sede->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        Sucursal::create(['sede_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);

        $this->actingAs($this->admin)->get('/sucursales?sede=propias')
            ->assertInertia(fn (Assert $p) => $p->component('sucursales/index')->has('sucursales.data', 1)->where('sucursales.data.0.nombre', 'Oficina'));
        $this->actingAs($this->admin)->get("/sucursales?sede={$sede->id}")
            ->assertInertia(fn (Assert $p) => $p->has('sucursales.data', 1)->where('sucursales.data.0.sede', 'TuGo')->where('sucursales.data.0.empresa', 'Ditranza'));
    }

    public function test_una_sucursal_con_usuarios_no_cambia_de_sede(): void
    {
        $tugo = $this->sede('TuGo');
        $sodimac = $this->sede('Sodimac');
        $sucursal = $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        User::factory()->create(['empresa_id' => $tugo->empresa_id, 'sede_id' => $tugo->id, 'sucursal_id' => $sucursal->id]);

        $this->actingAs($this->admin)->put("/sucursales/{$sucursal->id}", ['nombre' => 'Cali Sur', 'ciudad' => 'Cali', 'sede_id' => $sodimac->id])
            ->assertSessionHasErrors('sede_id');
        $this->actingAs($this->admin)->put("/sucursales/{$sucursal->id}", ['nombre' => 'Cali Sur Cross', 'ciudad' => 'Cali', 'sede_id' => $tugo->id])
            ->assertSessionHasNoErrors();
        $this->assertSame($tugo->id, $sucursal->fresh()->sede_id);
    }

    // --- Usuarios ----------------------------------------------------------------------

    public function test_crea_un_usuario_con_rol_y_donde_trabaja(): void
    {
        $sede = $this->sede('TuGo');
        $sucursal = $sede->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $linea = LineaServicio::logistica();

        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => '  Laura  Sofía ',
            'primer_apellido' => 'Gómez',
            'segundo_apellido' => 'Ruiz',
            'email' => 'Laura@Example.com',
            'rol_id' => $this->rolBase(Rol::Coordinador),
            'cargo' => 'Coordinadora de bodega',
            'linea_id' => $linea->id,
            'empresa_id' => $sede->empresa_id,
            'sede_id' => $sede->id,
            'sucursal_id' => $sucursal->id,
            'password' => 'Clave-segura-1',
        ])->assertSessionHasNoErrors();

        $usuario = User::where('email', 'laura@example.com')->sole();
        $this->assertSame('laura@example.com', $usuario->email);
        // El nombre completo se arma con las partes, sin espacios de más
        $this->assertSame('Laura Sofía Gómez Ruiz', $usuario->name);
        $this->assertSame('Ruiz', $usuario->segundo_apellido);
        $this->assertSame(Rol::Coordinador, $usuario->rol);
        $this->assertSame('Coordinador / Supervisor', $usuario->nombreRol());
        $this->assertSame('Coordinadora de bodega', $usuario->cargo);
        $this->assertSame([$sede->empresa_id, $sede->id, $sucursal->id], [$usuario->empresa_id, $usuario->sede_id, $usuario->sucursal_id]);
        $this->assertSame($linea->id, $usuario->linea_servicio_id);
        $this->assertNotNull($usuario->email_verified_at);
        $this->assertTrue(Hash::check('Clave-segura-1', $usuario->password));
    }

    public function test_empresa_sede_y_sucursal_del_usuario_son_coherentes(): void
    {
        $tugo = $this->sede('TuGo');
        $caliSur = $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $otraEmpresa = $this->empresa('Logística Sur');
        $falabella = $this->sede('Falabella', [], $otraEmpresa);
        $acopi = $falabella->sucursales()->create(['nombre' => 'Acopi', 'ciudad' => 'Yumbo']);
        $oficina = Sucursal::create(['sede_id' => null, 'nombre' => 'Oficina', 'ciudad' => 'Cali']);
        $base = ['nombres' => 'Ana', 'primer_apellido' => 'Torres', 'email' => 'ana@example.com', 'rol_id' => $this->rolBase(Rol::Auxiliar), 'cargo' => 'Auxiliar', 'linea_id' => LineaServicio::logistica()->id, 'password' => 'Clave-segura-1'];
        $ditranza = $tugo->empresa_id;

        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'empresa_id' => $ditranza, 'sede_id' => $falabella->id])
            ->assertSessionHasErrors(['sede_id' => 'Esta sede no pertenece a la empresa elegida.']);
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'sede_id' => $tugo->id])
            ->assertSessionHasErrors(['sede_id' => 'Esta sede es de una empresa: elige primero esa empresa.']);
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'empresa_id' => $ditranza, 'sede_id' => $tugo->id, 'sucursal_id' => $acopi->id])
            ->assertSessionHasErrors(['sucursal_id' => 'Esta sucursal no pertenece a la sede elegida.']);
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'empresa_id' => $ditranza, 'sucursal_id' => $caliSur->id])
            ->assertSessionHasErrors(['sucursal_id' => 'Esta sucursal es de una sede: elige primero esa sede.']);
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'empresa_id' => $ditranza, 'sucursal_id' => $oficina->id])
            ->assertSessionHasErrors(['sucursal_id' => 'Esta sucursal es propia de Justo a Tiempo: no se asigna a quien presta el servicio en una empresa.']);

        // Sin empresa asignada, solo cabe una sucursal propia
        $this->actingAs($this->admin)->post('/usuarios', [...$base, 'sucursal_id' => $oficina->id])->assertSessionHasNoErrors();
        $ana = User::where('email', 'ana@example.com')->sole();
        $this->assertSame([null, $oficina->id], [$ana->empresa_id, $ana->sucursal_id]);
    }

    public function test_el_administrador_tambien_tiene_empresa_y_cargo(): void
    {
        $sede = $this->sede('TuGo');

        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => 'Otra', 'primer_apellido' => 'Admin', 'email' => 'otra@example.com', 'rol_id' => $this->rolBase(Rol::Admin),
            'cargo' => 'Gerente', 'empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'linea_id' => 'todas', 'password' => 'Clave-segura-1',
        ])->assertSessionHasNoErrors();

        $otra = User::where('email', 'otra@example.com')->sole();
        $this->assertSame([$sede->empresa_id, $sede->id, null], [$otra->empresa_id, $otra->sede_id, $otra->linea_servicio_id]);
        // Con empresa o sin ella, el administrador sigue entrando a las herramientas de la operación
        $this->actingAs($otra)->get('/cargas')->assertOk();
    }

    public function test_sin_rol_linea_ni_cargo_no_se_crea_el_usuario(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', ['nombres' => 'Ana', 'primer_apellido' => 'Torres', 'email' => 'ana@example.com', 'password' => 'Clave-segura-1'])
            ->assertSessionHasErrors([
                'rol_id' => 'Elige el rol.',
                'linea_id' => 'Elige la línea de servicio.',
                'cargo' => 'Escribe el cargo: va en el carnet.',
            ])
            // La empresa es opcional: sin ella queda sin empresa asignada
            ->assertSessionDoesntHaveErrors('empresa_id');
        $this->assertDatabaseMissing('users', ['email' => 'ana@example.com']);

        // Valores que no existen (Justo a Tiempo no es una de las empresas: todos son su personal)
        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => 'Ana', 'primer_apellido' => 'Torres', 'email' => 'ana@example.com', 'password' => 'Clave-segura-1', 'cargo' => 'Auxiliar',
            'rol_id' => 999, 'empresa_id' => 'propia', 'linea_id' => 999,
        ])->assertSessionHasErrors(['rol_id', 'empresa_id' => 'Elige una empresa de la lista.', 'linea_id' => 'Elige una línea de la lista.']);
        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => 'Ana', 'primer_apellido' => 'Torres', 'email' => 'ana@example.com', 'password' => 'Clave-segura-1', 'cargo' => 'Auxiliar',
            'rol_id' => $this->rolBase(Rol::Auxiliar), 'empresa_id' => 999, 'linea_id' => LineaServicio::logistica()->id,
        ])->assertSessionHasErrors(['empresa_id' => 'Elige una empresa de la lista.']);
    }

    public function test_sin_empresa_el_usuario_queda_sin_empresa_asignada(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', [
            'nombres' => 'Ana', 'primer_apellido' => 'Torres', 'email' => 'ana@example.com', 'password' => 'Clave-segura-1', 'cargo' => 'Auxiliar',
            'rol_id' => $this->rolBase(Rol::Auxiliar), 'empresa_id' => '', 'linea_id' => LineaServicio::logistica()->id,
        ])->assertSessionHasNoErrors();

        $ana = User::where('email', 'ana@example.com')->sole();
        $this->assertSame([null, null, null], [$ana->empresa_id, $ana->sede_id, $ana->sucursal_id]);

        $this->actingAs($this->admin)->get('/usuarios?q=ana@example.com')
            ->assertInertia(fn (Assert $p) => $p->where('usuarios.data.0.empresa', null)->where('usuarios.data.0.empresaId', null));
    }

    public function test_valida_correo_repetido_rol_y_contrasena(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', ['nombres' => 'X', 'primer_apellido' => 'Y', 'email' => strtoupper($this->admin->email), 'rol_id' => 'jefe', 'password' => 'corta'])
            ->assertSessionHasErrors(['email', 'rol_id', 'password']);
        $this->actingAs($this->admin)->post('/usuarios', ['email' => 'z@example.com', 'rol_id' => $this->rolBase(Rol::Auxiliar), 'password' => 'Clave-segura-1'])
            ->assertSessionHasErrors(['nombres', 'primer_apellido'])
            ->assertSessionDoesntHaveErrors('segundo_apellido');
        $this->actingAs($this->admin)->post('/usuarios', ['nombres' => 'X', 'primer_apellido' => 'Y', 'email' => 'x@example.com', 'rol_id' => $this->rolBase(Rol::Auxiliar)])
            ->assertSessionHasErrors('password');
    }

    public function test_al_editar_sin_contrasena_se_conserva_la_actual(): void
    {
        $usuario = User::factory()->create(['password' => 'Original-123']);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", [...$this->edicion($usuario), 'nombres' => 'Nuevo', 'primer_apellido' => 'Nombre', 'password' => ''])
            ->assertSessionHasNoErrors();

        $this->assertSame('Nuevo Nombre', $usuario->fresh()->name);
        $this->assertTrue(Hash::check('Original-123', $usuario->fresh()->password));
    }

    public function test_el_administrador_no_se_quita_su_rol_ni_se_desactiva(): void
    {
        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", [
            ...$this->edicion($this->admin), 'rol_id' => $this->rolBase(Rol::Auxiliar), 'linea_id' => LineaServicio::logistica()->id,
        ])->assertSessionHasErrors(['rol_id' => 'No puedes cambiarte a un rol sin los permisos para editar usuarios y roles. Pídeselo a otra persona.']);
        $this->assertSame(Rol::Admin, $this->admin->fresh()->rol);

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
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->edicion($usuario))->assertSessionHasNoErrors();
        $this->assertDatabaseHas('sessions', ['id' => 'sesion-vieja']);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", [...$this->edicion($usuario), 'password' => 'Nueva-clave-9'])->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('sessions', ['id' => 'sesion-vieja']);
    }

    /** Lo que el formulario envía al editar a alguien sin cambiar nada. */
    private function edicion(User $usuario): array
    {
        return [
            'nombres' => 'Otro', 'primer_apellido' => 'Más', 'email' => $usuario->email, 'cargo' => $usuario->cargo ?? 'Auxiliar',
            'rol_id' => $usuario->rol_id, 'empresa_id' => $usuario->empresa_id ?? '', 'linea_id' => $usuario->linea_servicio_id ?? 'todas',
        ];
    }

    public function test_el_personal_de_una_empresa_no_entra_a_los_modulos_de_operacion(): void
    {
        $sede = $this->sede('TuGo');
        $deEmpresa = User::factory()->coordinador()->create(['empresa_id' => $sede->empresa_id]);
        $propio = User::factory()->coordinador()->create();

        foreach (['/cargas', '/auditoria'] as $url) {
            $this->actingAs($deEmpresa)->get($url)->assertForbidden()
                // El aviso habla de su asignación: todos son personal de Justo a Tiempo
                ->assertInertia(fn (Assert $p) => $p->where('mensaje', 'Esta sección reúne la operación de todas las empresas: no está disponible para quien presta el servicio en una sola.'));
            $this->actingAs($propio)->get($url)->assertOk();
        }

        // El tablero de la línea sí lo ve, pero solo con su empresa y sin las herramientas
        $this->actingAs($deEmpresa)->get('/lineas/logisticos')
            // Sus herramientas (cargas, auditoría) reúnen todas las empresas: no le aplican
            ->assertInertia(fn (Assert $p) => $p->where('auth.permisos', fn ($permisos) => ! collect($permisos)->contains('cargas.ver'))->where('alcanceFijo', 'Ditranza'));
        $this->actingAs($propio)->get('/lineas/logisticos')
            ->assertInertia(fn (Assert $p) => $p->where('auth.permisos', fn ($permisos) => collect($permisos)->contains('cargas.ver'))->where('alcanceFijo', null));
    }

    public function test_un_inactivo_que_envia_un_patch_es_redirigido_con_303(): void
    {
        $inactivo = User::factory()->admin()->create(['activo' => false]);

        $this->actingAs($inactivo)->patch('/settings/profile', ['nombres' => 'X', 'primer_apellido' => 'Y', 'email' => $inactivo->email])
            ->assertStatus(303)
            ->assertRedirect('/login');
    }

    public function test_un_campo_enviado_como_arreglo_es_un_error_de_validacion(): void
    {
        $this->actingAs($this->admin)->post('/empresas', ['nombre' => ['a', 'b']])->assertSessionHasErrors('nombre');
        $this->actingAs($this->admin)->post('/sedes', ['nombre' => ['a'], 'meta_efectividad' => 95])->assertSessionHasErrors('nombre');
        $this->actingAs($this->admin)->post('/sucursales', ['nombre' => 'X', 'ciudad' => ['Cali']])->assertSessionHasErrors('ciudad');
        $this->actingAs($this->admin)->post('/usuarios', ['nombres' => 'X', 'primer_apellido' => 'Y', 'email' => ['a@b.co'], 'rol_id' => $this->rolBase(Rol::Auxiliar), 'password' => 'Clave-segura-1'])->assertSessionHasErrors('email');
    }

    public function test_filtra_usuarios_por_sede_y_por_sucursal_desde_los_conteos(): void
    {
        $sede = $this->sede('TuGo');
        $sucursal = $sede->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        User::factory()->create(['empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'sucursal_id' => $sucursal->id, 'name' => 'En Cali Sur']);
        User::factory()->create(['empresa_id' => $sede->empresa_id, 'sede_id' => $sede->id, 'name' => 'En TuGo']);
        User::factory()->create(['name' => 'Propio']);

        $this->actingAs($this->admin)->get("/usuarios?sede={$sede->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 2)->where('contexto.sede', 'TuGo'));
        $this->actingAs($this->admin)->get("/usuarios?sucursal={$sucursal->id}")
            ->assertInertia(fn (Assert $p) => $p->has('usuarios.data', 1)->where('usuarios.data.0.nombre', 'En Cali Sur')->where('contexto.sucursal', 'Cali Sur'));
    }
}
