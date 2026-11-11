import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,scale] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-accion text-accion-foreground hover:bg-accion/90 focus-visible:ring-anillo-accion',
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:border-ring',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-9 rounded-md px-3',
                lg: 'h-11 rounded-md px-8',
                icon: 'h-10 w-10',
            },
            // Una leve presión al tocar (siempre 0.96): se siente que el botón respondió
            presion: {
                si: 'active:scale-[0.96] aria-disabled:active:scale-100 motion-reduce:active:scale-100',
                no: '',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
            presion: 'si',
        },
    },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<VariantProps<typeof buttonVariants>, 'presion'> {
    asChild?: boolean;
    /** Sin la presión al tocar: donde el movimiento distrae. */
    estatico?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, estatico = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // El enlace con forma de texto no se presiona como un botón
    const presion = estatico || variant === 'link' ? 'no' : 'si';
    return <Comp className={cn(buttonVariants({ variant, size, presion, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
