import { ArrowLeft } from '@/components/iconos';
import { cn } from '@/lib/utils';
import { type Volver } from '@/types';
import { Link } from '@inertiajs/react';

/**
 * Regreso al nivel anterior: flecha y destino escritos ("Volver al inicio"), para que nadie dependa
 * del botón Atrás del navegador ni adivine a dónde lleva. Es el único acceso a ese nivel en la
 * pantalla: no se repite en migas ni en la marca.
 */
export function EnlaceVolver({ texto, href, className }: Volver & { className?: string }) {
    return (
        <Link
            href={href}
            prefetch
            className={cn(
                'group text-muted-foreground hover:text-foreground inline-flex min-h-9 w-fit items-center gap-2.5 rounded-lg pr-2 text-sm font-semibold transition-colors',
                'focus-visible:ring-ring focus-visible:text-foreground focus-visible:ring-2 focus-visible:outline-hidden',
                className,
            )}
        >
            <span className="bg-card group-hover:border-primary/40 flex size-8 shrink-0 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[border-color,transform] group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                <ArrowLeft className="size-4" aria-hidden="true" />
            </span>
            {texto}
        </Link>
    );
}
