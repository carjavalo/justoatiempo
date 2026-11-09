import { fmt, type NivelEstado } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, Minus, XCircle } from '@/components/iconos';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';

/**
 * Contenedor estándar de cada bloque del panel. `nivel` 3 cuando va dentro de una sección con su propio título
 * (p. ej. los indicadores del tablero), para que la jerarquía de encabezados no salte.
 */
export function Panel({
    titulo,
    descripcion,
    acciones,
    children,
    className,
    cuerpoClassName,
    nivel = 2,
}: {
    titulo: ReactNode;
    descripcion?: ReactNode;
    acciones?: ReactNode;
    children: ReactNode;
    className?: string;
    cuerpoClassName?: string;
    nivel?: 2 | 3;
}) {
    const Titulo = nivel === 3 ? 'h3' : 'h2';
    return (
        <section className={cn('bg-card text-card-foreground flex flex-col rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
            <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
                    <Titulo className="text-[0.95rem] font-bold tracking-tight text-balance">{titulo}</Titulo>
                    {descripcion && <p className="text-muted-foreground mt-0.5 max-w-prose text-[0.8rem] text-pretty">{descripcion}</p>}
                </div>
                {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
            </header>
            <div className={cn('flex-1 px-5 pt-4 pb-5', cuerpoClassName)}>{children}</div>
        </section>
    );
}

/**
 * El tooltip de una gráfica se descarta con Escape (WCAG 1.4.13) esté donde esté el foco, y vuelve al mover el puntero
 * sobre la gráfica o recorrerla con las flechas. `manejadores` va en el contenedor de la gráfica.
 */
export function useTooltipDescartable() {
    const [oculto, setOculto] = useState(false);
    useEffect(() => {
        const alTeclear = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOculto(true);
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, []);

    return {
        oculto,
        manejadores: {
            onKeyDown: (e: KeyboardEvent) => e.key.startsWith('Arrow') && setOculto(false),
            onMouseMove: () => setOculto(false),
        },
    };
}

/**
 * Los datos de una gráfica como tabla, a un clic: la alternativa textual completa (WCAG 1.1.1). La primera celda de
 * cada fila la nombra (p. ej. la fecha).
 */
export function TablaGrafica({
    id,
    resumen,
    columnas,
    filas,
}: {
    id: string;
    /** Qué contiene, para el lector de pantalla. */
    resumen: string;
    columnas: { texto: string; numero?: boolean; destacada?: boolean }[];
    filas: { clave: string; celdas: ReactNode[] }[];
}) {
    const [abierta, setAbierta] = useState(false);
    return (
        <div className="mt-3 border-t pt-3">
            <button
                type="button"
                onClick={() => setAbierta((a) => !a)}
                aria-expanded={abierta}
                aria-controls={id}
                className="text-primary focus-visible:ring-ring flex items-center gap-1 rounded-sm text-xs font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
                <ChevronDown className={cn('size-4 transition-transform', abierta && 'rotate-180')} aria-hidden="true" />
                {abierta ? 'Ocultar los datos de la gráfica' : 'Ver los datos de la gráfica'}
            </button>
            <div
                id={id}
                hidden={!abierta}
                className="focus-visible:border-ring focus-visible:ring-ring/25 relative mt-3 max-h-72 overflow-auto rounded-lg border focus-visible:ring-[3px] focus-visible:outline-hidden"
                tabIndex={0}
                role="region"
                aria-label="Datos de la gráfica, desplazable"
            >
                <table className="w-full text-left text-xs">
                    <caption className="sr-only">{resumen}</caption>
                    <thead className="bg-muted text-muted-foreground sticky top-0">
                        <tr>
                            {columnas.map((c) => (
                                <th key={c.texto} scope="col" className={cn('px-3 py-2 font-semibold', c.numero && 'text-right')}>
                                    {c.texto}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filas.map((f) => (
                            <tr key={f.clave}>
                                {f.celdas.map((celda, i) =>
                                    i === 0 ? (
                                        <th key={i} scope="row" className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                                            {celda}
                                        </th>
                                    ) : (
                                        <td
                                            key={i}
                                            className={cn('px-3 py-1.5', columnas[i]?.numero && 'tabular text-right', columnas[i]?.destacada && 'font-semibold')}
                                        >
                                            {celda}
                                        </td>
                                    ),
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** Un dato del resumen (cumplimiento, entregas…): va dentro de una lista <ul role="list">. */
export function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: ReactNode }) {
    return (
        <li className="bg-card flex flex-col rounded-2xl border px-4 py-3.5">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{titulo}</span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums">{valor}</span>
            {detalle && <span className="text-muted-foreground mt-1 text-xs">{detalle}</span>}
        </li>
    );
}

const ESTADO = {
    good: { icono: CheckCircle2, clase: 'bg-good-soft text-good' },
    warning: { icono: AlertTriangle, clase: 'bg-warning-soft text-warning' },
    critical: { icono: XCircle, clase: 'bg-critical-soft text-critical' },
} as const;

/** Estado con ícono + texto: el color nunca carga el significado solo. */
export function EstadoBadge({ nivel, children, className }: { nivel: NivelEstado; children: ReactNode; className?: string }) {
    const { icono: Icono, clase } = ESTADO[nivel];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', clase, className)}>
            <Icono className="size-3.5" aria-hidden="true" />
            {children}
        </span>
    );
}

/**
 * Variación frente al periodo anterior. `mejorSiSube` define si subir es bueno. Sin con qué comparar no muestra nada:
 * la página lo dice una sola vez.
 */
export function Variacion({
    valor,
    sufijo = '%',
    mejorSiSube = true,
    siNoHay,
    className,
}: {
    valor: number | null;
    sufijo?: string;
    mejorSiSube?: boolean;
    /** Qué decir si no se puede calcular; sin texto no se muestra nada (la página ya dijo que no hay con qué comparar). */
    siNoHay?: string;
    className?: string;
}) {
    if (valor === null || !isFinite(valor)) {
        return siNoHay ? <span className={cn('text-muted-foreground text-xs', className)}>{siNoHay}</span> : null;
    }

    const neutro = Math.abs(valor) < 0.05;
    const sube = valor > 0;
    const bueno = neutro ? null : sube === mejorSiSube;
    const Icono = neutro ? Minus : sube ? ArrowUpRight : ArrowDownRight;
    const texto = `${sube ? '+' : ''}${valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })}${sufijo}`;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                bueno === null ? 'text-muted-foreground' : bueno ? 'text-good' : 'text-critical',
                className,
            )}
        >
            <Icono className="size-3.5" aria-hidden="true" />
            <span className="tabular">{neutro ? 'sin cambio' : texto}</span>
            {/* La flecha dice la dirección; si es buena o mala noticia no puede depender solo del color */}
            <span className="sr-only">
                {' '}
                frente al periodo anterior{bueno === null ? '' : bueno ? ', favorable' : ', desfavorable'}
            </span>
        </span>
    );
}

/**
 * Control segmentado (periodos, tipo de gráfica): grupo de botones conmutables con aria-pressed.
 * La opción activa va en azul de marca para que se distinga sin depender de un matiz sutil.
 */
export function Segmentado<T extends string | number>({
    opciones,
    valor,
    onChange,
    etiqueta,
}: {
    opciones: { valor: T; texto: string }[];
    valor: T | null;
    onChange: (v: T) => void;
    etiqueta: string;
}) {
    return (
        <div role="group" aria-label={etiqueta} className="bg-muted inline-flex rounded-lg p-0.5">
            {opciones.map((o) => {
                const activo = o.valor === valor;
                return (
                    <button
                        key={String(o.valor)}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => onChange(o.valor)}
                        className={cn(
                            'min-h-8 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                            // El aro de la opción activa es el de los botones de acción: se distingue sobre el azul
                            activo
                                ? 'bg-accion text-accion-foreground focus-visible:ring-anillo-accion shadow-sm'
                                : 'text-muted-foreground hover:text-foreground focus-visible:ring-ring',
                        )}
                    >
                        {o.texto}
                    </button>
                );
            })}
        </div>
    );
}

/** Barra de progreso horizontal con marca opcional de meta. */
export function BarraProgreso({
    valor,
    meta,
    className,
    colorClassName = 'bg-series-1',
    etiqueta,
}: {
    valor: number;
    meta?: number;
    className?: string;
    colorClassName?: string;
    etiqueta: string;
}) {
    const ancho = Math.max(0, Math.min(100, valor));
    return (
        <div
            role="meter"
            aria-label={etiqueta}
            aria-valuenow={Math.round(valor * 10) / 10}
            aria-valuetext={`${fmt.pct(valor)}${meta !== undefined ? `, meta ${fmt.pctEntero(meta)}` : ''}`}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn('bg-muted relative h-2 w-full rounded-full', className)}
        >
            <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', colorClassName)} style={{ width: `${ancho}%` }} />
            {meta !== undefined && (
                <div className="bg-foreground ring-card absolute -top-1 -bottom-1 w-0.5 rounded-full ring-2" style={{ left: `calc(${Math.min(100, meta)}% - 1px)` }} aria-hidden="true" />
            )}
        </div>
    );
}

/** Lo que falta en un bloque, en una línea: sin caja dentro de la caja. */
export function Vacio({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground text-sm text-pretty">{children}</p>;
}

/** Valor ausente: el guion se ve, el lector dice "sin datos". */
export function SinDato() {
    return (
        <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">sin datos</span>
        </>
    );
}
