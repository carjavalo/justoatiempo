import { cn } from '@/lib/utils';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from '@/components/iconos';
import * as React from 'react';

/** Radix reserva el valor vacío para "sin elegir": la opción "Todos"/"Ninguna" usa este centinela por dentro. */
const VACIO = '__vacio__';

export interface OpcionSelector {
    valor: string;
    texto: string;
    /** Segunda línea en la lista (p. ej. la ciudad de una sede); no se repite en el campo. */
    detalle?: string;
    deshabilitada?: boolean;
}

type Props = Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>, 'value' | 'defaultValue' | 'onChange' | 'children' | 'dir'> & {
    id: string;
    valor: string;
    onCambio: (valor: string) => void;
    opciones: OpcionSelector[];
    /**
     * Texto con el valor vacío. Si se pasa, se muestra aunque exista una opción vacía (que entonces
     * sirve para "quitar la elección"); si no, se muestra la opción vacía (p. ej. "Todos los roles").
     */
    placeholder?: string;
    tamano?: 'sm' | 'md';
    /** Clases para el texto del campo (p. ej. un color de advertencia). */
    claseValor?: string;
};

/**
 * Lista desplegable de la plataforma (reemplaza al <select> del navegador): mismo estilo en todos
 * los sistemas, con teclado (flechas, Inicio/Fin, escribir para buscar) y lector de pantalla
 * (patrón combobox de Radix). La etiqueta se asocia con <label htmlFor={id}>; los atributos
 * aria-invalid y aria-describedby de propsCampo se pasan tal cual.
 */
export const Selector = React.forwardRef<HTMLButtonElement, Props>(
    ({ id, valor, onCambio, opciones, placeholder, tamano = 'md', disabled, className, claseValor, ...props }, ref) => {
        const hayOpcionVacia = opciones.some((o) => o.valor === '');
        // '' en Radix muestra el placeholder; el centinela muestra la opción "vacía" (p. ej. "Todos los roles")
        const value = valor === '' ? (hayOpcionVacia && placeholder === undefined ? VACIO : '') : valor;

        return (
            <SelectPrimitive.Root value={value} onValueChange={(v) => onCambio(v === VACIO ? '' : v)} disabled={disabled}>
                <SelectPrimitive.Trigger
                    ref={ref}
                    id={id}
                    className={cn(
                        'group border-input bg-background text-foreground flex w-full min-w-0 items-center justify-between gap-2 border text-left outline-hidden transition-[color,border-color,box-shadow]',
                        // Un solo borde: al enfocar o abrir, el borde toma el color de foco y lo rodea un halo suave sin separación
                        'hover:border-primary/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
                        'data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/25',
                        'data-[placeholder]:text-muted-foreground aria-invalid:border-critical aria-invalid:focus-visible:border-critical aria-invalid:focus-visible:ring-critical/25 disabled:cursor-not-allowed disabled:opacity-60',
                        tamano === 'sm' ? 'h-8 rounded-md px-2.5 text-xs font-medium' : 'h-10 rounded-lg px-3 text-sm',
                        className,
                    )}
                    {...props}
                >
                    <span className={cn('min-w-0 truncate', claseValor)}>
                        <SelectPrimitive.Value placeholder={placeholder ?? 'Elige una opción'} />
                    </span>
                    <SelectPrimitive.Icon asChild>
                        <ChevronDown
                            className={cn(
                                'text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none',
                                tamano === 'sm' ? 'size-3.5' : 'size-4',
                            )}
                            aria-hidden="true"
                        />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>

                <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                        position="popper"
                        sideOffset={6}
                        collisionPadding={12}
                        className={cn(
                            // Por encima de los paneles laterales y diálogos (z-50)
                            'bg-popover text-popover-foreground relative z-[60] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border',
                            'shadow-[0_16px_40px_rgba(18,36,74,0.16)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]',
                            'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95',
                            'motion-safe:data-[side=bottom]:slide-in-from-top-1 motion-safe:data-[side=top]:slide-in-from-bottom-1',
                        )}
                    >
                        <SelectPrimitive.ScrollUpButton className="text-muted-foreground flex h-7 cursor-default items-center justify-center">
                            <ChevronUp className="size-4" aria-hidden="true" />
                        </SelectPrimitive.ScrollUpButton>
                        <SelectPrimitive.Viewport className="p-1.5">
                            {opciones.map((o) => (
                                <SelectPrimitive.Item
                                    key={o.valor || VACIO}
                                    value={o.valor === '' ? VACIO : o.valor}
                                    disabled={o.deshabilitada}
                                    className={cn(
                                        'relative flex w-full cursor-pointer items-center rounded-lg py-2 pr-9 pl-3 outline-hidden select-none',
                                        tamano === 'sm' ? 'text-xs' : 'text-sm',
                                        'data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground',
                                        'data-[state=checked]:font-semibold data-disabled:pointer-events-none data-disabled:opacity-50',
                                    )}
                                >
                                    <span className="flex min-w-0 flex-col">
                                        <SelectPrimitive.ItemText>{o.texto}</SelectPrimitive.ItemText>
                                        {o.detalle && <span className="text-muted-foreground text-xs font-normal">{o.detalle}</span>}
                                    </span>
                                    <SelectPrimitive.ItemIndicator className="text-brand-coral-ink absolute right-2.5 flex items-center">
                                        <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                                    </SelectPrimitive.ItemIndicator>
                                </SelectPrimitive.Item>
                            ))}
                        </SelectPrimitive.Viewport>
                        <SelectPrimitive.ScrollDownButton className="text-muted-foreground flex h-7 cursor-default items-center justify-center">
                            <ChevronDown className="size-4" aria-hidden="true" />
                        </SelectPrimitive.ScrollDownButton>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
        );
    },
);

Selector.displayName = 'Selector';
