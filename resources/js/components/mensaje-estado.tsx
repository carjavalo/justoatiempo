import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/**
 * Mensaje de estado (éxito, confirmación) que el lector de pantalla anuncia (WCAG 4.1.3).
 * La región está siempre montada y el texto se asigna un instante después, para que se anuncie
 * tanto al llegar con la página como al actualizarse en la misma página.
 */
export function MensajeEstado({ mensaje, className }: { mensaje?: string | null; className?: string }) {
    const [texto, setTexto] = useState('');

    useEffect(() => {
        const t = window.setTimeout(() => setTexto(mensaje ?? ''), 100);
        return () => window.clearTimeout(t);
    }, [mensaje]);

    return (
        <div role="status" className={cn(texto ? 'bg-good-soft text-good mb-6 rounded-lg px-3 py-2 text-sm font-medium' : 'sr-only', className)}>
            {texto}
        </div>
    );
}
