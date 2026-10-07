import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from '@/components/iconos';
import * as React from 'react';

/**
 * Campo de contraseña con botón para mostrar u ocultar lo escrito.
 * El botón expone su estado con aria-pressed y no envía el formulario (type="button").
 */
type Props = Omit<React.ComponentProps<'input'>, 'type'> & {
    /** Modo controlado: p. ej. para mostrar una contraseña recién generada. */
    visible?: boolean;
    onVisibleChange?: (visible: boolean) => void;
};

const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
    ({ className, visible: visibleControlado, onVisibleChange, ...props }, ref) => {
        const [visibleInterno, setVisibleInterno] = React.useState(false);
        const visible = visibleControlado ?? visibleInterno;
        const setVisible = (v: boolean) => (onVisibleChange ? onVisibleChange(v) : setVisibleInterno(v));
        const Icono = visible ? EyeOff : Eye;

        return (
            <div className="relative">
                <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} spellCheck={false} autoCapitalize="none" {...props} />
                <button
                    type="button"
                    onClick={() => setVisible(!visible)}
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
