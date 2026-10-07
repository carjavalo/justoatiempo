import { cn } from '@/lib/utils';

interface Props {
    className?: string;
    /** Vacío cuando el nombre de la empresa ya está escrito al lado. */
    alt?: string;
    /** Versión de alta resolución, para mostrar el logo grande. */
    grande?: boolean;
}

/**
 * Logo oficial registrado de Justo a Tiempo SP S.A.S. Se muestra completo y sobre una placa
 * blanca, que es el fondo para el que fue diseñado: no se recolorea, recorta ni deforma.
 * El tamaño lo da `className` (por ejemplo `size-12`).
 */
export default function LogoMarca({ className, alt = '', grande = false }: Props) {
    return (
        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5', className)}>
            <img
                src={grande ? '/images/marca/logo.webp' : '/images/marca/logo-240.webp'}
                alt={alt}
                width={grande ? 720 : 240}
                height={grande ? 647 : 216}
                decoding="async"
                className="h-auto max-h-full w-full object-contain"
            />
        </span>
    );
}
