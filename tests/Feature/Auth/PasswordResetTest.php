<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\ContrasenaCambiada;
use App\Notifications\RestablecerContrasena;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use Throwable;

/** "¿Olvidaste tu contraseña?": pedir el enlace por correo y crear una nueva contraseña con él. */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const AVISO = 'en unos minutos te llegará un correo con el enlace';

    /** Pide el enlace y devuelve el código que llegó en el correo. */
    private function pedirEnlace(User $usuario): string
    {
        Notification::fake();
        $this->post('/forgot-password', ['email' => $usuario->email]);

        $token = null;
        Notification::assertSentTo($usuario, RestablecerContrasena::class, function (RestablecerContrasena $aviso) use (&$token) {
            $token = $aviso->token;

            return true;
        });

        return $token;
    }

    public function test_la_pagina_para_pedir_el_enlace_se_muestra()
    {
        $this->get('/forgot-password')->assertOk();
    }

    public function test_al_pedir_el_enlace_llega_el_correo_de_la_plataforma()
    {
        Notification::fake();
        $usuario = User::factory()->create();

        $this->post('/forgot-password', ['email' => $usuario->email])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status', fn ($texto) => str_contains($texto, self::AVISO));

        Notification::assertSentTo($usuario, RestablecerContrasena::class);
    }

    public function test_el_correo_saluda_por_el_nombre_y_trae_el_enlace_y_su_vencimiento()
    {
        $usuario = User::factory()->create(['nombres' => 'Johnny', 'primer_apellido' => 'Correa', 'email' => 'johnny@example.com']);

        $correo = (new RestablecerContrasena('codigo-de-prueba'))->toMail($usuario);
        $html = (string) $correo->render();

        $this->assertSame('Restablece tu contraseña', $correo->subject);
        $this->assertStringContainsString('Hola, Johnny:', $html);
        $this->assertStringContainsString('johnny@example.com', $html);
        $this->assertStringContainsString(route('password.reset', ['token' => 'codigo-de-prueba', 'email' => 'johnny@example.com']), html_entity_decode($html));
        $this->assertStringContainsString('vence en <strong>60 minutos</strong>', $html);
        // El logo va dentro del mensaje (al mostrarlo aquí se convierte en imagen incrustada)
        $this->assertStringContainsString('data:image/png;base64,', $html);

        // Versión en texto plano, para lectores de correo sin HTML
        $texto = view('correos.restablecer-contrasena-texto', ['nombre' => 'Johnny', 'correo' => 'johnny@example.com', 'enlace' => 'https://ejemplo.test/a?b=1&c=2', 'minutos' => 60])->render();
        $this->assertStringContainsString('https://ejemplo.test/a?b=1&c=2', $texto);
    }

    public function test_la_respuesta_es_la_misma_si_el_correo_no_existe_o_la_cuenta_esta_desactivada()
    {
        Notification::fake();
        $inactivo = User::factory()->create(['activo' => false]);

        foreach (['nadie@example.com', $inactivo->email] as $correo) {
            $this->post('/forgot-password', ['email' => $correo])
                ->assertSessionHasNoErrors()
                ->assertSessionHas('status', fn ($texto) => str_contains($texto, self::AVISO));
        }

        Notification::assertNothingSent();
    }

    public function test_un_mismo_equipo_no_puede_pedir_enlaces_sin_limite()
    {
        Notification::fake();

        for ($i = 0; $i < 5; $i++) {
            $this->post('/forgot-password', ['email' => "persona{$i}@example.com"])->assertSessionHasNoErrors();
        }

        $this->post('/forgot-password', ['email' => 'otra@example.com'])
            ->assertSessionHasErrors(['email' => 'Hiciste muchas solicitudes seguidas. Espera 15 minutos y vuelve a intentarlo.']);
    }

    public function test_la_pagina_del_enlace_dice_de_entrada_si_aun_sirve()
    {
        $usuario = User::factory()->create();
        $token = $this->pedirEnlace($usuario);

        $this->get("/reset-password/{$token}?email=".urlencode($usuario->email))
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p->component('auth/reset-password')->where('vigente', true)->where('minutos', 60));

        // Código cambiado, correo de otro o sin correo: no sirve
        $this->get('/reset-password/otro-codigo?email='.urlencode($usuario->email))->assertInertia(fn (Assert $p) => $p->where('vigente', false));
        $this->get("/reset-password/{$token}?email=nadie%40example.com")->assertInertia(fn (Assert $p) => $p->where('vigente', false));
        $this->get("/reset-password/{$token}")->assertInertia(fn (Assert $p) => $p->where('vigente', false));

        // Vencido (más de 60 minutos)
        $this->travel(61)->minutes();
        $this->get("/reset-password/{$token}?email=".urlencode($usuario->email))->assertInertia(fn (Assert $p) => $p->where('vigente', false));
    }

    public function test_con_el_enlace_se_crea_la_nueva_contrasena_y_se_avisa_por_correo()
    {
        $usuario = User::factory()->create();
        $token = $this->pedirEnlace($usuario);

        $this->post('/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'Nueva-clave-2026',
            'password_confirmation' => 'Nueva-clave-2026',
        ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'))
            ->assertSessionHas('status', 'Listo, tu contraseña se cambió. Ya puedes iniciar sesión con la nueva.');

        $this->assertTrue(Hash::check('Nueva-clave-2026', $usuario->fresh()->password));
        Notification::assertSentTo($usuario, ContrasenaCambiada::class);

        // En el ingreso, el correo ya va escrito
        $this->get('/login')->assertInertia(fn (Assert $p) => $p->where('correo', $usuario->email));

        // El enlace solo sirve una vez
        $this->post('/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'Otra-clave-2026',
            'password_confirmation' => 'Otra-clave-2026',
        ])->assertSessionHasErrors(['email' => 'Este enlace para crear una nueva contraseña ya no sirve: venció o ya se usó.']);
    }

    public function test_el_aviso_de_cambio_dice_cuando_fue_en_hora_de_colombia()
    {
        $usuario = User::factory()->create(['nombres' => 'Ana María']);

        $html = (string) (new ContrasenaCambiada(now()->setTimezone('UTC')->setDate(2026, 10, 19)->setTime(20, 5)))->toMail($usuario)->render();

        $this->assertStringContainsString('Hola, Ana María:', $html);
        $this->assertStringContainsString('el 19 de octubre de 2026 a las 3:05 pm (hora de Colombia)', $html);
        $this->assertStringContainsString('¿No fuiste tú?', $html);
    }

    public function test_al_restablecer_se_cierran_las_sesiones_abiertas_en_otros_equipos()
    {
        config(['session.driver' => 'database']);
        $usuario = User::factory()->create();
        $otro = User::factory()->create();
        foreach ([$usuario, $usuario, $otro] as $i => $dueno) {
            DB::table('sessions')->insert(['id' => "sesion-{$i}", 'user_id' => $dueno->id, 'payload' => '', 'last_activity' => time()]);
        }
        $token = Password::createToken($usuario);

        $this->post('/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'Nueva-clave-2026',
            'password_confirmation' => 'Nueva-clave-2026',
        ])->assertSessionHasNoErrors();

        $this->assertSame(0, DB::table('sessions')->where('user_id', $usuario->id)->count());
        $this->assertSame(1, DB::table('sessions')->where('user_id', $otro->id)->count());
    }

    public function test_un_enlace_falso_no_delata_si_el_correo_existe()
    {
        $usuario = User::factory()->create();
        $datos = ['token' => 'inventado', 'password' => 'Nueva-clave-2026', 'password_confirmation' => 'Nueva-clave-2026'];
        $mensaje = 'Este enlace para crear una nueva contraseña ya no sirve: venció o ya se usó.';

        $this->post('/reset-password', [...$datos, 'email' => $usuario->email])->assertSessionHasErrors(['email' => $mensaje]);
        $this->post('/reset-password', [...$datos, 'email' => 'nadie@example.com'])->assertSessionHasErrors(['email' => $mensaje]);
    }

    public function test_a_quien_desactivaron_despues_de_pedir_el_enlace_no_le_sirve()
    {
        $usuario = User::factory()->create();
        $token = Password::createToken($usuario);
        $usuario->update(['activo' => false]);

        $this->post('/reset-password', [
            'token' => $token,
            'email' => $usuario->email,
            'password' => 'Nueva-clave-2026',
            'password_confirmation' => 'Nueva-clave-2026',
        ])->assertSessionHasErrors('email');

        $this->assertFalse(Hash::check('Nueva-clave-2026', $usuario->fresh()->password));
    }

    public function test_si_el_servidor_de_correo_falla_la_persona_ve_la_misma_respuesta_y_el_error_queda_registrado()
    {
        $usuario = User::factory()->create();
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 1]);
        $reportados = [];
        $this->app->make(ExceptionHandler::class)->reportable(function (Throwable $e) use (&$reportados) {
            $reportados[] = $e;
        });

        $this->post('/forgot-password', ['email' => $usuario->email])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status', fn ($texto) => str_contains($texto, self::AVISO));

        $this->assertNotEmpty($reportados);
    }
}
