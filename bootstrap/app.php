<?php

use App\Http\Middleware\CerrarSesionInactiva;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\TienePermiso;
use App\Http\Middleware\VistaPreviaPublica;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // El túnel de Cloudflare llega por esta misma máquina: se confía en sus encabezados (HTTPS y dominio
        // públicos) para que los enlaces y recursos de la página salgan con la dirección correcta
        $middleware->trustProxies(at: ['127.0.0.1', '::1']);

        // Por el enlace temporal, la plataforma ni se insinúa: 404 antes de que el ingreso redirija a /login
        $middleware->prependToPriorityList(AuthenticatesRequests::class, VistaPreviaPublica::class);

        $middleware->web(append: [
            VistaPreviaPublica::class,
            CerrarSesionInactiva::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Con la sesión iniciada, el inicio de sesión (y recuperar la contraseña) llevan directo a su inicio: el panel
        // o su línea. Es lo que ve quien vuelve con «Atrás» al inicio de sesión (ver resources/js/lib/sesion.ts).
        $middleware->redirectUsersTo(fn (Request $request) => $request->user()?->inicio()['url'] ?? '/panel');

        // Cada sección pide un permiso del rol de la persona (App\Support\Permisos)
        $middleware->alias([
            'permiso' => TienePermiso::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Un solo callback: Laravel guarda únicamente el último que se registra con respond()
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $estado = $response->getStatusCode();

            // Código de seguridad vencido (419): volver a la página con un aviso claro en vez de "Page Expired".
            // 303: si la petición era PUT/PATCH/DELETE, el navegador vuelve con GET.
            if ($estado === 419) {
                // En el ingreso y en el sitio público no había sesión que vencer: la página llevaba tanto tiempo
                // abierta que su código ya no sirve. Lo escrito se conserva; solo falta la contraseña, que se borra.
                if ($request->is('login', 'reset-password')) {
                    return back(303)->withErrors(['password' => 'La página llevaba mucho tiempo abierta: escribe de nuevo la contraseña.']);
                }
                if ($request->is('forgot-password')) {
                    return back(303)->withErrors(['email' => 'La página llevaba mucho tiempo abierta: vuelve a pedir el enlace.']);
                }
                if ($request->is('contacto')) {
                    return back(303)->with('error', 'La página llevaba mucho tiempo abierta: envíe de nuevo el formulario, sus datos siguen ahí.');
                }

                $mensaje = 'Tu sesión expiró por inactividad. Vuelve a intentarlo.';

                return back(303)->with(['status' => $mensaje, 'error' => $mensaje]);
            }

            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return $response;
            }

            $usuario = $request->user();
            // Solo los motivos de los abort() de la app (403 y 409), escritos para quien usa la plataforma;
            // los 404 traen textos internos del framework ("The route … could not be found.")
            $motivo = $e instanceof HttpExceptionInterface && in_array($estado, [403, 409], true) ? trim($e->getMessage()) : '';
            $motivo = $motivo !== '' && $motivo !== 'This action is unauthorized.' ? $motivo : null;

            // Una acción (POST, PUT…) que ya no se puede hacer o que se repitió demasiado vuelve a la pantalla
            // anterior con el aviso: así no queda en la barra una dirección que no se abre con GET (405)
            if (! $request->isMethod('GET') && in_array($estado, [409, 413, 429], true)) {
                return back(303)->with('error', $motivo ?? match (true) {
                    $estado === 409 => 'Esta acción ya no se puede hacer: el registro cambió mientras lo veías.',
                    // El servidor descartó el envío por pesado (límite de PHP del hosting), p. ej. una imagen
                    $estado === 413 => 'Lo que intentaste enviar pesa demasiado para el servidor. Usa un archivo más liviano.',
                    $usuario !== null => 'Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.',
                    default => 'Ha hecho demasiados intentos seguidos. Espere un minuto e intente de nuevo.',
                });
            }

            // Páginas de error propias, con "Volver" (la de Laravel no tiene salida). Los 500 de desarrollo
            // conservan el detalle del error.
            $propias = [403, 404, 405, 409, 429, ...(config('app.debug') ? [] : [500, 503])];
            if (! in_array($estado, $propias, true)) {
                return $response;
            }

            return Inertia::render('error', [
                'estado' => $estado,
                'mensaje' => $motivo,
                // Sin sesión es un visitante del sitio público: se le trata de usted
                'publico' => $usuario === null,
                'volver' => $usuario
                    ? ['texto' => $usuario->inicio()['volver'], 'href' => $usuario->inicio()['url']]
                    : ['texto' => 'Volver al sitio web', 'href' => '/'],
            ])->toResponse($request)->setStatusCode($estado);
        });
    })->create();
