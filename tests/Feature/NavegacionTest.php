<?php

namespace Tests\Feature;

use App\Enums\EstadoCarga;
use App\Models\Carga;
use App\Models\LineaServicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Regresar siempre es posible: el enlace "Volver" y las páginas de error con salida. */
class NavegacionTest extends TestCase
{
    use RefreshDatabase;

    public function test_cada_quien_sabe_a_donde_vuelve(): void
    {
        $this->actingAs(User::factory()->admin()->create())->get('/empresas')
            ->assertInertia(fn (Assert $p) => $p->where('auth.user.inicio.volver', 'Volver al panel')->where('auth.user.inicio.url', '/panel'));

        $this->actingAs(User::factory()->coordinador()->create())->get('/settings/profile')
            ->assertInertia(fn (Assert $p) => $p->where('auth.user.inicio.volver', 'Volver a '.LineaServicio::logistica()->nombre));
    }

    public function test_sin_permiso_explica_el_motivo_y_ofrece_volver_a_su_inicio(): void
    {
        $deAseo = User::factory()->coordinador()->create(['linea_servicio_id' => LineaServicio::where('slug', 'aseo-general')->value('id')]);

        $this->actingAs($deAseo)->get('/cargas')
            ->assertForbidden()
            ->assertInertia(fn (Assert $p) => $p->component('error')
                ->where('estado', 403)
                ->where('mensaje', 'Esta herramienta es de otra línea de servicio.')
                ->where('volver.href', '/lineas/aseo-general'));
    }

    public function test_una_direccion_que_no_existe_lleva_de_vuelta_al_sitio_web(): void
    {
        $this->get('/no-existe')
            ->assertNotFound()
            ->assertInertia(fn (Assert $p) => $p->component('error')
                ->where('estado', 404)
                ->where('mensaje', null)
                ->where('volver', ['texto' => 'Volver al sitio web', 'href' => '/']));
    }

    public function test_una_direccion_que_no_existe_con_sesion_lleva_al_inicio_de_quien_navega(): void
    {
        $admin = User::factory()->admin()->create();
        $this->post('/login', ['email' => $admin->email, 'password' => 'password']);

        $this->get('/usuario-mal-escrito')
            ->assertNotFound()
            ->assertInertia(fn (Assert $p) => $p->component('error')->where('publico', false)->where('volver', ['texto' => 'Volver al panel', 'href' => '/panel']));
    }

    public function test_la_sesion_vencida_vuelve_a_la_pagina_con_un_aviso(): void
    {
        Route::middleware('web')->post('/prueba-sesion-vencida', fn () => throw new TokenMismatchException);

        $this->actingAs(User::factory()->admin()->create())
            ->from('/usuarios')
            ->post('/prueba-sesion-vencida')
            ->assertStatus(303)
            ->assertRedirect('/usuarios')
            ->assertSessionHas('error', 'Tu sesión expiró por inactividad. Vuelve a intentarlo.');
    }

    public function test_una_accion_que_ya_no_se_puede_hacer_vuelve_con_el_motivo(): void
    {
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('b', 64), 'estado' => EstadoCarga::Procesada]);

        // Sin quedar en una dirección que no se abre con GET (405 al recargar)
        $this->actingAs(User::factory()->admin()->create())
            ->from("/cargas/{$carga->id}")
            ->patch("/cargas/{$carga->id}", ['hoja' => 'Otra'])
            ->assertStatus(303)
            ->assertRedirect("/cargas/{$carga->id}")
            ->assertSessionHas('error', 'La carga ya fue procesada.');
    }

    public function test_en_el_ingreso_un_codigo_vencido_pide_la_contrasena_de_nuevo_y_no_habla_de_sesion(): void
    {
        // Como si la página de ingreso llevara horas abierta: el código de seguridad ya no corresponde
        Route::middleware('web')->post('/login', fn () => throw new TokenMismatchException);

        $this->from('/login')->post('/login', ['email' => 'nadie@example.com', 'password' => 'x'])
            ->assertStatus(303)
            ->assertRedirect('/login')
            ->assertSessionHasErrors(['password' => 'La página llevaba mucho tiempo abierta: escribe de nuevo la contraseña.'])
            ->assertSessionMissing('status');
    }

    public function test_un_correo_que_no_existe_dice_que_los_datos_no_son_correctos(): void
    {
        $this->from('/login')->post('/login', ['email' => 'nadie@example.com', 'password' => 'cualquiera'])
            ->assertRedirect('/login')
            ->assertSessionHasErrors(['email' => 'El correo o la contraseña no son correctos.']);
        $this->assertGuest();
    }

    public function test_cada_pagina_comparte_el_codigo_de_seguridad_de_la_sesion(): void
    {
        // El navegador lo envía en X-CSRF-TOKEN: así otra app Laravel en la misma dirección no lo pisa con su cookie
        $this->actingAs(User::factory()->admin()->create())->get('/usuarios')
            ->assertInertia(fn (Assert $p) => $p->where('csrf', session()->token()));
        // También a quien aún no ingresa (el formulario de ingreso lo necesita)
        auth()->logout();
        $this->get('/login')->assertInertia(fn (Assert $p) => $p->where('csrf', session()->token()));
    }

    public function test_con_la_sesion_iniciada_el_inicio_de_sesion_lleva_a_su_inicio(): void
    {
        // Es lo que ve quien vuelve con «Atrás» al inicio de sesión: la app pide la página y el servidor la redirige
        $this->actingAs(User::factory()->admin()->create())->get('/login')->assertRedirect('/panel');
        $this->get('/forgot-password')->assertRedirect('/panel');

        // Quien trabaja en una sola línea, directo a ella
        $this->actingAs(User::factory()->coordinador()->create())->get('/login')
            ->assertRedirect('/lineas/'.LineaServicio::logistica()->slug);
    }

    public function test_al_salir_cambia_el_codigo_de_la_sesion(): void
    {
        // Con él, la app reconoce las páginas guardadas en el historial que son de una sesión anterior
        $admin = User::factory()->admin()->create();
        $this->post('/login', ['email' => $admin->email, 'password' => 'password']);
        $antes = session()->token();

        $this->post('/logout', ['_token' => $antes]);
        $this->assertGuest();
        $this->assertNotSame($antes, session()->token());
    }
}
