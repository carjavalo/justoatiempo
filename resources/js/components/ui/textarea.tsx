import { cn } from '@/lib/utils';
import * as React from 'react';

/** Área de texto con el mismo borde, foco de un solo borde y estado de error que los campos de la plataforma. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            'border-input bg-background placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-base leading-relaxed transition-[color,border-color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:outline-hidden',
            'aria-invalid:border-critical aria-invalid:focus-visible:border-critical aria-invalid:focus-visible:ring-critical/25',
            className,
        )}
        {...props}
    />
));
Textarea.displayName = 'Textarea';

export { Textarea };
