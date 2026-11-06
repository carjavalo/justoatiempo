/**
 * Fábrica de los íconos de la plataforma: el dibujo es de Phosphor y el estilo sale del papel del ícono
 * (ver el catálogo en ./index.ts).
 */
import { cn } from '@/lib/utils';
import { type Icon as IconoPhosphor, type IconProps, type IconWeight } from '@phosphor-icons/react';
import { forwardRef } from 'react';

export type PropsIcono = Omit<IconProps, 'ref'> & {
    /** Compatibilidad: un trazo fino (≤1.25) usa el peso ligero; uno grueso (≥2.5), el negrita. */
    strokeWidth?: number;
};

export type TipoIcono = React.ForwardRefExoticComponent<PropsIcono & React.RefAttributes<SVGSVGElement>>;

type Papel = 'concepto' | 'estado' | 'control';
const PESO: Record<Papel, IconWeight> = { concepto: 'duotone', estado: 'fill', control: 'bold' };

export function icono(Base: IconoPhosphor, papel: Papel, nombre: string): TipoIcono {
    const Componente = forwardRef<SVGSVGElement, PropsIcono>(({ className, strokeWidth, weight, size = 24, ...props }, ref) => {
        const peso =
            weight ??
            (strokeWidth !== undefined && strokeWidth <= 1.25 ? 'light' : strokeWidth !== undefined && strokeWidth >= 2.5 ? 'bold' : PESO[papel]);
        // El tamaño real lo da la clase (size-4, size-5…); 24 solo aplica si no hay clase
        return (
            <Base ref={ref} weight={peso} size={size} className={cn('icono shrink-0', peso === 'duotone' && 'icono-acento', className)} {...props} />
        );
    });
    Componente.displayName = nombre;
    return Componente;
}
