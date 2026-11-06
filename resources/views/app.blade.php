<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <meta name="theme-color" content="#12244a">

        {{-- Tema antes del primer pintado: evita el destello blanco a quien usa modo oscuro --}}
        <script>
            try {
                var a = localStorage.getItem('appearance') || 'system';
                if (a === 'dark' || (a === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                    // La barra del navegador del teléfono, del mismo grafito que la página
                    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#121417');
                }
            } catch (e) {}
        </script>
        <style>
            html { background: #f5f7fb; } html.dark { background: #121417; }
            /* Mientras carga la página: la marca y «Cargando…». Aparece después de medio segundo (con buena conexión ni
               se ve) y se va sola en cuanto la página se pinta dentro de #app */
            .esqueleto { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; font: 600 14px/1.4 system-ui, sans-serif; color: #5b6478; opacity: 0; animation: esqueleto-aparece .3s ease-out .5s forwards; pointer-events: none; }
            html.dark .esqueleto { color: #a3abbb; }
            .esqueleto-logo { display: flex; width: 56px; height: 56px; padding: 5px; box-sizing: border-box; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(16, 24, 40, .08), 0 0 0 1px rgba(0, 0, 0, .05); }
            .esqueleto-logo img { width: 100%; height: 100%; object-fit: contain; }
            #app:not(:empty) + .esqueleto { display: none; }
            @keyframes esqueleto-aparece { to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .esqueleto { animation-duration: 0s; } }
        </style>

        {{-- Sin sesión, solo las rutas del sitio público (config/ziggy.php) --}}
        @auth
            @routes
        @else
            @routes('publico')
        @endauth
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        {{-- Con conexión lenta, algo de la marca en lugar de una pantalla vacía (ver .esqueleto arriba) --}}
        <div class="esqueleto" role="status">
            <span class="esqueleto-logo"><img src="/images/marca/logo-240.webp" alt="" width="240" height="216"></span>
            <span>Cargando…</span>
        </div>
        {{-- Anuncia el título de cada página nueva (la navegación es sin recarga) --}}
        <div id="anunciador-ruta" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    </body>
</html>
