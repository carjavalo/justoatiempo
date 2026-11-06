<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Los auxiliares operativos entran con su cédula (sin correo), la primera vez con un código inicial que les entregan,
 * crean su contraseña antes de seguir y solo ven su carnet.
 */
class AccesoAuxiliaresTest extends TestCase
{
    use RefreshDatabase;

    private function auxiliar(): User
    {
        return User::factory()->create([
            'email' => null, 'cedula' => '1144203579', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza',
            'password' => '48312290', 'codigo_inicial' => '48312290', 'debe_cambiar_contrasena' => true,
        ]);
    }

    public function test_entra_con_su_cedula_y_debe_cambiar_la_contrasena_antes_de_seguir(): void
    {
        $auxiliar = $this->auxiliar();

        // La cédula no es su contraseña: cualquiera que la conozca no entra
        $this->post('/login', ['email' => '1144203579', 'password' => '1144203579'])->assertSessionHasErrors('ingreso');
        $this->assertGuest();

        // Cédula con puntos o espacios, como la escriba, y el código tal como se le entregó ("4831 2290")
        $this->post('/login', ['email' => '1.144.203.579', 'password' => '4831 2290'])->assertRedirect('/panel');
        $this->assertAuthenticatedAs($auxiliar);

        // Cualquier página lo lleva a cambiar la contraseña
        $this->get('/panel')->assertRedirect('/settings/password');
        $this->get('/mi-carnet')->assertRedirect('/settings/password');
        $this->get('/settings/password')->assertInertia(fn (Assert $p) => $p->component('settings/password')->where('obligatorio', true));

        // Acaba de entrar con su código: no se le pide otra vez. No sirve dejar el mismo código ni usar la cédula
        $this->put('/settings/password', ['password' => '48312290', 'password_confirmation' => '48312290'])
            ->assertSessionHasErrors(['password' => 'Elige una contraseña distinta de tu código inicial.']);
        $this->put('/settings/password', ['password' => '1144203579', 'password_confirmation' => '1144203579'])
            ->assertSessionHasErrors(['password' => 'No uses tu cédula como contraseña: está en tu carnet.']);
        $this->put('/settings/password', ['password' => 'Camion-Azul-27', 'password_confirmation' => 'Camion-Azul-27'])
            ->assertSessionDoesntHaveErrors()
            ->assertRedirect('/mi-carnet');

        // Con su contraseña creada, el código deja de existir
        $auxiliar->refresh();
        $this->assertFalse($auxiliar->debe_cambiar_contrasena);
        $this->assertNull($auxiliar->codigo_inicial);
        $this->assertTrue(Hash::check('Camion-Azul-27', $auxiliar->password));
        $this->get('/mi-carnet')->assertOk();

        // Desde ahí, cambiarla sí pide la actual
        $this->put('/settings/password', ['password' => 'Otra-Clave-2026', 'password_confirmation' => 'Otra-Clave-2026'])
            ->assertSessionHasErrors('current_password');
    }

    public function test_con_cedula_la_sesion_no_queda_guardada_en_el_equipo(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Camion-Azul-27', 'debe_cambiar_contrasena' => false]);
        $recordar = auth()->guard()->getRecallerName();

        // Aunque llegue marcada (p. ej. desde un formulario viejo), con cédula no se guarda: el teléfono puede ser compartido
        $this->post('/login', ['email' => '1144203579', 'password' => 'Camion-Azul-27', 'remember' => true])
            ->assertRedirect('/panel')
            ->assertCookieMissing($recordar);
        $this->post('/logout');

        // Con correo, sí
        $coordinador = User::factory()->coordinador()->create(['email' => 'coordinador@example.com']);
        $this->post('/login', ['email' => 'coordinador@example.com', 'password' => 'password', 'remember' => true])
            ->assertCookie($recordar);
        $this->assertAuthenticatedAs($coordinador);
    }

    public function test_al_darle_un_codigo_nuevo_su_recordarme_en_otros_equipos_deja_de_servir(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Su-Clave-2026', 'debe_cambiar_contrasena' => false]);
        $auxiliar->forceFill(['remember_token' => 'token-de-un-telefono-viejo'])->save();

        $auxiliar->update(User::contrasenaInicial());

        $this->assertNotSame('token-de-un-telefono-viejo', $auxiliar->fresh()->remember_token);
    }

    public function test_el_auxiliar_operativo_solo_ve_su_carnet_y_su_contrasena(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['debe_cambiar_contrasena' => false]);

        $this->actingAs($auxiliar)->get('/panel')->assertRedirect('/mi-carnet');
        $this->get('/mi-carnet')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('auth.permisos', [])
            ->where('auth.user.inicio.url', '/mi-carnet')
            ->where('auth.user.editaPerfil', false)
            ->where('menu', null));
        foreach (['/lineas/logisticos', '/mis-entregas', '/usuarios', '/informes'] as $url) {
            $this->get($url)->assertForbidden();
        }
        // Sus datos los lleva el carnet: en su cuenta, solo la contraseña
        $this->get('/settings/profile')->assertRedirect('/settings/password');
        $this->patch('/settings/profile', ['nombres' => 'Otro', 'primer_apellido' => 'Nombre'])->assertForbidden();
    }

    public function test_el_correo_sigue_sirviendo_y_sin_acceso_no_entra(): void
    {
        $coordinador = User::factory()->coordinador()->create(['email' => 'coordinador@example.com']);
        $this->post('/login', ['email' => 'Coordinador@Example.com', 'password' => 'password'])->assertRedirect('/panel');
        $this->assertAuthenticatedAs($coordinador);
        $this->post('/logout');

        User::factory()->sinAcceso()->create(['cedula' => '99887766']);
        $this->post('/login', ['email' => '99887766', 'password' => '99887766'])->assertSessionHasErrors('ingreso');
        $this->assertGuest();
        $this->post('/login', ['email' => 'sin numeros', 'password' => 'x'])->assertSessionHasErrors('email');
    }

    public function test_el_administrador_le_da_un_codigo_inicial_nuevo_y_lo_consulta_en_la_lista(): void
    {
        $admin = User::factory()->admin()->create();
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Su-Clave-2026', 'debe_cambiar_contrasena' => false]);
        $this->assertNull($auxiliar->fresh()->codigo_inicial);

        $respuesta = $this->actingAs($admin)->put("/usuarios/{$auxiliar->id}", [
            'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'cedula' => '1144203579', 'cargo' => 'Auxiliar logístico',
            'rol_id' => $auxiliar->rol_id, 'acceso' => true, 'restablecer' => true,
        ])->assertSessionHasNoErrors();

        // Un código de 8 cifras al azar (no su cédula), que se le dice a quien lo generó
        $auxiliar->refresh();
        $codigo = $auxiliar->codigo_inicial;
        $this->assertMatchesRegularExpression('/^\d{8}$/', $codigo);
        $this->assertTrue($auxiliar->debe_cambiar_contrasena);
        $this->assertTrue(Hash::check($codigo, $auxiliar->password));
        $this->assertFalse(Hash::check('Su-Clave-2026', $auxiliar->password));
        $respuesta->assertSessionHas('success', fn (string $m) => str_contains($m, User::formatoCodigo($codigo)));

        // Va cifrado en la base de datos y nunca en las respuestas del modelo
        $this->assertNotSame($codigo, DB::table('users')->where('id', $auxiliar->id)->value('codigo_inicial'));
        $this->assertArrayNotHasKey('codigo_inicial', $auxiliar->toArray());

        // En Usuarios lo ve quien puede editar a la persona, y el filtro reúne a quienes aún lo tienen por entregar
        $this->get('/usuarios?acceso=codigo')->assertInertia(fn (Assert $p) => $p
            ->has('usuarios.data', 1)
            ->where('usuarios.data.0.contrasenaInicial', true)
            ->where('usuarios.data.0.codigoInicial', User::formatoCodigo($codigo)));
    }

    public function test_el_error_habla_de_lo_que_se_escribio_y_avisa_antes_del_bloqueo(): void
    {
        $this->auxiliar();

        // Sin @ ni números no es ni correo ni cédula: es un error del campo, no un intento
        $this->post('/login', ['email' => 'juan plaza', 'password' => 'x'])
            ->assertSessionHasErrors(['email' => 'Escribe tu correo completo (con @) o tu número de cédula.']);
        $this->post('/login', ['email' => '1144203579', 'password' => ''])->assertSessionHasErrors(['password' => 'Escribe tu contraseña.']);

        // Con cédula, el error dice "cédula"; con correo, "correo"
        $this->post('/login', ['email' => '1144203579', 'password' => 'otra'])
            ->assertSessionHasErrors(['ingreso' => 'La cédula o la contraseña no son correctas.']);
        $this->post('/login', ['email' => 'nadie@example.com', 'password' => 'otra'])
            ->assertSessionHasErrors(['ingreso' => 'El correo o la contraseña no son correctos.']);

        // "1.144.203.579" es la misma cédula: suma al mismo contador (2.º, 3.º y, en el 4.º, el aviso)
        $this->post('/login', ['email' => '1.144.203.579', 'password' => 'otra']);
        $this->post('/login', ['email' => '1144 203 579', 'password' => 'otra'])
            ->assertSessionHasErrors(['ingreso' => 'La cédula o la contraseña no son correctas.']);
        $this->post('/login', ['email' => '1144203579', 'password' => 'otra'])
            ->assertSessionHasErrors(['ingreso' => 'La cédula o la contraseña no son correctas. Te queda un intento: si fallas otra vez, tendrás que esperar antes de volver a intentarlo.']);

        // El 5.º fallo ya trae el bloqueo, con los segundos que de verdad faltan (no el intento siguiente)
        $this->post('/login', ['email' => '1144203579', 'password' => 'otra'])->assertSessionHasErrors('bloqueo');
        $segundos = (int) session('errors')->first('bloqueo');
        $this->assertTrue($segundos > 0 && $segundos <= 60);
        $this->assertStringStartsWith('Hiciste demasiados intentos seguidos. Espera ', session('errors')->first('ingreso'));

        // Bloqueado: aun con la contraseña correcta, toca esperar
        $this->post('/login', ['email' => '1.144.203.579', 'password' => '48312290'])->assertSessionHasErrors('bloqueo');
        $this->assertGuest();
    }

    public function test_el_bloqueo_se_alarga_si_se_repite_y_se_olvida_al_entrar_bien(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Camion-Azul-27', 'debe_cambiar_contrasena' => false]);
        $bloquear = function (): int {
            foreach (range(1, 5) as $i) {
                $respuesta = $this->post('/login', ['email' => '1144203579', 'password' => "mala-{$i}"]);
            }
            $respuesta->assertSessionHasErrors('bloqueo');

            return (int) session('errors')->first('bloqueo');
        };

        // 1.º bloqueo: un minuto; 2.º: cinco; 3.º: quince
        $this->assertEqualsWithDelta(60, $bloquear(), 2);
        $this->travel(61)->seconds();
        $this->assertEqualsWithDelta(300, $bloquear(), 2);
        $this->assertStringContainsString('Espera 5 minutos', session('errors')->first('ingreso'));
        $this->travel(301)->seconds();
        $this->assertEqualsWithDelta(900, $bloquear(), 2);

        // Al entrar bien, la cuenta de bloqueos vuelve a empezar
        $this->travel(901)->seconds();
        $this->post('/login', ['email' => '1144203579', 'password' => 'Camion-Azul-27'])->assertRedirect();
        $this->post('/logout');
        $this->assertEqualsWithDelta(60, $bloquear(), 2);
    }

    public function test_un_mismo_equipo_no_puede_probar_muchas_cedulas(): void
    {
        // 20 fallos con cédulas distintas desde el mismo equipo: el siguiente intento espera, con cualquier cuenta
        foreach (range(1, 20) as $i) {
            $this->post('/login', ['email' => (string) (5550000000 + $i), 'password' => 'mala']);
        }
        $this->post('/login', ['email' => '5559999999', 'password' => 'mala'])->assertSessionHasErrors('bloqueo');
        $this->assertGuest();
    }

    public function test_sin_arroba_solo_vale_una_cedula(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Camion-Azul-27', 'debe_cambiar_contrasena' => false]);

        // Un correo a medias no es la cédula "2": es un error del campo y no cuenta como intento
        $this->post('/login', ['email' => 'ana.ruiz2gmail.com', 'password' => 'x'])
            ->assertSessionHasErrors(['email' => 'Escribe tu correo completo (con @) o tu número de cédula.'])
            ->assertSessionDoesntHaveErrors('ingreso');

        // La cédula con puntos, espacios o guiones sí vale
        $this->post('/login', ['email' => '1.144-203 579', 'password' => 'Camion-Azul-27'])->assertRedirect();
        $this->assertAuthenticatedAs($auxiliar);
    }

    public function test_quien_escribio_su_cedula_llega_a_la_recuperacion_por_su_camino(): void
    {
        $this->get('/forgot-password?con=cedula')->assertInertia(fn (Assert $p) => $p->where('con', 'cedula'));
        $this->get('/forgot-password')->assertInertia(fn (Assert $p) => $p->where('con', 'correo'));

        // De vuelta de pedir un enlace (con correo), abre en el correo aunque la dirección diga otra cosa
        $this->withSession(['status' => 'Enviado'])->get('/forgot-password?con=cedula')->assertInertia(fn (Assert $p) => $p->where('con', 'correo'));
    }

    public function test_al_ingresar_la_plataforma_se_carga_completa_y_el_sitio_publico_no_trae_sus_rutas(): void
    {
        $auxiliar = $this->auxiliar();
        $auxiliar->update(['password' => 'Camion-Azul-27', 'debe_cambiar_contrasena' => false]);

        // Sin sesión, solo las rutas del sitio público: ni el mapa de la plataforma ni su peso
        $this->get('/login')->assertOk()->assertSee('"password.request"', false)->assertDontSee('"usuarios.index"', false);

        // Desde la pantalla de ingreso (Inertia), la plataforma se abre con una carga completa, que trae todas sus rutas
        $this->post('/login', ['email' => '1144203579', 'password' => 'Camion-Azul-27'], ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location');
        $this->assertAuthenticatedAs($auxiliar);
        $this->get('/mi-carnet')->assertOk()->assertSee('"usuarios.index"', false);
    }
}
