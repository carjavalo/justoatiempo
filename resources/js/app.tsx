import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { initializeTheme } from './hooks/use-appearance';

declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        // ≥3:1 sobre el fondo claro, el oscuro y el azul del menú
        color: '#4a74c9',
    },
});

/*
 * Navegación accesible sin recarga: al cambiar de página (no al filtrar en la misma),
 * se anuncia el título y el foco pasa al contenido principal.
 */
let rutaAnterior = window.location.pathname;
router.on('navigate', (evento) => {
    const ruta = new URL(evento.detail.page.url, window.location.origin).pathname;
    if (ruta === rutaAnterior) return;
    rutaAnterior = ruta;

    window.setTimeout(() => {
        const anunciador = document.getElementById('anunciador-ruta');
        if (anunciador) anunciador.textContent = document.title;

        const contenido = document.getElementById('contenido');
        // Si la página ya puso el foco en un campo (autoFocus), se respeta
        if (contenido && (document.activeElement === document.body || document.activeElement === null)) {
            contenido.focus({ preventScroll: true });
        }
    }, 120);
});

// This will set light / dark mode on load...
initializeTheme();
