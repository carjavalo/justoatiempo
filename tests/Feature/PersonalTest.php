<?php

namespace Tests\Feature;

use App\Enums\Rol;
use App\Models\Carga;
use App\Models\Empresa;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\RolUsuario;
use App\Models\SolicitudContacto;
use App\Models\User;
use App\Models\Vehiculo;
use App\Notifications\RestablecerContrasena;
use App\Services\Drivin\GeneradorPreliquidacion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Una sola lista de personal: auxiliares, conductores y operarios son usuarios con su carnet; entrar a la plataforma
 * es opcional. Drivin los reconoce por la cédula y el Excel del personal se importa en Usuarios.
 */
class PersonalTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->admin = User::factory()->admin()->create();
    }

    /** Lo que envía el formulario de usuarios. */
    private function datos(array $extra = []): array
    {
        return [
            'nombres' => 'Cristian Alejandro', 'primer_apellido' => 'Aponza', 'segundo_apellido' => 'Mina',
            'cedula' => '1061428366', 'cargo' => 'Auxiliar logístico', 'rol_id' => $this->rolBase(Rol::Auxiliar),
            'acceso' => false, 'email' => '', 'password' => '', ...$extra,
        ];
    }

    public function test_se_registra_personal_sin_acceso_a_la_plataforma(): void
    {
        $this->actingAs($this->admin)->post('/usuarios', $this->datos([
            'telefono' => '317 766 6236', 'ciudad' => 'Cali', 'fecha_nacimiento' => '2004-04-15', 'fecha_ingreso' => '2026-03-10',
        ]))->assertSessionHasNoErrors();

        $cristian = User::where('cedula', '1061428366')->sole();
        $this->assertFalse($cristian->acceso);
        $this->assertNull($cristian->email);
        $this->assertNull($cristian->password);
        $this->assertSame(['317 766 6236', 'Cali', '2004-04-15', '2026-03-10'], [$cristian->telefono, $cristian->ciudad, $cristian->fecha_nacimiento->toDateString(), $cristian->fecha_ingreso->toDateString()]);
        $this->assertNotNull($cristian->carnet_codigo);

        // Sin acceso, la cédula es obligatoria: es la que lo identifica
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['cedula' => '']))
            ->assertSessionHasErrors(['cedula' => 'Escribe la cédula: sin acceso a la plataforma, es la que identifica a la persona.']);
        // Con acceso, sin cédula: correo y contraseña
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['cedula' => '', 'acceso' => true]))
            ->assertSessionHasErrors(['email' => 'Escribe el correo o la cédula: con uno de los dos entra a la plataforma.', 'password']);
        // Con acceso y cédula, sin correo ni contraseña: entra con su cédula y esa es su contraseña inicial
        $this->actingAs($this->admin)->post('/usuarios', $this->datos(['cedula' => '222333', 'acceso' => true]))->assertSessionHasNoErrors();
        $nuevo = User::where('cedula', '222333')->sole();
        $this->assertTrue($nuevo->acceso && $nuevo->debe_cambiar_contrasena && Hash::check('222333', $nuevo->password));
    }

    public function test_sin_acceso_no_ingresa_ni_recibe_una_contrasena(): void
    {
        Notification::fake();
        $sinAcceso = User::factory()->create(['email' => 'cristian@example.com', 'acceso' => false]);

        $this->post('/login', ['email' => 'cristian@example.com', 'password' => 'password'])
            ->assertSessionHasErrors(['email' => 'Tu usuario no tiene acceso a la plataforma. Si lo necesitas, habla con el administrador.']);
        $this->assertGuest();

        $this->post('/forgot-password', ['email' => 'cristian@example.com']);
        Notification::assertNotSentTo($sinAcceso, RestablecerContrasena::class);
    }

    public function test_quitar_el_acceso_cierra_su_sesion_y_borra_su_contrasena(): void
    {
        $persona = User::factory()->create(['cedula' => '1144203579', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza']);

        $this->actingAs($this->admin)->put("/usuarios/{$persona->id}", $this->datos([
            'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'segundo_apellido' => '', 'cedula' => '1144203579', 'email' => $persona->email,
        ]))->assertSessionHasNoErrors();

        $persona->refresh();
        $this->assertFalse($persona->acceso);
        $this->assertNull($persona->password);

        // Con la sesión abierta, su siguiente clic lo saca
        $this->actingAs($persona)->get('/panel')->assertRedirect('/login')
            ->assertSessionHas('status', 'Tu usuario ya no tiene acceso a la plataforma. Si crees que es un error, habla con el administrador.');

        // Al devolvérselo sin escribir una contraseña, vuelve a la inicial: su cédula
        $this->actingAs($this->admin)->put("/usuarios/{$persona->id}", $this->datos([
            'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'cedula' => '1144203579', 'email' => $persona->email, 'acceso' => true,
        ]))->assertSessionHasNoErrors();
        $persona->refresh();
        $this->assertTrue($persona->acceso && $persona->debe_cambiar_contrasena && Hash::check('1144203579', $persona->password));
    }

    public function test_nadie_se_quita_su_propio_acceso(): void
    {
        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", $this->datos([
            'nombres' => 'Natalia', 'primer_apellido' => 'Restrepo', 'cedula' => '5555555', 'email' => $this->admin->email,
            'rol_id' => $this->admin->rol_id,
        ]))->assertSessionHasErrors(['acceso' => 'No puedes quitarte tu propio acceso: pídeselo a otra persona.']);

        $this->assertTrue($this->admin->fresh()->acceso);
    }

    public function test_drivin_reconoce_al_auxiliar_por_su_cedula_y_sus_entregas_quedan_a_su_nombre_al_registrarlo(): void
    {
        $tugo = $this->sede('TuGo', ['codigo' => 'TUGO']);
        $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        $juan = User::factory()->sinAcceso()->create(['cedula' => '1144203579', 'nombres' => 'Juan Fernando', 'primer_apellido' => 'Plaza', 'linea_servicio_id' => null]);
        $coordinador = User::factory()->coordinador()->create();

        // Como la exportación real: "Entregado por" lleva la cédula; el esquema es la sucursal; una fila por producto
        $encabezados = ['Nombre Plan', 'Fecha Plan', 'Código del Vehículo', 'Descripción del Vehículo', 'Código de Orden', 'Nombre Cliente',
            'Unidades', 'Descripción Ítem', 'Unidades Ítem', 'Unidades Entregadas Ítem', 'Estado de la Órden', 'Motivo', 'Asistente conductor',
            'Tiene imágenes', 'Entregado por', 'Nombre del Esquema'];
        $fila = fn (string $np, string $estado, array $extra = []) => [
            'Nombre Plan' => 'CALI SUR CROSS 2-10-2026', 'Fecha Plan' => '2026-10-02', 'Código del Vehículo' => 'WOL163',
            'Descripción del Vehículo' => 'Turbo Furgón NHR', 'Código de Orden' => $np, 'Nombre Cliente' => 'TUGÓ', 'Unidades' => 0.7,
            'Descripción Ítem' => 'SOFA', 'Unidades Ítem' => 1, 'Unidades Entregadas Ítem' => $estado === 'Aprobada' ? 1 : 0,
            'Estado de la Órden' => $estado, 'Asistente conductor' => 'JUAN FERNANDO PLAZA BENAVIDES', 'Tiene imágenes' => 'Si',
            'Entregado por' => '[Mobile] 1144203579@justoatiempo.com', 'Nombre del Esquema' => 'CALI SUR', ...$extra,
        ];
        $ruta = sys_get_temp_dir().'/'.uniqid('drivin_').'.xlsx';
        app(GeneradorPreliquidacion::class)->escribir($ruta, [
            $fila('PDVT1', 'Aprobada'),
            $fila('PDVT1', 'Aprobada', ['Descripción Ítem' => 'MESA', 'Unidades Ítem' => 2, 'Unidades Entregadas Ítem' => 2]),
            $fila('PDVT2', 'Aprobada', ['Tiene imágenes' => 'No']),
            // Otro auxiliar que aún no está en Usuarios
            $fila('PDVT3', 'Rechazada', ['Motivo' => 'Cliente reprograma', 'Asistente conductor' => 'CRISTIAN APONZA MINA', 'Entregado por' => '[Mobile] 1061428366@justoatiempo.com']),
        ], $encabezados);

        $this->actingAs($coordinador)->post('/cargas', ['archivo' => new UploadedFile($ruta, 'Preliquidacion.xlsx', null, null, true)])->assertRedirect();
        $carga = Carga::latest('id')->firstOrFail();
        $this->post("/cargas/{$carga->id}/confirmar")->assertRedirect();

        $pdvt1 = Orden::firstWhere('codigo_orden', 'PDVT1');
        $this->assertSame($juan->id, $pdvt1->auxiliar_id);
        $this->assertSame([2, 2, 3, true], [$pdvt1->productos, $pdvt1->productos_entregados, $pdvt1->unidades, $pdvt1->tiene_imagenes]);
        $this->assertFalse(Orden::firstWhere('codigo_orden', 'PDVT2')->tiene_imagenes);
        $this->assertNotNull($pdvt1->sucursal_id, 'El esquema "CALI SUR" es la sucursal');
        // El vehículo nuevo queda en Flota con la descripción de Drivin
        $this->assertSame('Turbo Furgón NHR', Vehiculo::firstWhere('placa', 'WOL163')?->descripcion);

        // Cristian aún no estaba: su entrega queda con su cédula y pasa a su nombre al registrarlo
        $pdvt3 = Orden::firstWhere('codigo_orden', 'PDVT3');
        $this->assertNull($pdvt3->auxiliar_id);
        $this->assertSame('1061428366', $pdvt3->auxiliar_cedula);

        $this->actingAs($this->admin)->post('/usuarios', $this->datos())->assertSessionHasNoErrors();
        $cristian = User::where('cedula', '1061428366')->sole();
        $this->assertSame($cristian->id, $pdvt3->fresh()->auxiliar_id);
        $this->assertTrue(InformeDiario::firstOrFail()->lineas()->where('auxiliar_id', $cristian->id)->exists());
    }

    private function excelPersonal(array $filas): UploadedFile
    {
        $libro = new Spreadsheet;
        $hoja = $libro->getActiveSheet();
        // Como "AUXILIARES ACTIVOS.xlsx": fila 1 vacía, encabezados en la fila 2 desde la columna B
        $hoja->fromArray([null, 'CEDULA', 'PRIMER NOMBRE', 'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'CARGO', 'OPERACIÓN ', 'CIUDAD ', 'TELEFONO', 'CORREO', 'FECHA NACIMIENTO', 'FECHA DE INGRESO'], null, 'A2');
        $hoja->fromArray($filas, null, 'A3', true);
        $ruta = sys_get_temp_dir().'/'.uniqid('personal_').'.xlsx';
        (new Xlsx($libro))->save($ruta);

        return new UploadedFile($ruta, 'AUXILIARES ACTIVOS.xlsx', null, null, true);
    }

    public function test_importa_el_excel_del_personal(): void
    {
        $ditranza = Empresa::create(['nombre' => 'Ditranza']);
        $ditranza->lineas()->attach(LineaServicio::logistica());
        // Ya estaba registrada (sin teléfono): solo se le completa lo que falta
        $juan = User::factory()->sinAcceso()->create(['cedula' => '1144203579', 'nombres' => 'Juan', 'primer_apellido' => 'Plaza', 'telefono' => null, 'cargo' => 'Auxiliar', 'linea_servicio_id' => null]);

        $archivo = $this->excelPersonal([
            [1, 1144203579, 'JUAN ', 'FERNANDO', 'PLAZA', 'BENAVIDES', 'AUXILIAR LOGISTICO', 'DITRANSA', 'CALI', 3022501982, 'plaza@gmail.com', '1997-09-23', '2026-01-15'],
            [2, 1061428366, 'CRISTIAN', 'ALEJANDRO', 'APONZA', 'MINA', 'AUXILIAR LOGISTICO', 'DITRANSA', 'CALI', 3177666236, 'NO TIENE', '2004-04-15', '2026-03-10'],
            [3, 1111750549, 'WISTHON ', '-', 'MONDRAGON', 'MOSQUERA', 'AUXILIAR LOGISTICO', 'DITRANSA', 'CALI', 3216330781, 'wiston@gmail.com', '2026-05-15', '2026-02-24'],
            [4, null, 'SIN', '', 'CEDULA', '', 'AUXILIAR LOGISTICO', 'DITRANSA', 'CALI', null, null, null, null],
        ]);

        $this->actingAs($this->admin)->post('/usuarios/importar', ['archivo' => $archivo])->assertRedirect('/usuarios/importar');
        $this->get('/usuarios/importar')->assertInertia(fn (Assert $p) => $p->component('usuarios/importar')
            ->where('revision.resumen.nueva', 2)
            ->where('revision.resumen.completa', 1)
            ->where('revision.resumen.error', 1)
            // "DITRANSA" es Ditranza (un nombre casi igual)
            ->where('revision.operaciones.0.empresaId', $ditranza->id)
            ->where('revision.filas.2.avisos.0', 'La fecha de nacimiento no es válida (menos de 14 años): se omite.'));
        $this->assertFalse(User::where('cedula', '1061428366')->exists(), 'La revisión no registra a nadie');

        $token = pathinfo(Storage::files('importaciones')[0], PATHINFO_FILENAME);
        $this->post('/usuarios/importar/confirmar', ['token' => $token, 'rol_id' => $this->rolBase(Rol::Auxiliar)])->assertRedirect('/usuarios');

        // Entran con su cédula, y su contraseña inicial es su cédula
        $cristian = User::where('cedula', '1061428366')->sole();
        $this->assertSame(['Cristian Alejandro', 'Aponza', 'Mina', 'Auxiliar logístico', true, true, null], [$cristian->nombres, $cristian->primer_apellido, $cristian->segundo_apellido, $cristian->cargo, $cristian->acceso, $cristian->debe_cambiar_contrasena, $cristian->email]);
        $this->assertTrue(Hash::check('1061428366', $cristian->password));
        // Asignada a Ditranza, con sus líneas, desde su ingreso
        $asignacion = $cristian->asignaciones()->with('lineas')->sole();
        $this->assertSame([$ditranza->id, '2026-03-10', [LineaServicio::logistica()->id]], [$asignacion->empresa_id, $asignacion->fecha_inicio->toDateString(), $asignacion->lineas->pluck('id')->all()]);
        $this->assertNull(User::where('cedula', '1111750549')->value('fecha_nacimiento'));

        // A Juan solo se le completa lo que faltaba (su segundo apellido, su teléfono, su correo): sus nombres y su cargo se conservan
        $juan->refresh();
        $this->assertSame(['Juan Plaza Benavides', 'Auxiliar', '3022501982', 'plaza@gmail.com', 'Benavides'], [$juan->name, $juan->cargo, $juan->telefono, $juan->email, $juan->segundo_apellido]);
        $this->assertFalse($juan->acceso);
    }

    public function test_importar_pide_permiso_para_crear_y_no_da_roles_de_mas(): void
    {
        $coordinador = User::factory()->coordinador()->create();
        $this->actingAs($coordinador)->get('/usuarios/importar')->assertForbidden();

        $rol = RolUsuario::create(['nombre' => 'Talento humano', 'permisos' => ['usuarios.ver', 'usuarios.crear'], 'alcance' => 'todo', 'activo' => true]);
        $talento = User::factory()->create(['rol_id' => $rol->id]);
        $this->actingAs($talento)->post('/usuarios/importar', ['archivo' => $this->excelPersonal([
            [1, 1061428366, 'CRISTIAN', '', 'APONZA', '', 'AUXILIAR', '', 'CALI', null, null, null, null],
        ])]);
        $this->post('/usuarios/importar/confirmar', ['token' => pathinfo(Storage::files('importaciones')[0], PATHINFO_FILENAME), 'rol_id' => RolUsuario::administrador()->id])
            ->assertSessionHasErrors(['rol_id' => 'Este rol tiene permisos que el tuyo no tiene: no puedes darlo.']);
        $this->assertFalse(User::where('cedula', '1061428366')->exists());
    }

    public function test_la_importacion_omite_correos_repetidos_o_tomados_y_entiende_otras_columnas(): void
    {
        // Un usuario con acceso y sin cédula ya tiene este correo (en mayúsculas en el archivo)
        User::factory()->create(['email' => 'supervisor@example.com', 'cedula' => null]);

        $libro = new Spreadsheet;
        $libro->getActiveSheet()->fromArray([
            ['NÚMERO DE CÉDULA', 'NOMBRE COMPLETO', 'CARGO', 'TELÉFONO CELULAR', 'CORREO', 'FECHA DE NACIMIENTO'],
            ['1.061.428.366', 'CRISTIAN ALEJANDRO APONZA MINA', 'AUXILIAR', '317 766 6236 / 300 111 2233', 'SUPERVISOR@example.com', '5/03/1990'],
            ['1144203579', 'JUAN PLAZA', 'AUXILIAR', 'sin dato', 'compartido@example.com', '31/02/1990'],
            ['1111750549', 'WISTHON MONDRAGON', 'AUXILIAR', null, 'compartido@example.com', null],
        ], null, 'A1', true);
        $ruta = sys_get_temp_dir().'/'.uniqid('personal_').'.xlsx';
        (new Xlsx($libro))->save($ruta);

        $this->actingAs($this->admin)->post('/usuarios/importar', ['archivo' => new UploadedFile($ruta, 'personal.xlsx', null, null, true)]);
        $this->get('/usuarios/importar')->assertInertia(fn (Assert $p) => $p
            ->where('revision.resumen.nueva', 3)
            // Nombre completo en una columna: las dos últimas palabras son los apellidos
            ->where('revision.filas.0.nombres', 'Cristian Alejandro')
            ->where('revision.filas.0.primer_apellido', 'Aponza')
            ->where('revision.filas.0.segundo_apellido', 'Mina')
            ->where('revision.filas.0.telefono', '3177666236')
            ->where('revision.filas.0.fecha_nacimiento', '1990-03-05')
            ->where('revision.filas.0.email', null)
            ->where('revision.filas.0.avisos.0', 'El correo supervisor@example.com ya es de otra persona: se omite.')
            ->where('revision.filas.1.avisos.0', 'No se entiende la fecha de nacimiento «31/02/1990»: se omite.')
            // El mismo correo en dos filas: la segunda no lo toma
            ->where('revision.filas.2.email', null));

        $token = pathinfo(Storage::files('importaciones')[0], PATHINFO_FILENAME);
        $this->post('/usuarios/importar/confirmar', ['token' => $token, 'rol_id' => $this->rolBase(Rol::Auxiliar)])->assertSessionHasNoErrors();
        $this->assertSame(3, User::whereIn('cedula', ['1061428366', '1144203579', '1111750549'])->count());
    }

    public function test_la_importacion_no_muestra_ni_toca_a_quien_no_se_puede_editar_y_confirma_el_archivo_revisado(): void
    {
        $empresaA = $this->empresa('Empresa A');
        $rol = RolUsuario::create(['nombre' => 'Talento humano', 'permisos' => ['usuarios.ver', 'usuarios.crear'], 'alcance' => 'asignacion', 'activo' => true]);
        $talento = User::factory()->create(['rol_id' => $rol->id, 'empresa_id' => $empresaA->id]);
        // Alguien fuera de su alcance (un administrador)
        User::factory()->admin()->create(['cedula' => '99887766', 'nombres' => 'Gerente', 'primer_apellido' => 'General']);

        $this->actingAs($talento)->post('/usuarios/importar', ['archivo' => $this->excelPersonal([
            [1, 99887766, 'GERENTE', '', 'GENERAL', '', 'GERENTE', '', 'CALI', 3001112233, null, null, null],
        ])]);
        $this->get('/usuarios/importar')->assertInertia(fn (Assert $p) => $p
            ->where('revision.filas.0.accion', 'error')
            ->where('revision.filas.0.nombre', 'Persona ya registrada')
            ->where('revision.filas.0.errores.0', 'Esta cédula ya está registrada en una persona que no puedes editar.'));

        // Otro archivo subido en otra pestaña: la confirmación del primero no lo importa
        $this->post('/usuarios/importar/confirmar', ['token' => 'otro-archivo', 'rol_id' => $this->rolBase(Rol::Auxiliar)])
            ->assertSessionHas('error', 'El archivo cambió (se subió otro en otra pestaña): revísalo de nuevo antes de importar.');
    }

    public function test_drivin_no_asigna_por_nombre_a_otra_persona_si_la_cedula_no_esta_registrada(): void
    {
        $tugo = $this->sede('TuGo', ['codigo' => 'TUGO']);
        $tugo->sucursales()->create(['nombre' => 'Cali Sur', 'ciudad' => 'Cali']);
        // Otra persona cuyo nombre está dentro del del archivo
        User::factory()->sinAcceso()->create(['cedula' => '94000111', 'nombres' => 'Fernando', 'primer_apellido' => 'Plaza', 'linea_servicio_id' => null]);
        $coordinador = User::factory()->coordinador()->create();

        $ruta = sys_get_temp_dir().'/'.uniqid('drivin_').'.xlsx';
        app(GeneradorPreliquidacion::class)->escribir($ruta, [[
            'Nombre Plan' => 'CALI SUR 2-10-2026', 'Fecha Plan' => '2026-10-02', 'Código del Vehículo' => 'SNX708', 'Código de Orden' => 'PDVT1',
            'Nombre Cliente' => 'TUGÓ', 'Estado de la Órden' => 'Aprobada', 'Asistente conductor' => 'JUAN FERNANDO PLAZA BENAVIDES',
            'Entregado por' => '[Mobile] 1144203579@justoatiempo.com', 'Nombre del Esquema' => 'CALI SUR',
        ]], ['Nombre Plan', 'Fecha Plan', 'Código del Vehículo', 'Código de Orden', 'Nombre Cliente', 'Estado de la Órden', 'Asistente conductor', 'Entregado por', 'Nombre del Esquema']);
        $this->actingAs($coordinador)->post('/cargas', ['archivo' => new UploadedFile($ruta, 'p.xlsx', null, null, true)]);
        $this->post('/cargas/'.Carga::latest('id')->value('id').'/confirmar');

        $orden = Orden::firstWhere('codigo_orden', 'PDVT1');
        $this->assertNull($orden->auxiliar_id);
        $this->assertSame('1144203579', $orden->auxiliar_cedula);

        // Al corregir una cédula mal escrita, sus entregas dejan de ser suyas
        $equivocado = User::factory()->sinAcceso()->create(['cedula' => '1144203579', 'nombres' => 'Otro', 'primer_apellido' => 'Señor', 'linea_servicio_id' => null]);
        $this->assertSame($equivocado->id, $orden->fresh()->auxiliar_id);
        $equivocado->update(['cedula' => '1144203500']);
        $this->assertNull($orden->fresh()->auxiliar_id);
        $this->assertNull(InformeDiario::firstOrFail()->lineas()->sole()->auxiliar_id);
    }

    public function test_los_avisos_de_cotizacion_no_van_a_quien_no_tiene_acceso_ni_correo(): void
    {
        config(['mail.contacto' => '']);
        User::factory()->admin()->sinAcceso()->create();
        User::factory()->admin()->create(['email' => 'sin-acceso@example.com', 'acceso' => false]);

        $this->assertSame([$this->admin->email], SolicitudContacto::destinatarios());
    }

    public function test_siempre_queda_un_administrador_que_puede_entrar(): void
    {
        // El otro administrador no tiene acceso: este no puede cambiarse a un rol sin todos los permisos
        User::factory()->admin()->sinAcceso()->create(['cedula' => '777777']);
        $rolGeneral = RolUsuario::create(['nombre' => 'General', 'permisos' => ['usuarios.ver', 'usuarios.editar', 'roles.ver', 'roles.editar'], 'alcance' => 'todo', 'activo' => true]);

        $this->actingAs($this->admin)->put("/usuarios/{$this->admin->id}", $this->datos([
            'nombres' => 'Natalia', 'primer_apellido' => 'Restrepo', 'cedula' => '5555555', 'email' => $this->admin->email, 'acceso' => true, 'rol_id' => $rolGeneral->id,
        ]))->assertSessionHasErrors(['rol_id']);
        $this->assertSame(RolUsuario::administrador()->id, $this->admin->fresh()->rol_id);
    }
}
