import { Panel } from '@/components/dashboard/piezas';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AlertTriangle, Ban, Check, CheckCircle2, EnRevision, type TipoIcono } from '@/components/iconos';
import { type ReactNode, useState } from 'react';

export interface ErrorFila {
    fila: number;
    campo: string;
    mensaje: string;
    valor: string | null;
}

export interface Advertencia {
    tipo: string;
    titulo: string;
    detalle: string;
    items: { valor: string; ordenes: number }[];
}

export type EstadoCarga = 'en_revision' | 'procesada' | 'con_errores' | 'anulada';

const ESTADOS: Record<EstadoCarga, { icono: TipoIcono; clase: string }> = {
    en_revision: { icono: EnRevision, clase: 'bg-warning-soft text-warning' },
    procesada: { icono: CheckCircle2, clase: 'bg-good-soft text-good' },
    con_errores: { icono: AlertTriangle, clase: 'bg-warning-soft text-warning' },
    anulada: { icono: Ban, clase: 'bg-muted text-muted-foreground' },
};

export function EstadoCargaBadge({ estado, texto }: { estado: EstadoCarga; texto: string }) {
    const { icono: Icono, clase } = ESTADOS[estado];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', clase)}>
            {/* Todos los estados rellenos: se leen igual y sin el acento coral de los conceptos */}
            <Icono weight="fill" className="size-3.5" aria-hidden="true" />
            {texto}
        </span>
    );
}

/** Cifra resumida: valor grande + etiqueta. */
export function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: 'critical' | 'warning' | 'good' }) {
    return (
        <div className="bg-card rounded-2xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <dt className="text-muted-foreground text-xs font-medium">{etiqueta}</dt>
            <dd
                className={cn(
                    'mt-1 text-2xl leading-tight font-extrabold tracking-tight',
                    tono === 'critical' && 'text-critical',
                    tono === 'warning' && 'text-warning',
                    tono === 'good' && 'text-good',
                )}
            >
                {valor}
            </dd>
            {detalle && <dd className="text-muted-foreground mt-0.5 text-xs">{detalle}</dd>}
        </div>
    );
}

/** Pasos del flujo de carga. */
export function Pasos({ actual }: { actual: 1 | 2 | 3 | 4 }) { // 4 = todos completados
    const pasos = ['Subir archivo', 'Revisar', 'Importar'];
    return (
        <ol role="list" aria-label="Pasos de la carga" className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {pasos.map((p, i) => {
                const n = i + 1;
                const hecho = n < actual;
                const activo = n === actual;
                return (
                    <li key={p} className="flex items-center gap-2" aria-current={activo ? 'step' : undefined}>
                        <span
                            className={cn(
                                'flex size-6 items-center justify-center rounded-full text-[0.7rem]',
                                hecho && 'bg-good-soft text-good',
                                activo && 'bg-brand-coral text-brand-coral-foreground',
                                !hecho && !activo && 'bg-muted text-muted-foreground',
                            )}
                        >
                            {hecho ? <Check className="size-3.5" aria-hidden="true" /> : n}
                        </span>
                        <span className={cn(activo ? 'text-foreground' : 'text-muted-foreground')}>
                            {p}
                            {hecho && <span className="sr-only"> (completado)</span>}
                        </span>
                        {n < pasos.length && <span className="bg-border mx-1 h-px w-6" aria-hidden="true" />}
                    </li>
                );
            })}
        </ol>
    );
}

const MAX_ITEMS = 6;

/** Advertencias: no impiden importar, pero conviene corregirlas en los datos maestros. */
export function ListaAdvertencias({ advertencias }: { advertencias: Advertencia[] }) {
    if (advertencias.length === 0) return null;

    return (
        <Panel titulo="Advertencias" descripcion="No impiden importar. Conviene corregirlas en los datos maestros.">
            <ul role="list" className="grid gap-3 md:grid-cols-2">
                {advertencias.map((a) => (
                    <li key={a.tipo} className="bg-warning-soft/60 rounded-xl border border-[color-mix(in_oklab,var(--status-warning)_25%,transparent)] p-4">
                        <p className="flex items-center gap-2 text-sm font-bold">
                            <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden="true" />
                            {a.titulo}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">{a.detalle}</p>
                        {a.items.length > 0 && (
                            <ul role="list" className="mt-3 flex flex-wrap gap-1.5">
                                {a.items.slice(0, MAX_ITEMS).map((it) => (
                                    <li key={it.valor} className="bg-card rounded-md border px-2 py-0.5 text-xs">
                                        <span className="font-semibold">{it.valor}</span>
                                        <span className="text-muted-foreground"> · {it.ordenes} {it.ordenes === 1 ? 'orden' : 'órdenes'}</span>
                                    </li>
                                ))}
                                {a.items.length > MAX_ITEMS && (
                                    <li className="text-muted-foreground px-1 py-0.5 text-xs">y {a.items.length - MAX_ITEMS} más</li>
                                )}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

const FILAS_VISIBLES = 10;

/** Filas omitidas por error, con su número de fila en Excel para ubicarlas en el archivo. */
export function TablaErrores({ errores, total, titulo = 'Filas que no se importan' }: { errores: ErrorFila[]; total: number; titulo?: string }) {
    const [todas, setTodas] = useState(false);
    if (total === 0) return null;

    const visibles = todas ? errores : errores.slice(0, FILAS_VISIBLES);

    return (
        <Panel
            titulo={titulo}
            descripcion={`${fmt.numero(total)} ${total === 1 ? 'problema encontrado' : 'problemas encontrados'}. El número de fila corresponde al del archivo en Excel.`}
            cuerpoClassName="px-0 pb-2"
        >
            <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label="Filas que no se importan, desplazable">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <caption className="sr-only">{titulo}</caption>
                    <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                        <tr>
                            <th scope="col" className="w-20 py-2.5 pl-5 font-semibold">
                                Fila
                            </th>
                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                Campo
                            </th>
                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                Problema
                            </th>
                            <th scope="col" className="py-2.5 pr-5 pl-3 font-semibold">
                                Valor en el archivo
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {visibles.map((e, i) => (
                            <tr key={`${e.fila}-${i}`}>
                                <td className="tabular py-2.5 pl-5 font-bold">{e.fila}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">{e.campo}</td>
                                <td className="px-3 py-2.5">{e.mensaje}</td>
                                <td className="text-muted-foreground max-w-48 truncate py-2.5 pr-5 pl-3 font-mono text-xs" title={e.valor ?? undefined}>
                                    {e.valor ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {errores.length > FILAS_VISIBLES && (
                <div className="border-t px-5 pt-2">
                    <button type="button" onClick={() => setTodas((t) => !t)} className="text-primary text-xs font-semibold hover:underline" aria-expanded={todas}>
                        {todas ? 'Ver menos' : `Ver los ${errores.length} problemas`}
                    </button>
                </div>
            )}
            {total > errores.length && (
                <p className="text-muted-foreground px-5 pt-2 text-xs">Se muestran los primeros {errores.length}; corrige el archivo y vuelve a subirlo para revisar el resto.</p>
            )}
        </Panel>
    );
}
