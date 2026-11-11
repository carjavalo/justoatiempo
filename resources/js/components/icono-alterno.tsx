import { type TipoIcono } from '@/components/iconos';
import { cn } from '@/lib/utils';

const TRANSICION = 'transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';
const VISIBLE = 'scale-100 opacity-100 blur-none';
const OCULTO = 'scale-[0.25] opacity-0 blur-[4px]';

/**
 * Los dos íconos de un botón que alterna (mostrar u ocultar la contraseña, cambiar de teclado): en vez de cambiar de
 * golpe, uno se funde en el otro (escala, opacidad y desenfoque). Los dos quedan montados, el de `activo` encima, así
 * que la animación va en los dos sentidos sin librerías; con movimiento reducido, el cambio es inmediato. Son
 * decorativos: el nombre y el estado los lleva el botón.
 */
export function IconoAlterno({
    activo,
    Activo,
    Inactivo,
    className,
}: {
    activo: boolean;
    Activo: TipoIcono;
    Inactivo: TipoIcono;
    className?: string;
}) {
    return (
        <span className="relative inline-flex">
            <Activo className={cn(className, 'absolute inset-0', TRANSICION, activo ? VISIBLE : OCULTO)} aria-hidden="true" />
            <Inactivo className={cn(className, TRANSICION, activo ? OCULTO : VISIBLE)} aria-hidden="true" />
        </span>
    );
}
