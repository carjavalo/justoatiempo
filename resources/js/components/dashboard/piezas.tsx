import { type NivelEstado } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Minus, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';

/** Contenedor estándar de cada bloque del panel. */
export function Panel({
    titulo,
    descripcion,
    acciones,
    children,
    className,
    cuerpoClassName,
}: {
    titulo: ReactNode;
    descripcion?: ReactNode;
    acciones?: ReactNode;
    children: ReactNode;
    className?: string;
    cuerpoClassName?: string;
}) {
    return (
        <section className={cn('bg-card text-card-foreground flex flex-col rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
            <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
                    <h2 className="text-[0.95rem] font-bold tracking-tight">{titulo}</h2>
                    {descripcion && <p className="text-muted-foreground mt-0.5 text-[0.8rem]">{descripcion}</p>}
                </div>
                {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
            </header>
            <div className={cn('flex-1 px-5 pt-4 pb-5', cuerpoClassName)}>{children}</div>
        </section>
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
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', clase, className)}>
            <Icono className="size-3.5" aria-hidden="true" />
            {children}
        </span>
    );
}

/** Variación frente al periodo anterior. `mejorSiSube` define si subir es bueno. */
export function Variacion({
    valor,
    sufijo = '%',
    mejorSiSube = true,
    className,
}: {
    valor: number | null;
    sufijo?: string;
    mejorSiSube?: boolean;
    className?: string;
}) {
    if (valor === null || !isFinite(valor)) {
        return <span className={cn('text-muted-foreground text-xs', className)}>sin comparativo</span>;
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
        </span>
    );
}

/** Control segmentado (periodos, pestañas de gráfica). */
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
        <div role="radiogroup" aria-label={etiqueta} className="bg-muted inline-flex rounded-lg p-0.5">
            {opciones.map((o) => {
                const activo = o.valor === valor;
                return (
                    <button
                        key={String(o.valor)}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => onChange(o.valor)}
                        className={cn(
                            'focus-visible:ring-ring rounded-md px-3 py-1.5 text-xs font-semibold transition-all outline-none focus-visible:ring-2',
                            activo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn('bg-muted relative h-2 w-full rounded-full', className)}
        >
            <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', colorClassName)} style={{ width: `${ancho}%` }} />
            {meta !== undefined && (
                <div
                    className="bg-foreground/70 absolute -top-1 -bottom-1 w-0.5 rounded-full"
                    style={{ left: `calc(${Math.min(100, meta)}% - 1px)` }}
                    title={`Meta ${meta}%`}
                />
            )}
        </div>
    );
}

export function Vacio({ children }: { children: ReactNode }) {
    return <div className="text-muted-foreground flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed text-sm">{children}</div>;
}
