<?php

namespace Tests\Feature;

use App\Models\LineaServicio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * El carnet de cada usuario: la plataforma lo arma con su foto (privada, solo la maneja la administración), su
 * cédula y su cargo. Su QR lleva a una verificación pública.
 */
class CarnetUsuarioTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        $this->admin = User::factory()->admin()->create();
    }

    private function datos(array $extra = []): array
    {
        return [
            'nombres' => 'Johnny', 'primer_apellido' => 'Correa', 'email' => 'johnny@example.com', 'rol' => 'coordinador',
            'linea_id' => LineaServicio::logistica()->id, 'password' => 'Clave-segura-1', ...$extra,
        ];
    }

    public function test_al_crear_el_usuario_se_guardan_su_foto_su_cedula_y_su_cargo(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos([
            'cedula' => '1.144.123.456',
            'cargo' => 'Gerente general',
            'foto' => UploadedFile::fake()->image('foto.png', 600, 800),
        ]))->assertSessionHasNoErrors();

        $usuario = User::where('email', 'johnny@example.com')->sole();
        // La cédula se guarda solo con sus números
        $this->assertSame('1144123456', $usuario->cedula);
        $this->assertSame('Gerente general', $usuario->cargo);
        $this->assertStringStartsWith("fotos/{$usuario->id}/", $usuario->foto_path);
        Storage::disk('local')->assertExists($usuario->foto_path);
        // Nunca en el disco público (no tiene dirección abierta)
        $this->assertSame([], Storage::disk('public')->allFiles());
        // Cada persona nace con el código de su QR
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{12}$/', $usuario->carnet_codigo);

        // La lista entrega una dirección de la administración, no la ruta del archivo
        $this->actingAs($this->admin)->get('/usuarios')->assertInertia(fn (Assert $p) => $p
            ->where('usuarios.data', function ($filas) {
                $fila = collect($filas)->firstWhere('email', 'johnny@example.com');

                return $fila['foto'] !== null && ! str_contains($fila['foto'], 'fotos/') && $fila['cedula'] === '1144123456';
            }));
    }

    public function test_al_reemplazar_la_foto_se_borra_la_anterior_y_al_quitarla_queda_sin_foto(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['foto' => UploadedFile::fake()->image('uno.jpg')]));
        $usuario = User::where('email', 'johnny@example.com')->sole();
        $anterior = $usuario->foto_path;

        // Con archivo, la edición llega como POST con _method=put (formulario con archivos)
        $this->actingAs($this->admin)->post("/usuarios/{$usuario->id}", $this->datos(['_method' => 'put', 'password' => '', 'foto' => UploadedFile::fake()->image('dos.png')]))
            ->assertSessionHasNoErrors();
        $nueva = $usuario->fresh()->foto_path;
        $this->assertNotSame($anterior, $nueva);
        Storage::disk('local')->assertMissing($anterior);
        Storage::disk('local')->assertExists($nueva);

        // Editar otros datos no toca la foto
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['nombres' => 'Johnny Alberto', 'password' => '']))->assertSessionHasNoErrors();
        $this->assertSame($nueva, $usuario->fresh()->foto_path);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['password' => '', 'quitar_foto' => true]))->assertSessionHasNoErrors();
        $this->assertNull($usuario->fresh()->foto_path);
        Storage::disk('local')->assertMissing($nueva);
    }

    public function test_valida_la_foto_la_cedula_y_el_cargo(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos([
            'foto' => UploadedFile::fake()->create('foto.pdf', 200, 'application/pdf'),
            'cedula' => 'CC 12',
            'cargo' => str_repeat('a', 61),
        ]))->assertSessionHasErrors([
            'foto' => 'La foto debe ser una imagen JPG, PNG o WebP.',
            'cedula' => 'Escribe solo los números de la cédula (entre 5 y 12).',
            'cargo',
        ]);
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['foto' => UploadedFile::fake()->image('enorme.jpg')->size(9000)]))
            ->assertSessionHasErrors(['foto' => 'La foto no puede pesar más de 8 MB.']);

        // Dos personas no comparten cédula
        User::factory()->create(['cedula' => '1144123456']);
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['cedula' => '1144123456']))
            ->assertSessionHasErrors(['cedula' => 'Ya hay un usuario con esta cédula.']);

        $this->assertSame(0, User::where('email', 'johnny@example.com')->count());
    }

    public function test_solo_la_administracion_ve_la_foto_y_el_carnet(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['foto' => UploadedFile::fake()->image('foto.jpg')]));
        $usuario = User::where('email', 'johnny@example.com')->sole();

        $this->actingAs($this->admin)->get("/usuarios/{$usuario->id}/foto")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Ni siquiera la misma persona: la foto y el carnet se manejan desde la administración
        $this->actingAs($usuario)->get("/usuarios/{$usuario->id}/foto")->assertForbidden();
        $this->actingAs($usuario)->get("/usuarios/{$usuario->id}/carnet")->assertForbidden();
        auth()->logout();
        $this->get("/usuarios/{$usuario->id}/foto")->assertRedirect('/login');

        // Sin foto no hay nada que mostrar
        $this->actingAs($this->admin)->get("/usuarios/{$this->admin->id}/foto")->assertNotFound();
    }

    public function test_el_carnet_lleva_los_datos_de_la_persona_y_su_qr(): void
    {
        $usuario = User::factory()->create([
            'nombres' => 'Ana María', 'primer_apellido' => 'Gómez', 'segundo_apellido' => 'Ruiz',
            'cedula' => '1144123456', 'cargo' => 'Auxiliar logístico', 'email' => 'ana@example.com',
        ]);

        $this->actingAs($this->admin)->get("/usuarios/{$usuario->id}/carnet")
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('usuarios/carnet')
                ->where('persona.nombres', 'Ana María')
                ->where('persona.apellidos', 'Gómez Ruiz')
                ->where('persona.cedula', '1144123456')
                ->where('persona.cargo', 'Auxiliar logístico')
                ->where('persona.tieneCargo', true)
                ->where('persona.email', 'ana@example.com')
                ->where('persona.foto', null)
                ->where('persona.qr', route('carnet.verificar', $usuario->carnet_codigo)));

        // Sin cargo escrito, el carnet lleva el rol
        $sinCargo = User::factory()->coordinador()->create(['cargo' => null]);
        $this->actingAs($this->admin)->get("/usuarios/{$sinCargo->id}/carnet")->assertInertia(fn (Assert $p) => $p
            ->where('persona.cargo', 'Coordinador / Supervisor')
            ->where('persona.tieneCargo', false));
    }

    public function test_al_escanear_el_qr_se_ve_si_el_carnet_esta_vigente(): void
    {
        $usuario = User::factory()->create(['nombres' => 'Johnny', 'primer_apellido' => 'Correa', 'cargo' => 'Gerente general']);

        // Página pública: no hace falta ingresar
        $this->get("/carnet/{$usuario->carnet_codigo}")
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('carnet/verificar')
                ->where('nombre', 'Johnny Correa')
                ->where('cargo', 'Gerente general')
                ->where('vigente', true)
                // No se expone nada más de la persona
                ->missing('email')
                ->missing('cedula'));

        $usuario->update(['activo' => false]);
        $this->get("/carnet/{$usuario->carnet_codigo}")->assertInertia(fn (Assert $p) => $p->where('vigente', false));

        $this->get('/carnet/'.str_repeat('x', 12))->assertNotFound();
        $this->get('/carnet/corto')->assertNotFound();
    }

    public function test_si_el_hosting_descarta_un_envio_pesado_se_vuelve_al_formulario_con_un_aviso(): void
    {
        // Como cuando el envío supera post_max_size de PHP
        Route::middleware('web')->post('/prueba-pesado', fn () => throw new PostTooLargeException);

        $this->actingAs($this->admin)->from('/usuarios')->post('/prueba-pesado')
            ->assertStatus(303)
            ->assertRedirect('/usuarios')
            ->assertSessionHas('error', 'Lo que intentaste enviar pesa demasiado para el servidor. Usa un archivo más liviano.');
    }
}
