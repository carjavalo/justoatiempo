import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

/** Mensaje de error de un campo. Se asocia al campo con su id (ver propsCampo en lib/formularios). */
export default function InputError({ message, className = '', ...props }: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p {...props} className={cn('text-critical text-sm', className)}>
            {message}
        </p>
    ) : null;
}
