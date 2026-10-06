import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

/**
 * Campo de contraseña con botón para mostrar u ocultar lo escrito.
 * El botón expone su estado con aria-pressed y no envía el formulario (type="button").
 */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<'input'>, 'type'>>(
    ({ className, ...props }, ref) => {
        const [visible, setVisible] = React.useState(false);
        const Icono = visible ? EyeOff : Eye;

        return (
            <div className="relative">
                <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} spellCheck={false} autoCapitalize="none" {...props} />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    // Patrón de botón alternable: nombre fijo + aria-pressed (cambiar ambos confunde al lector de pantalla)
                    aria-label="Mostrar contraseña"
                    aria-pressed={visible}
                    aria-controls={props.id}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                    <Icono className="size-4" aria-hidden="true" />
                </button>
            </div>
        );
    },
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
