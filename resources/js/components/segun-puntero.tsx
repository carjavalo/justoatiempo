import { type ReactNode } from 'react';

/**
 * Un texto según cómo se usa la pantalla: con mouse se puede arrastrar un archivo; con el dedo (el celular) no, así que
 * ahí se dice lo que sí se puede hacer. Solo uno de los dos se muestra y se lee.
 */
export function SegunPuntero({ mouse, dedo }: { mouse: ReactNode; dedo: ReactNode }) {
    return (
        <>
            <span className="hidden [@media(pointer:fine)]:inline">{mouse}</span>
            {dedo && <span className="[@media(pointer:fine)]:hidden">{dedo}</span>}
        </>
    );
}
