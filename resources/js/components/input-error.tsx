import { XCircle } from '@/components/iconos';
import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

/**
 * Mensaje de error de un campo, con su ícono (los estados nunca van solo con color). Se asocia al campo con su id
 * (ver propsCampo en lib/formularios).
 */
export default function InputError({ message, className = '', ...props }: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p {...props} className={cn('text-critical flex items-start gap-1.5 text-sm', className)}>
            <XCircle className="mt-0.5 size-4" aria-hidden="true" />
            <span className="text-pretty">{message}</span>
        </p>
    ) : null;
}
