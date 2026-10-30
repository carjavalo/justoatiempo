import { router } from '@inertiajs/react';

/**
 * Las pantallas por las que ha pasado quien navega, para "Volver" a la anterior. Cambiar un filtro no es otra pantalla:
 * solo actualiza la dirección de la actual, así que al volver se regresa con los mismos filtros.
 */
const MAX_PANTALLAS = 30;
let pila: string[] = [];

const ruta = (url: string) => url.split('?')[0];

export function iniciarHistorial() {
    pila = [window.location.pathname + window.location.search];

    router.on('navigate', (evento) => {
        const { url, props } = evento.detail.page;
        // Sin sesión no hay a dónde volver (y quien ingrese después no hereda el recorrido de otra persona)
        if (!(props as { auth?: { user?: unknown } }).auth?.user) {
            pila = [];
            return;
        }

        const tope = pila.length - 1;
        if (tope >= 0 && ruta(pila[tope]) === ruta(url)) {
            pila[tope] = url;
        } else if (tope >= 1 && ruta(pila[tope - 1]) === ruta(url)) {
            pila.pop();
            pila[tope - 1] = url;
        } else {
            pila.push(url);
            if (pila.length > MAX_PANTALLAS) pila.shift();
        }
    });
}

/** La pantalla anterior a la que se está viendo (la plantilla puede dibujarse antes del aviso de "navigate"). */
export function pantallaAnterior(rutaActual: string): string | null {
    const tope = pila.length - 1;
    if (tope < 0) return null;
    if (ruta(pila[tope]) === rutaActual) return pila[tope - 1] ?? null;
    if (tope >= 1 && ruta(pila[tope - 1]) === rutaActual) return pila[tope - 2] ?? null;

    return pila[tope];
}
