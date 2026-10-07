import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from '@/components/iconos';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
    ({ className, ...props }, ref) => (
        <CheckboxPrimitive.Root
            ref={ref}
            className={cn(
                'peer size-5 shrink-0 rounded-sm border border-input transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-critical aria-invalid:focus-visible:border-critical aria-invalid:focus-visible:ring-critical/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accion data-[state=checked]:text-accion-foreground data-[state=checked]:border-accion',
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
                <Check className="size-3.5" aria-hidden="true" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    ),
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
