import { useEffect } from 'react';

/**
 * El carril de la barra de desplazamiento es transparente y deja ver el fondo base de la página, que es claro:
 * junto a las franjas azules del sitio (portada, "Por qué elegirnos", pie) quedaba una tira clara que no
 * concordaba. Aquí el carril copia, a la altura exacta, el color de lo que tiene al lado: azul junto a las
 * franjas marcadas con `data-fondo-oscuro` y el fondo de la página en el resto (variable `--carril`, que usa
 * app.css). Firefox solo admite un color en el carril (`--carril-plano`): el de lo que hay a media pantalla.
 * Se recalcula al desplazarse, al cambiar el tamaño de la ventana o de las franjas (p. ej. cuando cargan las
 * fotos) y al pasar entre modo claro y oscuro.
 */
export function useFondoBajoLaBarra() {
    useEffect(() => {
        const raiz = document.documentElement;
        const franjas = [...document.querySelectorAll<HTMLElement>('[data-fondo-oscuro]')];
        if (franjas.length === 0) return;

        let pendiente = 0;
        const pintar = () => {
            pendiente = 0;
            const alto = window.innerHeight;
            const claro = getComputedStyle(document.body).backgroundColor;
            const tramos: string[] = [];
            let cursor = 0;
            let plano = claro;

            // Las franjas van en orden de arriba abajo; solo cuenta la parte visible de cada una
            for (const franja of franjas) {
                const caja = franja.getBoundingClientRect();
                const inicio = Math.min(alto, Math.max(0, caja.top));
                const fin = Math.min(alto, Math.max(0, caja.bottom));
                if (fin <= inicio) continue;
                const oscuro = getComputedStyle(franja).backgroundColor;
                // Si la franja sigue más abajo de la pantalla, llega hasta el final del carril
                const hasta = caja.bottom >= alto - 1 ? '100%' : `${fin}px`;
                tramos.push(`${claro} ${cursor}px ${inicio}px`, `${oscuro} ${inicio}px ${hasta}`);
                if (inicio <= alto / 2 && fin > alto / 2) plano = oscuro;
                cursor = fin;
            }
            tramos.push(`${claro} ${cursor}px 100%`);

            raiz.style.setProperty('--carril', `linear-gradient(to bottom, ${tramos.join(', ')})`);
            raiz.style.setProperty('--carril-plano', plano);
        };
        const programar = () => {
            if (!pendiente) pendiente = requestAnimationFrame(pintar);
        };

        pintar();
        window.addEventListener('scroll', programar, { passive: true });
        window.addEventListener('resize', programar);
        // Las franjas cambian de alto al cargar fotos y fuentes, sin que la ventana cambie
        const tamanos = new ResizeObserver(programar);
        franjas.forEach((franja) => tamanos.observe(franja));
        tamanos.observe(document.body);
        // Modo claro/oscuro: cambia la clase del documento
        const tema = new MutationObserver(programar);
        tema.observe(raiz, { attributes: true, attributeFilter: ['class'] });

        return () => {
            cancelAnimationFrame(pendiente);
            window.removeEventListener('scroll', programar);
            window.removeEventListener('resize', programar);
            tamanos.disconnect();
            tema.disconnect();
            raiz.style.removeProperty('--carril');
            raiz.style.removeProperty('--carril-plano');
        };
    }, []);
}
