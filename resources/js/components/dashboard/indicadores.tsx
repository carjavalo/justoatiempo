import AppLogoIcon from '@/components/app-logo-icon';
import { fmt, nivelFrenteAMeta, variacion } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ClipboardCheck, PackageCheck, PackageX, Truck, XCircle } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Variacion } from './piezas';
import { type Kpis, type PuntoTendencia } from './tipos';

/** Indicador principal: efectividad global frente a la meta (RF-06). */
export function HeroEfectividad({
    kpis,
    previos,
    meta,
    tendencia,
    titulo = 'Efectividad global',
}: {
    kpis: Kpis;
    previos: Kpis;
    meta: number;
    tendencia: PuntoTendencia[];
    titulo?: string;
}) {
    const nivel = nivelFrenteAMeta(kpis.asignadas ? kpis.efectividad : null, meta);
    const brecha = kpis.efectividad - meta;
    const EstadoIcono = nivel === 'good' ? CheckCircle2 : nivel === 'warning' ? AlertTriangle : XCircle;
    const estadoTexto = nivel === 'good' ? 'En meta' : nivel === 'warning' ? 'Cerca de la meta' : 'Bajo la meta';

    return (
        <section className="from-brand-navy-deep via-brand-navy relative isolate overflow-hidden rounded-2xl bg-gradient-to-br to-[#2a4f8f] p-6 text-white shadow-lg shadow-[#12244a]/20">
            {/* Engranaje decorativo de la marca */}
            <AppLogoIcon
                className="pointer-events-none absolute -top-10 -right-12 -z-10 size-64 text-white/[0.04]"
                gearClassName="fill-white/[0.06]"
            />

            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white/75">{titulo}</p>
                {nivel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[0.72rem] font-semibold ring-1 ring-white/15">
                        <EstadoIcono className={cn('size-3.5', nivel === 'good' ? 'text-[#6ee7a0]' : nivel === 'warning' ? 'text-[#fcd27a]' : 'text-[#ffb4ad]')} />
                        {estadoTexto}
                    </span>
                )}
            </div>

            <div className="mt-3 flex items-end gap-3">
                <span className="text-[3.4rem] leading-none font-extrabold tracking-tight">{kpis.asignadas ? fmt.pct(kpis.efectividad) : '—'}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                <Variacion
                    valor={variacion(kpis.asignadas ? kpis.efectividad : null, previos.asignadas ? previos.efectividad : null, 'puntos')}
                    sufijo=" pts"
                    className="[&.text-critical]:text-[#ffb4ad] [&.text-good]:text-[#6ee7a0] [&.text-muted-foreground]:text-white/60"
                />
                <span>vs. periodo anterior</span>
            </div>

            <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-medium text-white/70">
                    <span>
                        Meta {fmt.pctEntero(meta)} ·{' '}
                        <span className="font-semibold text-white">
                            {brecha >= 0 ? '+' : ''}
                            {brecha.toLocaleString('es-CO', { maximumFractionDigits: 1 })} pts
                        </span>
                    </span>
                    <span className="tabular">
                        {fmt.numero(kpis.aprobadas)} / {fmt.numero(kpis.asignadas)} entregas
                    </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-white/15" role="meter" aria-label="Efectividad frente a la meta" aria-valuenow={kpis.efectividad} aria-valuemin={0} aria-valuemax={100}>
                    <div className="bg-brand-coral h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, kpis.efectividad)}%` }} />
                    <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-white" style={{ left: `calc(${meta}% - 1px)` }} />
                </div>
            </div>

            {tendencia.length > 1 && (
                <div className="mt-5 -mb-2 h-16" aria-hidden="true">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tendencia} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <YAxis hide domain={['dataMin - 4', 100]} />
                            <Area type="monotone" dataKey="efectividad" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={2} fill="url(#hero-area)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
}

function Tile({
    icono: Icono,
    titulo,
    valor,
    detalle,
    variacionValor,
    mejorSiSube = true,
    sufijo = '%',
    tono = 'navy',
}: {
    icono: LucideIcon;
    titulo: string;
    valor: string;
    detalle: React.ReactNode;
    variacionValor: number | null;
    mejorSiSube?: boolean;
    sufijo?: string;
    tono?: 'navy' | 'coral' | 'steel';
}) {
    return (
        <div className="bg-card group flex flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
                <span
                    className={cn(
                        'flex size-10 items-center justify-center rounded-xl',
                        tono === 'navy' && 'bg-secondary text-primary',
                        tono === 'coral' && 'bg-brand-coral-soft text-[#b4432f] dark:bg-[#e8705f]/15 dark:text-[#f19a8c]',
                        tono === 'steel' && 'bg-muted text-muted-foreground',
                    )}
                >
                    <Icono className="size-5" aria-hidden="true" />
                </span>
                <Variacion valor={variacionValor} mejorSiSube={mejorSiSube} sufijo={sufijo} />
            </div>
            <p className="text-muted-foreground mt-4 text-[0.8rem] font-medium">{titulo}</p>
            <p className="mt-0.5 text-[1.75rem] leading-tight font-extrabold tracking-tight">{valor}</p>
            <p className="text-muted-foreground mt-1 text-xs">{detalle}</p>
        </div>
    );
}

export function TilesKpi({ kpis, previos }: { kpis: Kpis; previos: Kpis }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Tile
                icono={Truck}
                titulo="Entregas asignadas"
                valor={fmt.numero(kpis.asignadas)}
                detalle={`${kpis.jornadas} jornadas · ${kpis.auxiliares} auxiliares`}
                variacionValor={variacion(kpis.asignadas, previos.asignadas)}
            />
            <Tile
                icono={PackageCheck}
                titulo="Entregas aprobadas"
                valor={fmt.numero(kpis.aprobadas)}
                detalle={`${fmt.numero(kpis.faltantes)} con faltantes · ${fmt.numero(kpis.averias)} averías`}
                variacionValor={variacion(kpis.aprobadas, previos.aprobadas)}
            />
            <Tile
                icono={PackageX}
                titulo="Devoluciones"
                valor={fmt.numero(kpis.devoluciones)}
                detalle="Rechazadas que regresan a bodega"
                variacionValor={variacion(kpis.devoluciones, previos.devoluciones)}
                mejorSiSube={false}
                tono="coral"
            />
            <Tile
                icono={ClipboardCheck}
                titulo="Cumplimiento protocolo POD"
                valor={fmt.pct(kpis.cumplimientoPod)}
                detalle={`${fmt.numero(kpis.auditadas)} auditadas · ${fmt.numero(kpis.sinEvidencia)} sin evidencia`}
                variacionValor={variacion(kpis.cumplimientoPod, previos.cumplimientoPod, 'puntos')}
                sufijo=" pts"
                tono="steel"
            />
        </div>
    );
}
