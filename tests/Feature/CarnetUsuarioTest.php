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

    public function test_la_administracion_ve_la_foto_y_el_carnet_de_cualquiera(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['foto' => UploadedFile::fake()->image('foto.jpg')]));
        $usuario = User::where('email', 'johnny@example.com')->sole();

        $this->actingAs($this->admin)->get("/usuarios/{$usuario->id}/foto")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Las direcciones de la administración no son para los demás (cada quien ve lo suyo en Mi carnet)
        $this->actingAs($usuario)->get("/usuarios/{$usuario->id}/foto")->assertForbidden();
        $this->actingAs($usuario)->get("/usuarios/{$usuario->id}/carnet")->assertForbidden();
        auth()->logout();
        $this->get("/usuarios/{$usuario->id}/foto")->assertRedirect('/login');

        // Sin foto no hay nada que mostrar
        $this->actingAs($this->admin)->get("/usuarios/{$this->admin->id}/foto")->assertNotFound();
    }

    public function test_cada_persona_ve_su_propio_carnet_y_solo_el_suyo(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos([
            'cedula' => '1144123456',
            'cargo' => 'Auxiliar logístico',
            'foto' => UploadedFile::fake()->image('foto.jpg'),
        ]));
        $usuario = User::where('email', 'johnny@example.com')->sole();
        $otro = User::factory()->create(['cedula' => '99887766']);

        $this->actingAs($usuario)->get('/mi-carnet')
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('carnet/ver')
                ->where('propio', true)
                ->where('persona.id', $usuario->id)
                ->where('persona.cedula', '1144123456')
                ->where('persona.cargo', 'Auxiliar logístico')
                // Su foto le llega por su propia dirección, no por la de la administración
                ->where('persona.foto', fn ($foto) => str_contains($foto, '/mi-carnet/foto'))
                ->where('persona.qr', route('carnet.verificar', $usuario->carnet_codigo)));

        $this->actingAs($usuario)->get('/mi-carnet/foto')->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');

        // Quien no tiene foto ve su carnet igual, con el aviso de lo que falta
        $this->actingAs($otro)->get('/mi-carnet')->assertInertia(fn (Assert $p) => $p
            ->where('persona.id', $otro->id)
            ->where('persona.foto', null));
        $this->actingAs($otro)->get('/mi-carnet/foto')->assertNotFound();

        auth()->logout();
        $this->get('/mi-carnet')->assertRedirect('/login');
        $this->get('/mi-carnet/foto')->assertRedirect('/login');
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
                ->component('carnet/ver')
                ->where('propio', false)
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

    public function test_al_crear_o_editar_se_guarda_la_arl_en_pdf_o_imagen(): void
    {
        $this->freezeSecond();
        $this->actingAs($this->admin)->post('/usuarios', $this->datos([
            'arl' => UploadedFile::fake()->create('arl.pdf', 300, 'application/pdf'),
        ]))->assertSessionHasNoErrors();

        $usuario = User::where('email', 'johnny@example.com')->sole();
        $pdf = $usuario->arl_path;
        $this->assertStringStartsWith("arl/{$usuario->id}/", $pdf);
        $this->assertStringEndsWith('.pdf', $pdf);
        $this->assertTrue($usuario->arl_subida_en->equalTo(now()));
        Storage::disk('local')->assertExists($pdf);

        // La lista dice si es PDF y entrega una dirección de la administración
        $this->actingAs($this->admin)->get('/usuarios')->assertInertia(fn (Assert $p) => $p->where('usuarios.data', function ($filas) {
            $fila = collect($filas)->firstWhere('email', 'johnny@example.com');

            return $fila['arlEsPdf'] === true && str_contains($fila['arl'], "/usuarios/{$fila['id']}/arl");
        }));
        $this->actingAs($this->admin)->get("/usuarios/{$usuario->id}/arl")->assertOk()->assertHeader('Content-Type', 'application/pdf');

        // Reemplazarla por una imagen borra el PDF y renueva la fecha
        $this->travel(2)->days();
        $this->actingAs($this->admin)->post("/usuarios/{$usuario->id}", $this->datos(['_method' => 'put', 'password' => '', 'arl' => UploadedFile::fake()->image('arl.jpg')]))
            ->assertSessionHasNoErrors();
        $usuario->refresh();
        Storage::disk('local')->assertMissing($pdf);
        $this->assertStringEndsWith('.jpg', $usuario->arl_path);
        $this->assertTrue($usuario->arl_subida_en->equalTo(now()));

        // Editar otros datos no la toca; quitarla la borra
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['password' => '', 'cargo' => 'Auxiliar']))->assertSessionHasNoErrors();
        $this->assertNotNull($usuario->fresh()->arl_path);
        $imagen = $usuario->fresh()->arl_path;
        $this->actingAs($this->admin)->put("/usuarios/{$usuario->id}", $this->datos(['password' => '', 'quitar_arl' => true]))->assertSessionHasNoErrors();
        $this->assertNull($usuario->fresh()->arl_path);
        $this->assertNull($usuario->fresh()->arl_subida_en);
        Storage::disk('local')->assertMissing($imagen);
    }

    public function test_la_arl_debe_ser_pdf_o_imagen_liviana(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['arl' => UploadedFile::fake()->create('arl.docx', 50, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')]))
            ->assertSessionHasErrors(['arl' => 'La ARL debe ser un PDF o una imagen JPG, PNG o WebP.']);
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['arl' => UploadedFile::fake()->create('arl.pdf', 11000, 'application/pdf')]))
            ->assertSessionHasErrors(['arl' => 'El archivo de la ARL no puede pesar más de 10 MB.']);
    }

    public function test_al_escanear_el_qr_se_ve_la_informacion_de_la_persona_y_su_arl(): void
    {
        $empresa = $this->empresa('Ditranza');
        $sede = $this->sede('TuGo', [], $empresa);
        $usuario = User::factory()->create([
            'nombres' => 'Johnny', 'primer_apellido' => 'Correa', 'cargo' => 'Gerente general', 'cedula' => '1144123456',
            'email' => 'johnny@example.com', 'empresa_id' => $empresa->id, 'sede_id' => $sede->id,
            'linea_servicio_id' => LineaServicio::logistica()->id,
        ]);
        Storage::disk('local')->put("fotos/{$usuario->id}/foto.jpg", UploadedFile::fake()->image('foto.jpg')->getContent());
        Storage::disk('local')->put("arl/{$usuario->id}/arl.pdf", '%PDF-1.4 prueba');
        $usuario->update(['foto_path' => "fotos/{$usuario->id}/foto.jpg", 'arl_path' => "arl/{$usuario->id}/arl.pdf", 'arl_subida_en' => now()]);
        $codigo = $usuario->carnet_codigo;

        // Página pública: no hace falta ingresar
        $this->get("/carnet/{$codigo}")
            ->assertOk()
            ->assertInertia(fn (Assert $p) => $p
                ->component('carnet/verificar')
                ->where('vigente', true)
                ->where('nombre', 'Johnny Correa')
                ->where('cargo', 'Gerente general')
                ->where('cedula', '1144123456')
                ->where('email', 'johnny@example.com')
                ->where('empresa', 'Ditranza')
                ->where('sede', 'TuGo')
                ->where('linea', LineaServicio::logistica()->nombre)
                ->where('foto', fn ($url) => str_contains($url, "/carnet/{$codigo}/foto"))
                ->where('arl.pdf', true)
                ->where('arl.url', fn ($url) => str_contains($url, "/carnet/{$codigo}/arl")));

        // Los archivos se abren con el mismo código, sin ingresar
        $this->get("/carnet/{$codigo}/arl")->assertOk()->assertHeader('X-Robots-Tag', 'noindex');
        $this->get("/carnet/{$codigo}/foto")->assertOk();

        // Quien ya no está activo: solo "no vigente", sin sus datos ni sus archivos
        $usuario->update(['activo' => false]);
        $this->get("/carnet/{$codigo}")->assertInertia(fn (Assert $p) => $p
            ->where('vigente', false)
            ->where('nombre', 'Johnny Correa')
            ->missing('cedula')
            ->missing('email')
            ->missing('arl'));
        $this->get("/carnet/{$codigo}/arl")->assertNotFound();
        $this->get("/carnet/{$codigo}/foto")->assertNotFound();

        $this->get('/carnet/'.str_repeat('x', 12))->assertNotFound();
        $this->get('/carnet/corto')->assertNotFound();
    }

    public function test_cada_persona_ve_su_propia_arl(): void
    {
        $usuario = User::factory()->create();
        Storage::disk('local')->put("arl/{$usuario->id}/arl.pdf", '%PDF-1.4 prueba');
        $usuario->update(['arl_path' => "arl/{$usuario->id}/arl.pdf", 'arl_subida_en' => now()]);

        $this->actingAs($usuario)->get('/mi-carnet')->assertInertia(fn (Assert $p) => $p->where('persona.arl', fn ($url) => str_contains($url, '/mi-carnet/arl')));
        $this->actingAs($usuario)->get('/mi-carnet/arl')->assertOk();
        // La de otro, no: la dirección de la administración está cerrada para los demás
        $this->actingAs(User::factory()->create())->get("/usuarios/{$usuario->id}/arl")->assertForbidden();
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
