import { useEffect } from 'react';

/**
 * Atributos de accesibilidad de un campo según su error (WCAG 1.3.1 y 3.3.1):
 * marca el campo como inválido y lo describe con el mensaje, que debe tener id `${id}-error`.
 * `ayuda` agrega el id de un texto de ayuda permanente (p. ej. requisitos de la contraseña).
 */
export function propsCampo(id: string, error?: string, ayuda?: string) {
    const descripciones = [ayuda, error ? `${id}-error` : null].filter(Boolean).join(' ');

    return {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': descripciones || undefined,
    } as const;
}

/**
 * Tras un envío fallido, lleva el foco al primer campo con error. Se hace después del render
 * (no en onError) para que el lector ya encuentre el campo marcado como inválido y su mensaje.
 */
export function useFocoPrimerError(errores: Record<string, string | undefined>, orden: string[]) {
    useEffect(() => {
        const primero = orden.find((campo) => errores[campo]);
        if (primero) document.getElementById(primero)?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errores]);
}
