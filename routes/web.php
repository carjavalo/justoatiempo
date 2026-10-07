<?php

use App\Http\Controllers\Admin\EmpresaController;
use App\Http\Controllers\Admin\SedeController;
use App\Http\Controllers\Admin\UsuarioController;
use App\Http\Controllers\AuditoriaController;
use App\Http\Controllers\CargaController;
use App\Http\Controllers\ContactoController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PanelController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Página principal: presentación de la empresa (portafolio de servicios)
Route::get('/', function () {
    return Inertia::render('welcome', ['servicios' => ContactoController::SERVICIOS]);
})->name('home');
Route::post('contacto', [ContactoController::class, 'store'])->middleware('throttle:5,1')->name('contacto.store');

Route::middleware(['auth'])->group(function () {
    // Inicio después de ingresar: opciones de administración
    Route::get('panel', PanelController::class)->name('panel');
    Route::redirect('dashboard', 'panel'); // enlaces guardados de la versión anterior

    Route::middleware('rol:admin')->group(function () {
        Route::get('usuarios', [UsuarioController::class, 'index'])->name('usuarios.index');
        Route::post('usuarios', [UsuarioController::class, 'store'])->name('usuarios.store');
        Route::put('usuarios/{usuario}', [UsuarioController::class, 'update'])->name('usuarios.update');
        Route::patch('usuarios/{usuario}/estado', [UsuarioController::class, 'estado'])->name('usuarios.estado');

        Route::get('empresas', [EmpresaController::class, 'index'])->name('empresas.index');
        Route::post('empresas', [EmpresaController::class, 'store'])->name('empresas.store');
        Route::put('empresas/{empresa}', [EmpresaController::class, 'update'])->name('empresas.update');
        Route::patch('empresas/{empresa}/estado', [EmpresaController::class, 'estado'])->name('empresas.estado');

        Route::get('sedes', [SedeController::class, 'index'])->name('sedes.index');
        Route::post('sedes', [SedeController::class, 'store'])->name('sedes.store');
        Route::put('sedes/{sede}', [SedeController::class, 'update'])->name('sedes.update');
        Route::patch('sedes/{sede}/estado', [SedeController::class, 'estado'])->name('sedes.estado');
    });

    /*
     * Módulos de la operación logística (Drivin, auditoría POD, indicadores). Por ahora no aparecen
     * en el panel: se conservan para moverlos a la categoría "Servicios logísticos".
     */
    Route::get('indicadores', DashboardController::class)->middleware('personal')->name('indicadores');

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

    Route::middleware(['rol:admin,coordinador', 'personal'])->group(function () use ($modulo) {
        Route::get('informes', $modulo('informes', 'Informe diario', 'Cuadro consolidado por fecha, cliente, sede, ruta, placa y auxiliar, con efectividad, devoluciones, averías y faltantes.', ['RF-05', 'RF-06', 'RF-07', 'RF-08']))->name('informes.index');
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
        Route::get('programacion', $modulo('programacion', 'Programación diaria', 'Auxiliares y vehículos requeridos por cliente, sede y fecha.', ['RF-02']))->name('programacion.index');
    });

    Route::middleware(['rol:admin', 'personal'])->group(function () use ($modulo) {
        Route::get('empleados', $modulo('empleados', 'Empleados', 'Auxiliares y conductores, registrados por cédula, con estado e historial de desempeño.', ['RF-01']))->name('empleados.index');
        Route::get('vehiculos', $modulo('vehiculos', 'Flota', 'Vehículos de la operación urbana por placa y código interno.', ['Datos maestros']))->name('vehiculos.index');
        Route::get('parametros', $modulo('parametros', 'Parámetros', 'Metas de efectividad, umbrales de acciones y reglas globales.', ['Configuración']))->name('parametros.index');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
