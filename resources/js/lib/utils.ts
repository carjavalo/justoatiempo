import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Ancho único de la plataforma: la barra superior, las migas y todas las páginas comparten el mismo
 * eje, para que nada salte al pasar de una página o pestaña a otra.
 */
export const ANCHO_PLATAFORMA = 'max-w-[1200px]';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
