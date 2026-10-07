import { type EstadoAuditoria } from '@/lib/protocolo';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, CircleDashed, FileX2, Paperclip, XCircle, type TipoIcono } from '@/components/iconos';
import { type FiltrosAuditoria, type OrdenCola } from './tipos';

const ESTADOS: Record<EstadoAuditoria, { texto: string; icono: TipoIcono; clase: string }> = {
    pendiente: { texto: 'Por auditar', icono: CircleDashed, clase: 'bg-secondary text-secondary-foreground' },
    pendiente_sin_archivos: { texto: 'Sin archivos', icono: FileX2, clase: 'bg-warning-soft text-warning' },
    cumple: { texto: 'Cumple', icono: CheckCircle2, clase: 'bg-good-soft text-good' },
    no_cumple: { texto: 'No cumple', icono: AlertTriangle, clase: 'bg-critical-soft text-critical' },
    sin_evidencia: { texto: 'Sin evidencia', icono: XCircle, clase: 'bg-critical-soft text-critical' },
};

export function EstadoAuditoriaBadge({ estado, className }: { estado: EstadoAuditoria; className?: string }) {
    const { texto, icono: Icono, clase } = ESTADOS[estado];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', clase, className)}>
            <Icono className="size-3.5" aria-hidden="true" />
            {texto}
        </span>
    );
}

/** Parámetros de la URL que conservan los filtros al cambiar de orden. */
export function consultaFiltros(f: FiltrosAuditoria): Record<string, string> {
    const q: Record<string, string> = { estado: f.estado };
    if (f.cliente) q.cliente = String(f.cliente);
    if (f.q) q.q = f.q;
    return q;
}

/** Cola de la jornada: cada orden es un enlace; la abierta lleva aria-current. */
export function Cola({ ordenes, seleccionadaId, filtros }: { ordenes: OrdenCola[]; seleccionadaId: number | null; filtros: FiltrosAuditoria }) {
    const query = new URLSearchParams(consultaFiltros(filtros)).toString();

    return (
        <nav aria-labelledby="titulo-cola" className="bg-card flex min-h-0 flex-col rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h2 id="titulo-cola" className="border-b px-4 py-3 text-sm font-bold">
                Órdenes <span className="text-muted-foreground font-medium">({ordenes.length})</span>
            </h2>
            {ordenes.length === 0 ? (
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">No hay órdenes con este filtro.</p>
            ) : (
                <ul role="list" className="max-h-[calc(100svh-15rem)] min-h-0 divide-y overflow-y-auto overscroll-contain">
                    {ordenes.map((o) => {
                        const activa = o.id === seleccionadaId;
                        return (
                            <li key={o.id}>
                                <Link
                                    href={`/auditoria/${o.id}?${query}`}
                                    preserveScroll
                                    aria-current={activa ? 'true' : undefined}
                                    className={cn(
                                        'focus-visible:ring-ring relative block px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset',
                                        activa ? 'bg-secondary/80' : 'hover:bg-muted/60',
                                        // Barra lateral de la orden abierta (señal que no depende solo del fondo)
                                        activa && 'before:bg-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-sm font-semibold">{o.codigo}</span>
                                        <EstadoAuditoriaBadge estado={o.estadoAuditoria} />
                                    </span>
                                    <span className="mt-1 block truncate text-xs font-medium">{o.destinatario ?? 'Sin destinatario'}</span>
                                    <span className="text-muted-foreground mt-0.5 flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate">
                                            {o.auxiliar ?? 'Sin auxiliar'}
                                            {o.placa && <> · {o.placa}</>}
                                        </span>
                                        {o.evidencias > 0 && (
                                            <span className="flex shrink-0 items-center gap-0.5">
                                                <Paperclip className="size-3.5" aria-hidden="true" />
                                                {o.evidencias}
                                                <span className="sr-only">{o.evidencias === 1 ? 'archivo' : 'archivos'}</span>
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </nav>
    );
}
