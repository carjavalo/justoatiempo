import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';

interface Opcion<T extends string> {
    valor: T;
    texto: string;
    /** Segunda línea (solo en tarjetas). */
    ayuda?: string;
    /** Clase del punto de color que acompaña al texto (p. ej. la gravedad). */
    marca?: string;
}

interface Props<T extends string> {
    id: string;
    etiqueta: string;
    valor: T | '';
    onCambio: (v: T) => void;
    opciones: Opcion<T>[];
    error?: string;
    requerido?: boolean;
    /** Pastillas en una fila o tarjetas con su explicación, una debajo de otra. */
    variante?: 'pastilla' | 'tarjeta';
}

/**
 * Elegir una opción entre pocas, todas a la vista (botones de radio con estilo). La primera lleva el id del campo
 * para recibir el foco si tiene error.
 */
export function OpcionesRadio<T extends string>({
    id,
    etiqueta,
    valor,
    onCambio,
    opciones,
    error,
    requerido = false,
    variante = 'pastilla',
}: Props<T>) {
    const tarjeta = variante === 'tarjeta';

    return (
        <fieldset className="grid gap-2" aria-describedby={error ? `${id}-error` : undefined}>
            <legend className="mb-1.5 text-sm leading-none font-medium">
                {etiqueta}
                {requerido && <span aria-hidden="true"> *</span>}
            </legend>
            <div className={cn(tarjeta ? 'grid gap-2' : 'flex flex-wrap gap-1.5')}>
                {opciones.map((o, i) => {
                    const elegido = valor === o.valor;
                    const idOpcion = i === 0 ? id : `${id}-${o.valor}`;
                    return (
                        <label
                            key={o.valor}
                            htmlFor={idOpcion}
                            className={cn(
                                'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 cursor-pointer border transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                tarjeta ? 'flex items-start gap-3 rounded-xl p-3' : 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
                                elegido
                                    ? cn('border-primary', tarjeta ? 'bg-secondary/60' : 'bg-secondary text-secondary-foreground font-semibold')
                                    : 'hover:bg-muted/60',
                            )}
                        >
                            <input
                                id={idOpcion}
                                type="radio"
                                name={id}
                                value={o.valor}
                                checked={elegido}
                                onChange={() => onCambio(o.valor)}
                                aria-invalid={error ? true : undefined}
                                className={tarjeta ? 'accent-primary mt-0.5 size-4 shrink-0' : 'sr-only'}
                            />
                            {tarjeta ? (
                                <span className="grid gap-0.5">
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                        {o.marca && <span className={cn('size-2 rounded-full', o.marca)} aria-hidden="true" />}
                                        {o.texto}
                                    </span>
                                    {o.ayuda && <span className="text-muted-foreground text-xs">{o.ayuda}</span>}
                                </span>
                            ) : (
                                <>
                                    {o.marca && <span className={cn('size-2 rounded-full', o.marca)} aria-hidden="true" />}
                                    {o.texto}
                                </>
                            )}
                        </label>
                    );
                })}
            </div>
            <InputError id={`${id}-error`} message={error} />
        </fieldset>
    );
}
