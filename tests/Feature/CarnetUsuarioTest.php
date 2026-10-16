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

/** El carnet de cada usuario: imagen privada que solo maneja la administración. */
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

    public function test_al_crear_el_usuario_se_guarda_su_carnet_en_el_disco_privado(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['carnet' => UploadedFile::fake()->image('carnet.png', 640, 640)]))
            ->assertSessionHasNoErrors();

        $usuario = User::where('email', 'johnny@example.com')->sole();
        $this->assertStringStartsWith("carnets/{$usuario->id}/", $usuario->carnet_path);
        Storage::disk('local')->assertExists($usuario->carnet_path);
        // Nunca en el disco público (no tiene dirección abierta)
        $this->assertSame([], Storage::disk('public')->allFiles());

        // La lista entrega una dirección de la administración, no la ruta del archivo
        $this->actingAs($this->admin)->get('/usuarios')->assertInertia(fn (Assert $p) => $p
            ->where('usuarios.data', fn ($filas) => collect($filas)->firstWhere('email', 'johnny@example.com')['carnet'] !== null
                && ! str_contains(collect($filas)->firstWhere('email', 'johnny@example.com')['carnet'], 'carnets/')));
    }

    public function test_al_reemplazar_el_carnet_se_borra_el_anterior_y_al_quitarlo_queda_sin_carnet(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['carnet' => UploadedFile::fake()->image('uno.jpg')]));
        $usuario = User::where('email', 'johnny@example.com')->sole();
        $anterior = $usuario->carnet_path;

        // Con archivo, la edición llega como POST con _method=put (formulario con archivos)
        $this->actingAs($this->admin)->post("/usuarios/{$usuario->id}", $this->datos(['_method' => 'put', 'password' => '', 'carnet' => UploadedFile::fake()->image('dos.jpg')]))
            ->assertSessionHasNoErrors();
        $nuevo = $usuario->fresh()->carnet_path;
        $this->assertNotSame($anterior, $nuevo);
        Storage::disk('local')->assertMissing($anterior);
        Storage::disk('local')->assertExists($nuevo);

        // Editar otros datos no toca el carnet
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['nombres' => 'Johnny Alberto', 'password' => '']))->assertSessionHasNoErrors();
        $this->assertSame($nuevo, $usuario->fresh()->carnet_path);

        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['password' => '', 'quitar_carnet' => true]))->assertSessionHasNoErrors();
        $this->assertNull($usuario->fresh()->carnet_path);
        Storage::disk('local')->assertMissing($nuevo);
    }

    public function test_el_carnet_debe_ser_una_imagen_liviana(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['carnet' => UploadedFile::fake()->create('carnet.pdf', 200, 'application/pdf')]))
            ->assertSessionHasErrors(['carnet' => 'El carnet debe ser una imagen JPG, PNG o WebP.']);
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['carnet' => UploadedFile::fake()->image('enorme.jpg')->size(9000)]))
            ->assertSessionHasErrors(['carnet' => 'La imagen del carnet no puede pesar más de 8 MB.']);
        $this->assertSame(0, User::where('email', 'johnny@example.com')->count());
    }

    public function test_solo_la_administracion_ve_el_carnet(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['carnet' => UploadedFile::fake()->image('carnet.jpg')]));
        $usuario = User::where('email', 'johnny@example.com')->sole();

        $this->actingAs($this->admin)->get("/usuarios/{$usuario->id}/carnet")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Ni siquiera la misma persona: el carnet se maneja desde la administración
        $this->actingAs($usuario)->get("/usuarios/{$usuario->id}/carnet")->assertForbidden();
        auth()->logout();
        $this->get("/usuarios/{$usuario->id}/carnet")->assertRedirect('/login');

        // Sin carnet no hay nada que mostrar
        $this->actingAs($this->admin)->get("/usuarios/{$this->admin->id}/carnet")->assertNotFound();
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
