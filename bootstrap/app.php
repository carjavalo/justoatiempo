<?php

use App\Http\Middleware\EnsureRol;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'rol' => EnsureRol::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Sesión vencida (419): volver a la página con un aviso claro en vez de la pantalla "Page Expired"
        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response) {
            if ($response->getStatusCode() === 419) {
                $mensaje = 'Tu sesión expiró por inactividad. Vuelve a intentarlo.';

                return back()->with(['status' => $mensaje, 'error' => $mensaje]);
            }

            return $response;
        });
    })->create();
