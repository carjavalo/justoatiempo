<?php

use App\Http\Controllers\Admin\AsignacionController;
use App\Http\Controllers\Admin\EmpresaController;
use App\Http\Controllers\Admin\ImportacionPersonalController;
use App\Http\Controllers\Admin\LineaServicioController;
use App\Http\Controllers\Admin\ParametroController;
use App\Http\Controllers\Admin\RolController;
use App\Http\Controllers\Admin\SedeController;
use App\Http\Controllers\Admin\SolicitudController;
use App\Http\Controllers\Admin\SucursalController;
use App\Http\Controllers\Admin\UsuarioController;
use App\Http\Controllers\Admin\VehiculoController;
use App\Http\Controllers\AuditoriaController;
use App\Http\Controllers\CargaController;
use App\Http\Controllers\CarnetController;
use App\Http\Controllers\ContactoController;
use App\Http\Controllers\InformeController;
use App\Http\Controllers\InformeLineaController;
use App\Http\Controllers\LineaController;
use App\Http\Controllers\MiCarnetController;
use App\Http\Controllers\MisEntregasController;
use App\Http\Controllers\NovedadController;
use App\Http\Controllers\PanelController;
use App\Http\Controllers\ProgramacionController;
use App\Http\Controllers\SeguimientoController;
use App\Models\LineaServicio;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Página principal: presentación de la empresa (portafolio de servicios)
Route::get('/', function () {
    return Inertia::render('welcome', ['servicios' => ContactoController::SERVICIOS]);
})->name('home');
Route::post('contacto', [ContactoController::class, 'store'])->middleware('throttle:5,1')->name('contacto.store');
// Lo que se abre al escanear el QR de un carnet: la información de la persona y su certificado de ARL
Route::prefix('carnet/{codigo}')->where(['codigo' => '[A-Za-z0-9]{12}'])->middleware('throttle:60,1')->group(function () {
    Route::get('/', [CarnetController::class, 'verificar'])->name('carnet.verificar');
    Route::get('foto', [CarnetController::class, 'foto'])->name('carnet.foto');
    Route::get('arl', [CarnetController::class, 'arl'])->name('carnet.arl');
});

Route::middleware(['auth'])->group(function () {
    // Inicio después de ingresar: lo que su rol le deja administrar y las líneas que ve
    Route::get('panel', PanelController::class)->name('panel');

    // Cada persona ve y descarga su propio carnet
    Route::get('mi-carnet', [MiCarnetController::class, 'show'])->name('mi-carnet');
    Route::get('mi-carnet/foto', [MiCarnetController::class, 'foto'])->name('mi-carnet.foto');
    Route::get('mi-carnet/arl', [MiCarnetController::class, 'arl'])->name('mi-carnet.arl');
    Route::redirect('dashboard', 'panel'); // enlaces guardados de la versión anterior

    // Administración: cada acción pide su permiso (ver, crear, editar, activar y desactivar)
    Route::get('usuarios', [UsuarioController::class, 'index'])->middleware('permiso:usuarios.ver')->name('usuarios.index');
    // Importar el Excel del personal: se sube, se revisa y se confirma
    Route::middleware('permiso:usuarios.crear')->prefix('usuarios/importar')->name('usuarios.importar')->group(function () {
        Route::get('/', [ImportacionPersonalController::class, 'index'])->name('');
        Route::post('/', [ImportacionPersonalController::class, 'revisar'])->name('.revisar');
        Route::put('empresas', [ImportacionPersonalController::class, 'empresas'])->name('.empresas');
        Route::post('confirmar', [ImportacionPersonalController::class, 'confirmar'])->name('.confirmar');
        Route::delete('/', [ImportacionPersonalController::class, 'descartar'])->name('.descartar');
    });
    Route::post('usuarios', [UsuarioController::class, 'store'])->middleware('permiso:usuarios.crear')->name('usuarios.store');
    Route::put('usuarios/{usuario}', [UsuarioController::class, 'update'])->middleware('permiso:usuarios.editar')->name('usuarios.update');
    Route::patch('usuarios/{usuario}/estado', [UsuarioController::class, 'estado'])->middleware('permiso:usuarios.estado')->name('usuarios.estado');
    Route::middleware('permiso:usuarios.ver')->group(function () {
        Route::get('usuarios/{usuario}/foto', [UsuarioController::class, 'foto'])->name('usuarios.foto');
        Route::get('usuarios/{usuario}/arl', [UsuarioController::class, 'arl'])->name('usuarios.arl');
        Route::get('usuarios/{usuario}/carnet', [UsuarioController::class, 'carnet'])->name('usuarios.carnet');
    });

    // Asignaciones: dónde presta el servicio cada persona, qué líneas hace allí y por cuánto tiempo
    Route::get('asignaciones', [AsignacionController::class, 'index'])->middleware('permiso:asignaciones.ver')->name('asignaciones.index');
    Route::post('asignaciones', [AsignacionController::class, 'store'])->middleware('permiso:asignaciones.crear')->name('asignaciones.store');
    Route::put('asignaciones/{asignacion}', [AsignacionController::class, 'update'])->middleware('permiso:asignaciones.editar')->name('asignaciones.update');
    Route::patch('asignaciones/{asignacion}/terminar', [AsignacionController::class, 'terminar'])->middleware('permiso:asignaciones.terminar')->name('asignaciones.terminar');

    // Roles dentro de la empresa (auxiliar, conductor…), cada uno con sus permisos
    Route::get('roles', [RolController::class, 'index'])->middleware('permiso:roles.ver')->name('roles.index');
    Route::post('roles', [RolController::class, 'store'])->middleware('permiso:roles.crear')->name('roles.store');
    Route::put('roles/{rol}', [RolController::class, 'update'])->middleware('permiso:roles.editar')->name('roles.update');
    Route::patch('roles/{rol}/estado', [RolController::class, 'estado'])->middleware('permiso:roles.estado')->name('roles.estado');

    // Líneas de servicio: las del portafolio y las nuevas (por id: su slug es el de la URL de su tablero)
    Route::get('lineas-de-servicio', [LineaServicioController::class, 'index'])->middleware('permiso:servicios.ver')->name('servicios.index');
    Route::post('lineas-de-servicio', [LineaServicioController::class, 'store'])->middleware('permiso:servicios.crear')->name('servicios.store');
    Route::put('lineas-de-servicio/{servicio:id}', [LineaServicioController::class, 'update'])->middleware('permiso:servicios.editar')->name('servicios.update');
    Route::patch('lineas-de-servicio/{servicio:id}/estado', [LineaServicioController::class, 'estado'])->middleware('permiso:servicios.estado')->name('servicios.estado');

    Route::get('empresas', [EmpresaController::class, 'index'])->middleware('permiso:empresas.ver')->name('empresas.index');
    Route::post('empresas', [EmpresaController::class, 'store'])->middleware('permiso:empresas.crear')->name('empresas.store');
    Route::put('empresas/{empresa}', [EmpresaController::class, 'update'])->middleware('permiso:empresas.editar')->name('empresas.update');
    Route::patch('empresas/{empresa}/estado', [EmpresaController::class, 'estado'])->middleware('permiso:empresas.estado')->name('empresas.estado');

    Route::get('sedes', [SedeController::class, 'index'])->middleware('permiso:sedes.ver')->name('sedes.index');
    Route::post('sedes', [SedeController::class, 'store'])->middleware('permiso:sedes.crear')->name('sedes.store');
    Route::put('sedes/{sede}', [SedeController::class, 'update'])->middleware('permiso:sedes.editar')->name('sedes.update');
    Route::patch('sedes/{sede}/estado', [SedeController::class, 'estado'])->middleware('permiso:sedes.estado')->name('sedes.estado');

    Route::get('sucursales', [SucursalController::class, 'index'])->middleware('permiso:sucursales.ver')->name('sucursales.index');
    Route::post('sucursales', [SucursalController::class, 'store'])->middleware('permiso:sucursales.crear')->name('sucursales.store');
    Route::put('sucursales/{sucursal}', [SucursalController::class, 'update'])->middleware('permiso:sucursales.editar')->name('sucursales.update');
    Route::patch('sucursales/{sucursal}/estado', [SucursalController::class, 'estado'])->middleware('permiso:sucursales.estado')->name('sucursales.estado');

    // Solicitudes de cotización del sitio web
    Route::get('solicitudes', [SolicitudController::class, 'index'])->middleware('permiso:solicitudes.ver')->name('solicitudes.index');
    Route::patch('solicitudes/{solicitud}/atencion', [SolicitudController::class, 'atencion'])->middleware('permiso:solicitudes.atender')->name('solicitudes.atencion');

    // Cada línea de servicio: su tablero (logística) o su resumen de empresas y personal
    Route::get('lineas/{linea}', [LineaController::class, 'show'])->name('lineas.show');
    // Enlaces guardados del tablero anterior
    Route::get('indicadores', fn () => redirect()->route('lineas.show', LineaServicio::logistica()));

    // El historial de entregas de quien hace las rutas
    Route::get('mis-entregas', MisEntregasController::class)->middleware('permiso:entregas.ver')->name('mis-entregas');

    // Herramientas de la línea de servicios logísticos (Drivin, auditoría POD). Su permiso solo le aplica a quien
    // trabaja en la línea (o las ve todas) y no está limitado a una empresa: ver App\Models\User::permisos
    // Informe diario (el Excel de la operación): por jornada, sede y sucursal; se descarga con su mismo formato
    Route::get('informes', [InformeController::class, 'index'])->middleware('permiso:informes.ver')->name('informes.index');
    Route::get('informes/descargar', [InformeController::class, 'descargar'])->middleware('permiso:informes.descargar')->name('informes.descargar');
    Route::patch('informes/filas/{linea}/observacion', [InformeController::class, 'observacion'])->middleware('permiso:informes.editar')->name('informes.observacion');
    Route::patch('informes/{informe}/observaciones', [InformeController::class, 'observaciones'])->middleware('permiso:informes.editar')->name('informes.observaciones');
    Route::patch('informes/{informe}/estado', [InformeController::class, 'estado'])->middleware('permiso:informes.cerrar')->name('informes.estado');

    // Módulo 2: preliquidación de Drivin (subir → revisar → confirmar)
    Route::get('cargas', [CargaController::class, 'index'])->middleware('permiso:cargas.ver')->name('cargas.index');
    Route::post('cargas', [CargaController::class, 'store'])->middleware('permiso:cargas.subir')->name('cargas.store');
    Route::get('cargas/{carga}', [CargaController::class, 'show'])->middleware('permiso:cargas.ver')->name('cargas.show');
    Route::patch('cargas/{carga}', [CargaController::class, 'update'])->middleware('permiso:cargas.subir')->name('cargas.update');
    Route::post('cargas/{carga}/confirmar', [CargaController::class, 'confirmar'])->middleware('permiso:cargas.confirmar')->name('cargas.confirmar');
    Route::post('cargas/{carga}/anular', [CargaController::class, 'anular'])->middleware('permiso:cargas.anular')->name('cargas.anular');
    // Descartar una carga que aún está en revisión es parte de subirla
    Route::delete('cargas/{carga}', [CargaController::class, 'destroy'])->middleware('permiso:cargas.subir')->name('cargas.destroy');

    // Módulo 4: auditoría del protocolo de evidencias (RF-09, RF-10)
    Route::get('auditoria', [AuditoriaController::class, 'index'])->middleware('permiso:auditoria.ver')->name('auditoria.index');
    Route::post('auditoria/lote', [AuditoriaController::class, 'subirLote'])->middleware('permiso:auditoria.subir')->name('auditoria.lote');
    Route::get('auditoria/{orden}', [AuditoriaController::class, 'show'])->whereNumber('orden')->middleware('permiso:auditoria.ver')->name('auditoria.show');
    Route::post('auditoria/{orden}', [AuditoriaController::class, 'guardar'])->whereNumber('orden')->middleware('permiso:auditoria.revisar')->name('auditoria.guardar');
    Route::post('auditoria/{orden}/evidencias', [AuditoriaController::class, 'subirEvidencias'])->whereNumber('orden')->middleware('permiso:auditoria.subir')->name('auditoria.evidencias');
    Route::get('evidencias/{evidencia}', [AuditoriaController::class, 'ver'])->middleware('permiso:auditoria.ver')->name('evidencias.ver');
    Route::patch('evidencias/{evidencia}', [AuditoriaController::class, 'clasificar'])->middleware('permiso:auditoria.revisar')->name('evidencias.clasificar');
    Route::delete('evidencias/{evidencia}', [AuditoriaController::class, 'eliminarEvidencia'])->middleware('permiso:auditoria.eliminar')->name('evidencias.eliminar');

    // Seguimiento y desempeño: cómo le va a cada auxiliar y las acciones que se toman con él
    Route::get('seguimiento', [SeguimientoController::class, 'index'])->middleware('permiso:seguimiento.ver')->name('seguimiento.index');
    Route::post('seguimiento/acciones', [SeguimientoController::class, 'registrar'])->middleware('permiso:seguimiento.registrar')->name('seguimiento.registrar');
    Route::delete('seguimiento/acciones/{accion}', [SeguimientoController::class, 'eliminar'])->middleware('permiso:seguimiento.registrar')->name('seguimiento.eliminar');

    // La operación diaria de cada línea de servicio: programación y asistencia, novedades y seguimiento, e informe
    // diario (el de logística es el de Drivin). Su permiso le aplica en las líneas donde trabaja: ver App\Support\OperacionLinea
    Route::get('lineas/{linea}/programacion', [ProgramacionController::class, 'index'])->middleware('permiso:programacion.ver')->name('programacion.index');
    Route::middleware('permiso:programacion.editar')->group(function () {
        Route::post('lineas/{linea}/programacion', [ProgramacionController::class, 'store'])->name('programacion.store');
        Route::post('lineas/{linea}/programacion/copiar', [ProgramacionController::class, 'copiar'])->name('programacion.copiar');
        Route::put('programacion/{programacion}', [ProgramacionController::class, 'update'])->name('programacion.update');
        Route::delete('programacion/{programacion}', [ProgramacionController::class, 'destroy'])->name('programacion.destroy');
        Route::post('programacion/{programacion}/personas', [ProgramacionController::class, 'agregarPersonas'])->name('programacion.personas.store');
        Route::patch('programacion/personas/{fila}', [ProgramacionController::class, 'actualizarPersona'])->name('programacion.personas.update');
        Route::delete('programacion/personas/{fila}', [ProgramacionController::class, 'quitarPersona'])->name('programacion.personas.destroy');
    });
    Route::middleware('permiso:programacion.asistencia')->group(function () {
        Route::patch('programacion/personas/{fila}/asistencia', [ProgramacionController::class, 'asistencia'])->name('programacion.asistencia');
        Route::post('programacion/{programacion}/asistencia', [ProgramacionController::class, 'asistenciaTodos'])->name('programacion.asistencia.todos');
    });
    Route::get('lineas/{linea}/novedades', [NovedadController::class, 'index'])->middleware('permiso:novedades.ver')->name('novedades.index');
    Route::post('lineas/{linea}/novedades', [NovedadController::class, 'store'])->middleware('permiso:novedades.registrar')->name('novedades.store');
    Route::patch('novedades/{novedad}', [NovedadController::class, 'seguimiento'])->middleware('permiso:novedades.cerrar')->name('novedades.seguimiento');
    Route::get('lineas/{linea}/informe', [InformeLineaController::class, 'index'])->middleware('permiso:informes.ver')->name('lineas.informe');
    Route::get('lineas/{linea}/informe/descargar', [InformeLineaController::class, 'descargar'])->middleware('permiso:informes.descargar')->name('lineas.informe.descargar');

    // Datos maestros. El personal (auxiliares, conductores, operarios) está en Usuarios
    Route::get('vehiculos', [VehiculoController::class, 'index'])->middleware('permiso:vehiculos.ver')->name('vehiculos.index');
    Route::post('vehiculos', [VehiculoController::class, 'store'])->middleware('permiso:vehiculos.crear')->name('vehiculos.store');
    Route::put('vehiculos/{vehiculo}', [VehiculoController::class, 'update'])->middleware('permiso:vehiculos.editar')->name('vehiculos.update');
    Route::patch('vehiculos/{vehiculo}/estado', [VehiculoController::class, 'estado'])->middleware('permiso:vehiculos.estado')->name('vehiculos.estado');

    Route::get('parametros', [ParametroController::class, 'index'])->middleware('permiso:parametros.ver')->name('parametros.index');
    Route::middleware('permiso:parametros.editar')->group(function () {
        Route::put('parametros', [ParametroController::class, 'valores'])->name('parametros.valores');
        Route::post('parametros/motivos', [ParametroController::class, 'guardarMotivo'])->name('parametros.motivos.store');
        Route::put('parametros/motivos/{motivo}', [ParametroController::class, 'guardarMotivo'])->name('parametros.motivos.update');
        Route::patch('parametros/motivos/{motivo}/estado', [ParametroController::class, 'estadoMotivo'])->name('parametros.motivos.estado');
        Route::post('parametros/novedades', [ParametroController::class, 'guardarNovedad'])->name('parametros.novedades.store');
        Route::put('parametros/novedades/{novedad}', [ParametroController::class, 'guardarNovedad'])->name('parametros.novedades.update');
        Route::patch('parametros/novedades/{novedad}/estado', [ParametroController::class, 'estadoNovedad'])->name('parametros.novedades.estado');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

// Direcciones que no existen: pasan por el grupo web para que la página de error sepa si hay sesión
// (y ofrezca volver al inicio de quien navega en vez de al sitio público)
Route::fallback(fn () => abort(404));
