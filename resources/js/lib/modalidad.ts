/**
 * Con qué se está usando la página: teclado o mouse (o dedo). Queda en `<html data-modalidad>` y alimenta la
 * variante `teclado:` de app.css.
 *
 * Por qué hace falta: los menús y listas desplegables mueven el foco al elemento que está bajo el mouse, y el
 * navegador a veces lo trata como foco de teclado (:focus-visible). Así, el borde de foco, que es para quien
 * navega con teclado, aparecía con solo pasar el mouse. Con esto, al pasar el mouse solo se sombrea la opción.
 */
const TECLAS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Escape']);

export function iniciarModalidad() {
    const raiz = document.documentElement;
    const marcar = (modalidad: 'teclado' | 'puntero') => {
        if (raiz.dataset.modalidad !== modalidad) raiz.dataset.modalidad = modalidad;
    };

    window.addEventListener('keydown', (e) => TECLAS.has(e.key) && marcar('teclado'), true);
    window.addEventListener('pointerdown', () => marcar('puntero'), true);
    // Mover el mouse también cuenta: quien usa teclado y lo toca vuelve a ver la página como con mouse
    window.addEventListener('pointermove', () => marcar('puntero'), { capture: true, passive: true });
}
