import { fmt, nivelFrenteAMeta } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { BarraProgreso, EstadoBadge, Panel, Vacio } from './piezas';
import { type EfectividadCliente, type MotivoRechazo, type Protocolo } from './tipos';

const MAX_MOTIVOS = 6;

/** Distribución de motivos de rechazo (SRS 4.1). Barras horizontales ordenadas, un solo color. */
export function MotivosRechazo({ motivos }: { motivos: MotivoRechazo[] }) {
    const total = motivos.reduce((s, m) => s + m.total, 0);
    // A partir del 7.º motivo se agrupa en "Otros" para no saturar
    const visibles = motivos.length > MAX_MOTIVOS
        ? [...motivos.slice(0, MAX_MOTIVOS - 1), { motivo: 'Otros motivos', total: motivos.slice(MAX_MOTIVOS - 1).reduce((s, m) => s + m.total, 0) }]
        : motivos;
    const mayor = Math.max(1, ...visibles.map((m) => m.total));

    return (
        <Panel titulo="Motivos de rechazo" descripcion={total ? `${fmt.numero(total)} entregas no efectuadas en el periodo` : 'Sin rechazos en el periodo'}>
            {total === 0 ? (
                <Vacio>Sin rechazos: todas las entregas fueron aprobadas.</Vacio>
            ) : (
                <ul className="space-y-3.5">
                    {visibles.map((m, i) => {
                        const pct = (m.total / total) * 100;
                        return (
                            <li key={m.motivo} className="group">
                                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8rem]">
                                    <span className={cn('truncate', i === 0 ? 'font-semibold' : 'text-foreground/85')}>{m.motivo}</span>
                                    <span className="tabular shrink-0">
                                        <span className="font-bold">{fmt.numero(m.total)}</span>
                                        <span className="text-muted-foreground ml-1.5 inline-block w-11 text-right">{fmt.pct(pct)}</span>
                                    </span>
                                </div>
                                <div className="bg-muted h-2 overflow-hidden rounded-full">
                                    <div
                                        className="bg-series-2 h-full rounded-full transition-[width,opacity] duration-700 group-hover:opacity-80"
                                        style={{ width: `${(m.total / mayor) * 100}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** Efectividad por cliente frente a su propia meta (hoja "Parámetros cliente"). */
export function EfectividadPorCliente({ clientes }: { clientes: EfectividadCliente[] }) {
    return (
        <Panel titulo="Efectividad por cliente" descripcion="Cada barra frente a la meta pactada con el cliente">
            {clientes.length === 0 ? (
                <Vacio>Sin operación en el periodo.</Vacio>
            ) : (
                <ul className="space-y-5">
                    {clientes.map((c) => {
                        const nivel = nivelFrenteAMeta(c.efectividad, c.meta)!;
                        return (
                            <li key={c.id}>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold">{c.nombre}</p>
                                        <p className="text-muted-foreground tabular text-xs">
                                            {fmt.numero(c.aprobadas)} de {fmt.numero(c.asignadas)} entregas
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="text-lg leading-none font-extrabold">{fmt.pct(c.efectividad)}</span>
                                        <EstadoBadge nivel={nivel}>{nivel === 'good' ? 'En meta' : `Meta ${fmt.pctEntero(c.meta)}`}</EstadoBadge>
                                    </div>
                                </div>
                                <BarraProgreso valor={c.efectividad} meta={c.meta} etiqueta={`Efectividad ${c.nombre}`} className="h-2.5" />
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** RF-09/RF-10: qué componente del protocolo de evidencias se cumple menos. */
export function CumplimientoProtocolo({ protocolo }: { protocolo: Protocolo }) {
    const peor = [...protocolo.componentes].sort((a, b) => a.cumplimiento - b.cumplimiento)[0];

    return (
        <Panel titulo="Protocolo de evidencias (POD)" descripcion={`${fmt.numero(protocolo.auditadas)} entregas auditadas en el periodo`}>
            {protocolo.auditadas === 0 ? (
                <Vacio>Aún no hay entregas auditadas en este periodo.</Vacio>
            ) : (
                <>
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {protocolo.componentes.map((c, i) => {
                            const nivel = nivelFrenteAMeta(c.cumplimiento, 95)!;
                            return (
                                <li key={c.clave} className="bg-muted/50 rounded-xl border p-3.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-card text-muted-foreground flex size-6 items-center justify-center rounded-md border text-[0.7rem] font-bold">
                                                {i + 1}
                                            </span>
                                            <div>
                                                <p className="text-[0.8rem] leading-tight font-semibold">{c.nombre}</p>
                                                <p className="text-muted-foreground text-[0.7rem]">{c.detalle}</p>
                                            </div>
                                        </div>
                                        <span className="text-base font-extrabold">{fmt.pctEntero(c.cumplimiento)}</span>
                                    </div>
                                    <BarraProgreso
                                        valor={c.cumplimiento}
                                        etiqueta={c.nombre}
                                        className="mt-3 h-1.5"
                                        colorClassName={nivel === 'good' ? 'bg-good' : nivel === 'warning' ? 'bg-warning' : 'bg-critical'}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                    <div className="bg-secondary/70 text-secondary-foreground mt-4 flex items-start gap-2 rounded-xl p-3 text-xs">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                            El punto más débil es <strong>{peor.nombre.toLowerCase()}</strong> ({fmt.pct(peor.cumplimiento)}).{' '}
                            {protocolo.sinDestapar > 0 && (
                                <>
                                    {fmt.numero(protocolo.sinDestapar)} entregas se recibieron sin destapar con nota firmada en la remesa.
                                </>
                            )}
                        </p>
                    </div>
                </>
            )}
        </Panel>
    );
}
