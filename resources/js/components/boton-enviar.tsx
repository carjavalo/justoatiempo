import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';
import { type ComponentProps } from 'react';

/**
 * Botón de envío que, mientras se procesa, queda aria-disabled en vez de disabled: así no pierde
 * el foco (un botón deshabilitado lo suelta al <body>) y el estado "Enviando…" se anuncia.
 * El formulario debe ignorar el envío si `procesando` es verdadero.
 */
export function BotonEnviar({ procesando, children, className, textoProcesando = 'Enviando…', ...props }: ComponentProps<typeof Button> & { procesando: boolean; textoProcesando?: string }) {
    return (
        <>
            <Button type="submit" aria-disabled={procesando || undefined} className={cn('aria-disabled:cursor-wait aria-disabled:opacity-70', className)} {...props}>
                {procesando && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                {children}
            </Button>
            <span role="status" className="sr-only">
                {procesando ? textoProcesando : ''}
            </span>
        </>
    );
}
