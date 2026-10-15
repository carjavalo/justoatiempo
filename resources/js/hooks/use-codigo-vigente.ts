import { router } from '@inertiajs/react';
import { useEffect } from 'react';

/** Tiempo sin hablar con el servidor tras el cual el código de seguridad pudo vencer (la sesión dura 2 horas). */
const ESPERA_MS = 20 * 60 * 1000;

/**
 * Las páginas que se dejan abiertas mucho tiempo (el ingreso, el sitio público) pierden su código de seguridad
 * (CSRF) cuando la sesión vence en el servidor, y el siguiente envío fallaría. Al volver a la página después de
 * un rato, se renueva en segundo plano antes de que la persona envíe nada. No toca lo que ya se escribió.
 */
export function useCodigoVigente() {
    useEffect(() => {
        let ultimoContacto = Date.now();
        const quitarFin = router.on('finish', () => {
            ultimoContacto = Date.now();
        });

        const alVolver = () => {
            if (document.visibilityState !== 'visible' || Date.now() - ultimoContacto < ESPERA_MS) return;
            ultimoContacto = Date.now();
            // Recarga parcial sin datos: la respuesta trae el código nuevo (cookie XSRF-TOKEN). Asíncrona para que un
            // envío inmediato no la cancele ni espere por ella.
            router.reload({ only: ['__codigo_vigente'], async: true });
        };

        // Volver a la pestaña (visibilitychange), a la ventana (focus) o empezar a interactuar con la página
        const eventos = ['focus', 'pointerdown', 'keydown'] as const;
        eventos.forEach((e) => window.addEventListener(e, alVolver, { capture: true, passive: true }));
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            quitarFin();
            eventos.forEach((e) => window.removeEventListener(e, alVolver, { capture: true }));
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, []);
}
