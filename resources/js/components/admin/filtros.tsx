import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Search, X } from '@/components/iconos';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Selector } from '@/components/selector';

type Filtros = Record<string, string>;

/**
 * Filtros en la dirección de la página (se pueden compartir y sobreviven a recargar).
 * La búsqueda espera a que se deje de escribir; las listas aplican al instante.
 */
export function useFiltros<T extends Filtros>(url: string, iniciales: T) {
    const [valores, setValores] = useState<T>(iniciales);
    const espera = useRef<number>(undefined);

    const visitar = (nuevos: T) => {
        const params = Object.fromEntries(Object.entries(nuevos).filter(([, v]) => v !== ''));
        router.get(url, params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const cambiar = (campo: keyof T, valor: string, { inmediato = true } = {}) => {
        const nuevos = { ...valores, [campo]: valor };
        setValores(nuevos);
        window.clearTimeout(espera.current);
        if (inmediato) visitar(nuevos);
        else espera.current = window.setTimeout(() => visitar(nuevos), 350);
    };

    const limpiar = () => {
        const vacios = Object.fromEntries(Object.keys(valores).map((k) => [k, ''])) as T;
        setValores(vacios);
        window.clearTimeout(espera.current);
        router.get(url, {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    useEffect(() => () => window.clearTimeout(espera.current), []);

    const activos = Object.values(valores).some((v) => v !== '');

    return { valores, cambiar, limpiar, activos };
}

interface PropsBarra {
    children: ReactNode;
    resumen: string;
    /** Sin resultados el mensaje se ve en la lista: aquí solo se anuncia (no se repite en pantalla). */
    soloAnunciar?: boolean;
    activos: boolean;
    onLimpiar: () => void;
    /** Campo que recibe el foco al quitar los filtros (el botón desaparece). */
    idBusqueda: string;
}

export function BarraFiltros({ children, resumen, soloAnunciar = false, activos, onLimpiar, idBusqueda }: PropsBarra) {
    return (
        <div className="flex flex-col gap-3">
            <div role="search" className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                {children}
            </div>
            <div className="flex min-h-6 items-center justify-end gap-3 text-sm [&>p:not(.sr-only)]:mr-auto">
                {/* Se anuncia al cambiar los filtros */}
                <p role="status" className={cn('text-muted-foreground', soloAnunciar && 'sr-only')}>
                    {resumen}
                </p>
                {activos && (
                    <button
                        type="button"
                        onClick={() => {
                            document.getElementById(idBusqueda)?.focus();
                            onLimpiar();
                        }}
                        className="text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-md font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden">
                        <X className="size-4" aria-hidden="true" />
                        Quitar filtros
                    </button>
                )}
            </div>
        </div>
    );
}

export function CampoBusqueda({ id, etiqueta, valor, onCambio, placeholder }: { id: string; etiqueta: string; valor: string; onCambio: (v: string) => void; placeholder: string }) {
    return (
        <div className="relative sm:min-w-72 sm:flex-1">
            <label htmlFor={id} className="sr-only">
                {etiqueta}
            </label>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
            <input
                id={id}
                type="search"
                value={valor}
                onChange={(e) => onCambio(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="border-input bg-card placeholder:text-muted-foreground h-10 w-full rounded-lg border pr-3 pl-9 text-sm transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            />
        </div>
    );
}

export function FiltroLista({ id, etiqueta, valor, onCambio, opciones, className }: { id: string; etiqueta: string; valor: string; onCambio: (v: string) => void; opciones: { valor: string; texto: string }[]; className?: string }) {
    return (
        <div className={cn('sm:w-52', className)}>
            <label htmlFor={id} className="sr-only">
                {etiqueta}
            </label>
            <Selector id={id} valor={valor} onCambio={onCambio} opciones={opciones} className="bg-card" />
        </div>
    );
}
