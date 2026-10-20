<?php

use App\Http\Controllers\Admin\EmpresaController;
use App\Http\Controllers\Admin\SedeController;
use App\Http\Controllers\Admin\SolicitudController;
use App\Http\Controllers\Admin\SucursalController;
use App\Http\Controllers\Admin\UsuarioController;
use App\Http\Controllers\AuditoriaController;
use App\Http\Controllers\CargaController;
use App\Http\Controllers\CarnetController;
use App\Http\Controllers\ContactoController;
use App\Http\Controllers\LineaController;
use App\Http\Controllers\MiCarnetController;
use App\Http\Controllers\PanelController;
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
    // Inicio después de ingresar: opciones de administración
    Route::get('panel', PanelController::class)->name('panel');

    // Cada persona ve y descarga su propio carnet
    Route::get('mi-carnet', [MiCarnetController::class, 'show'])->name('mi-carnet');
    Route::get('mi-carnet/foto', [MiCarnetController::class, 'foto'])->name('mi-carnet.foto');
    Route::get('mi-carnet/arl', [MiCarnetController::class, 'arl'])->name('mi-carnet.arl');
    Route::redirect('dashboard', 'panel'); // enlaces guardados de la versión anterior

    Route::middleware('rol:admin')->group(function () {
        Route::get('usuarios', [UsuarioController::class, 'index'])->name('usuarios.index');
        Route::post('usuarios', [UsuarioController::class, 'store'])->name('usuarios.store');
        Route::put('usuarios/{usuario}', [UsuarioController::class, 'update'])->name('usuarios.update');
        Route::get('usuarios/{usuario}/foto', [UsuarioController::class, 'foto'])->name('usuarios.foto');
        Route::get('usuarios/{usuario}/arl', [UsuarioController::class, 'arl'])->name('usuarios.arl');
        Route::get('usuarios/{usuario}/carnet', [UsuarioController::class, 'carnet'])->name('usuarios.carnet');
        Route::patch('usuarios/{usuario}/estado', [UsuarioController::class, 'estado'])->name('usuarios.estado');

        Route::get('empresas', [EmpresaController::class, 'index'])->name('empresas.index');
        Route::post('empresas', [EmpresaController::class, 'store'])->name('empresas.store');
        Route::put('empresas/{empresa}', [EmpresaController::class, 'update'])->name('empresas.update');
        Route::patch('empresas/{empresa}/estado', [EmpresaController::class, 'estado'])->name('empresas.estado');

        Route::get('sedes', [SedeController::class, 'index'])->name('sedes.index');
        Route::post('sedes', [SedeController::class, 'store'])->name('sedes.store');
        Route::put('sedes/{sede}', [SedeController::class, 'update'])->name('sedes.update');
        Route::patch('sedes/{sede}/estado', [SedeController::class, 'estado'])->name('sedes.estado');

        Route::get('sucursales', [SucursalController::class, 'index'])->name('sucursales.index');
        Route::post('sucursales', [SucursalController::class, 'store'])->name('sucursales.store');
        Route::put('sucursales/{sucursal}', [SucursalController::class, 'update'])->name('sucursales.update');
        Route::patch('sucursales/{sucursal}/estado', [SucursalController::class, 'estado'])->name('sucursales.estado');

        // Solicitudes de cotización del sitio web
        Route::get('solicitudes', [SolicitudController::class, 'index'])->name('solicitudes.index');
        Route::patch('solicitudes/{solicitud}/atencion', [SolicitudController::class, 'atencion'])->name('solicitudes.atencion');
    });

    // Cada línea de servicio: su tablero (logística) o su resumen de empresas y personal
    Route::get('lineas/{linea}', [LineaController::class, 'show'])->name('lineas.show');
    // Enlaces guardados del tablero anterior
    Route::get('indicadores', fn () => redirect()->route('lineas.show', LineaServicio::logistica()));

    /*
     * Módulos en construcción: cada ruta ya existe con su control de acceso
     * y muestra una vista "próximamente" hasta que se implemente.
     */
    $modulo = fn (string $clave, string $titulo, string $descripcion, array $requisitos) => fn () => Inertia::render('modulo-pendiente', [
        'clave' => $clave,
        'titulo' => $titulo,
        'descripcion' => $descripcion,
        'requisitos' => $requisitos,
    ]);

    Route::get('mis-entregas', $modulo('mis-entregas', 'Mis entregas', 'Historial de tus entregas, tu efectividad diaria y las evidencias cargadas.', ['RBAC']))
        ->middleware('rol:auxiliar')->name('mis-entregas');

    // Herramientas de la línea de servicios logísticos (Drivin, auditoría POD): solo su personal propio
    Route::middleware(['rol:admin,coordinador', 'personal', 'linea:logistica'])->group(function () use ($modulo) {
        Route::get('informes', $modulo('informes', 'Informe diario', 'Cuadro consolidado por fecha, sede, sucursal, ruta, placa y auxiliar, con efectividad, devoluciones, averías y faltantes.', ['RF-05', 'RF-06', 'RF-07', 'RF-08']))->name('informes.index');
        // Módulo 2: preliquidación de Drivin (subir → revisar → confirmar)
        Route::get('cargas', [CargaController::class, 'index'])->name('cargas.index');
        Route::post('cargas', [CargaController::class, 'store'])->name('cargas.store');
        Route::get('cargas/{carga}', [CargaController::class, 'show'])->name('cargas.show');
        Route::patch('cargas/{carga}', [CargaController::class, 'update'])->name('cargas.update');
        Route::post('cargas/{carga}/confirmar', [CargaController::class, 'confirmar'])->name('cargas.confirmar');
        Route::post('cargas/{carga}/anular', [CargaController::class, 'anular'])->name('cargas.anular');
        Route::delete('cargas/{carga}', [CargaController::class, 'destroy'])->name('cargas.destroy');

        // Módulo 4: auditoría del protocolo de evidencias (RF-09, RF-10)
        Route::get('auditoria', [AuditoriaController::class, 'index'])->name('auditoria.index');
        Route::post('auditoria/lote', [AuditoriaController::class, 'subirLote'])->name('auditoria.lote');
        Route::get('auditoria/{orden}', [AuditoriaController::class, 'show'])->whereNumber('orden')->name('auditoria.show');
        Route::post('auditoria/{orden}', [AuditoriaController::class, 'guardar'])->whereNumber('orden')->name('auditoria.guardar');
        Route::post('auditoria/{orden}/evidencias', [AuditoriaController::class, 'subirEvidencias'])->whereNumber('orden')->name('auditoria.evidencias');
        Route::get('evidencias/{evidencia}', [AuditoriaController::class, 'ver'])->name('evidencias.ver');
        Route::patch('evidencias/{evidencia}', [AuditoriaController::class, 'clasificar'])->name('evidencias.clasificar');
        Route::delete('evidencias/{evidencia}', [AuditoriaController::class, 'eliminarEvidencia'])->name('evidencias.eliminar');

        Route::get('seguimiento', $modulo('seguimiento', 'Seguimiento y desempeño', 'Felicitaciones, retroalimentación y llamados de atención por auxiliar, y control de informes en seguimiento.', ['RF-11']))->name('seguimiento.index');
        Route::get('programacion', $modulo('programacion', 'Programación diaria', 'Auxiliares y vehículos requeridos por sede, sucursal y fecha.', ['RF-02']))->name('programacion.index');
    });

    Route::middleware(['rol:admin', 'personal'])->group(function () use ($modulo) {
        Route::get('empleados', $modulo('empleados', 'Empleados', 'Auxiliares y conductores, registrados por cédula, con estado e historial de desempeño.', ['RF-01']))->name('empleados.index');
        Route::get('vehiculos', $modulo('vehiculos', 'Flota', 'Vehículos de la operación urbana por placa y código interno.', ['Datos maestros']))->name('vehiculos.index');
        Route::get('parametros', $modulo('parametros', 'Parámetros', 'Metas de efectividad, umbrales de acciones y reglas globales.', ['Configuración']))->name('parametros.index');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

// Direcciones que no existen: pasan por el grupo web para que la página de error sepa si hay sesión
// (y ofrezca volver al inicio de quien navega en vez de al sitio público)
Route::fallback(fn () => abort(404));
