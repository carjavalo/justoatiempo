<?php

use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

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

    Route::middleware('rol:admin,coordinador')->group(function () use ($modulo) {
        Route::get('informes', $modulo('informes', 'Informe diario', 'Cuadro consolidado por fecha, cliente, sede, ruta, placa y auxiliar, con efectividad, devoluciones, averías y faltantes.', ['RF-05', 'RF-06', 'RF-07', 'RF-08']))->name('informes.index');
        Route::get('cargas', $modulo('cargas', 'Cargas Drivin', 'Sube la preliquidación (.xlsx / .csv) exportada de Drivin; el sistema valida columnas y consolida en segundos.', ['RF-03', 'RF-04']))->name('cargas.index');
        Route::get('auditoria', $modulo('auditoria', 'Auditoría POD', 'Checklist del protocolo de entrega por orden: fachada, producto sellado, destapado (o nota firmada) y remesa.', ['RF-09', 'RF-10']))->name('auditoria.index');
        Route::get('seguimiento', $modulo('seguimiento', 'Seguimiento y desempeño', 'Felicitaciones, retroalimentación y llamados de atención por auxiliar, y control de informes en seguimiento.', ['RF-11']))->name('seguimiento.index');
        Route::get('programacion', $modulo('programacion', 'Programación diaria', 'Auxiliares y vehículos requeridos por cliente, sede y fecha.', ['RF-02']))->name('programacion.index');
    });

    Route::middleware('rol:admin')->group(function () use ($modulo) {
        Route::get('empleados', $modulo('empleados', 'Empleados', 'Auxiliares y conductores, registrados por cédula, con estado e historial de desempeño.', ['RF-01']))->name('empleados.index');
        Route::get('clientes', $modulo('clientes', 'Clientes y sedes', 'Clientes corporativos, sus sedes y la meta de efectividad de cada uno.', ['Datos maestros']))->name('clientes.index');
        Route::get('vehiculos', $modulo('vehiculos', 'Flota', 'Vehículos de la operación urbana por placa y código interno.', ['Datos maestros']))->name('vehiculos.index');
        Route::get('usuarios', $modulo('usuarios', 'Usuarios y roles', 'Acceso a la plataforma: administradores, coordinadores y auxiliares.', ['RBAC']))->name('usuarios.index');
        Route::get('parametros', $modulo('parametros', 'Parámetros', 'Metas de efectividad, umbrales de acciones y reglas globales.', ['Configuración']))->name('parametros.index');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
