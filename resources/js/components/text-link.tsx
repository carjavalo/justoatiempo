import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ComponentProps } from 'react';

type LinkProps = ComponentProps<typeof Link>;

export default function TextLink({ className = '', children, ...props }: LinkProps) {
    return (
        <Link
            className={cn(
                // El foco, como en los botones: un aro de 2 px sin separación (no el contorno del navegador)
                'text-foreground decoration-muted-foreground focus-visible:ring-ring rounded-sm underline underline-offset-4 transition-[color,text-decoration-color,box-shadow] duration-300 ease-out hover:decoration-current! focus-visible:ring-2 focus-visible:outline-hidden',
                className,
            )}
            {...props}
        >
            {children}
        </Link>
    );
}
