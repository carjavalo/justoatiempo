<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=plus-jakarta-sans:400,500,600,700,800" rel="stylesheet" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        <meta name="theme-color" content="#12244a">

        {{-- Tema antes del primer pintado: evita el destello blanco a quien usa modo oscuro --}}
        <script>
            try {
                var a = localStorage.getItem('appearance') || 'system';
                if (a === 'dark' || (a === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                }
            } catch (e) {}
        </script>
        <style>html { background: #f5f7fb; } html.dark { background: #0a1020; }</style>

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        {{-- Anuncia el título de cada página nueva (la navegación es sin recarga) --}}
        <div id="anunciador-ruta" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    </body>
</html>
