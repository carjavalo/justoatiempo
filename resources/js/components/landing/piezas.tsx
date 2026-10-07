import { cn } from '@/lib/utils';
import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Aparece suavemente al entrar en pantalla. Con "reducir movimiento" no se anima
 * (variantes motion-safe) y sin IntersectionObserver se muestra de inmediato.
 */
export function Revelar({ children, className, retraso = 0, as: Etiqueta = 'div' }: { children: ReactNode; className?: string; retraso?: number; as?: ElementType }) {
    const ref = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { rootMargin: '0px 0px -8% 0px' },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <Etiqueta
            ref={ref}
            data-visible={visible}
            style={{ transitionDelay: visible ? `${retraso}ms` : undefined }}
            className={cn(
                'motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out',
                'motion-safe:data-[visible=false]:translate-y-6 motion-safe:data-[visible=false]:opacity-0',
                className,
            )}
        >
            {children}
        </Etiqueta>
    );
}

/** Encabezado de sección: antetítulo, título (h2) y entrada. */
export function EncabezadoSeccion({
    id,
    antetitulo,
    titulo,
    entrada,
    centrado = false,
    sobreAzul = false,
}: {
    id: string;
    antetitulo: string;
    titulo: ReactNode;
    entrada?: ReactNode;
    centrado?: boolean;
    sobreAzul?: boolean;
}) {
    return (
        <Revelar className={cn('max-w-3xl', centrado && 'mx-auto text-center')}>
            <p className={cn('text-sm font-bold tracking-[0.16em] uppercase', sobreAzul ? 'text-brand-coral-on-dark' : 'text-brand-coral-ink')}>{antetitulo}</p>
            <h2 id={id} className={cn('mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-[2.6rem]', sobreAzul && 'text-white')}>
                {titulo}
            </h2>
            {entrada && <p className={cn('mt-4 text-base leading-relaxed text-pretty md:text-lg', sobreAzul ? 'text-white/80' : 'text-muted-foreground')}>{entrada}</p>}
        </Revelar>
    );
}
