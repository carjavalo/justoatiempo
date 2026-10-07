import { fmt, nivelFrenteAMeta, variacion } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ClipboardCheck, PackageCheck, PackageX, Truck, XCircle } from '@/components/iconos';
import { type TipoIcono } from '@/components/iconos';
import { SinDato, Variacion } from './piezas';
import { type DashboardProps, type Kpis } from './tipos';

/** Indicador principal: efectividad global frente a la meta (RF-06). */
export function HeroEfectividad({
    kpis,
    previos,
    meta,
    titulo = 'Efectividad global',
}: {
    kpis: Kpis;
    previos: Kpis;
    meta: number;
    titulo?: string;
}) {
    const nivel = nivelFrenteAMeta(kpis.asignadas ? kpis.efectividad : null, meta);
    const brecha = kpis.efectividad - meta;
    const EstadoIcono = nivel === 'good' ? CheckCircle2 : nivel === 'warning' ? AlertTriangle : XCircle;
    const estadoTexto = nivel === 'good' ? 'En meta' : nivel === 'warning' ? 'Cerca de la meta' : 'Bajo la meta';

    return (
        <section aria-labelledby="titulo-efectividad" className="from-brand-navy-deep via-brand-navy relative isolate flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br to-[#2a4f8f] p-6 text-white shadow-lg shadow-[#12244a]/20">
            {/* Textura de marca: trama de puntos que se desvanece hacia la izquierda */}
            <div
                className="pointer-events-none absolute inset-0 -z-10 opacity-[0.09] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_70%)]"
                aria-hidden="true"
            />

            <div className="flex items-center justify-between gap-3">
                <h2 id="titulo-efectividad" className="text-sm font-semibold text-white/80">
                    {titulo}
                </h2>
                {nivel && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[0.72rem] font-semibold ring-1 ring-white/15">
                        <EstadoIcono className={cn('size-3.5', nivel === 'good' ? 'text-[#6ee7a0]' : nivel === 'warning' ? 'text-[#fcd27a]' : 'text-[#ffb4ad]')} aria-hidden="true" />
                        {estadoTexto}
                    </span>
                )}
            </div>

            <div className="mt-3 flex items-end gap-3">
                <span className="text-[3.4rem] leading-none font-extrabold tracking-tight">{kpis.asignadas ? fmt.pct(kpis.efectividad) : <SinDato />}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                <Variacion
                    valor={variacion(kpis.asignadas ? kpis.efectividad : null, previos.asignadas ? previos.efectividad : null, 'puntos')}
                    sufijo=" pts"
                    className="[&.text-critical]:text-[#ffb4ad] [&.text-good]:text-[#6ee7a0] [&.text-muted-foreground]:text-white/60"
                />
                {/* El lector ya recibe este contexto dentro de la variación */}
                <span aria-hidden="true">vs. periodo anterior</span>
            </div>

            {/* La barra de la meta queda anclada al pie cuando el héroe se estira a la altura de los indicadores */}
            <div className="mt-auto pt-8">
                <p className="mb-2 text-xs font-medium text-white/70">
                    Meta {fmt.pctEntero(meta)} ·{' '}
                    <span className="font-semibold text-white">
                        {brecha >= 0 ? '+' : ''}
                        {brecha.toLocaleString('es-CO', { maximumFractionDigits: 1 })} pts
                    </span>
                </p>
                <div
                    className="relative h-2.5 rounded-full bg-white/25"
                    role="meter"
                    aria-label="Efectividad frente a la meta"
                    aria-valuenow={Math.round(kpis.efectividad * 10) / 10}
                    aria-valuetext={`${fmt.pct(kpis.efectividad)}, meta ${fmt.pctEntero(meta)}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    {/* Coral claro: contrasta con la pista y con el azul */}
                    <div className="bg-brand-coral-on-dark h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, kpis.efectividad)}%` }} />
                    <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-white" style={{ left: `calc(${meta}% - 1px)` }} aria-hidden="true" />
                </div>
            </div>
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
    icono: TipoIcono;
    titulo: string;
    valor: React.ReactNode;
    detalle: React.ReactNode;
    variacionValor: number | null;
    mejorSiSube?: boolean;
    sufijo?: string;
    tono?: 'navy' | 'coral' | 'steel';
}) {
    return (
        <div className="bg-card group flex flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-md">
            {/* Orden de lectura: título, valor, detalle y variación; visualmente la fila del ícono va arriba */}
            <h3 className="text-muted-foreground mt-4 text-[0.8rem] font-medium">{titulo}</h3>
            <p className="mt-0.5 text-[1.75rem] leading-tight font-extrabold tracking-tight">{valor}</p>
            <p className="text-muted-foreground mt-1 text-xs">{detalle}</p>
            <div className="order-first flex items-start justify-between">
                <span
                    className={cn(
                        'flex size-10 items-center justify-center rounded-xl',
                        tono === 'navy' && 'bg-secondary text-primary',
                        tono === 'coral' && 'bg-brand-coral-soft text-brand-coral-ink',
                        tono === 'steel' && 'bg-muted text-muted-foreground',
                    )}
                >
                    <Icono className="size-5" aria-hidden="true" />
                </span>
                <Variacion valor={variacionValor} mejorSiSube={mejorSiSube} sufijo={sufijo} />
            </div>
        </div>
    );
}

export function TilesKpi({ kpis, previos, vista }: { kpis: Kpis; previos: Kpis; vista: DashboardProps['vista'] }) {
    return (
        <section aria-labelledby="titulo-kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h2 id="titulo-kpis" className="sr-only">
                Indicadores del periodo
            </h2>
            <Tile
                icono={Truck}
                titulo="Entregas asignadas"
                valor={fmt.numero(kpis.asignadas)}
                detalle={vista === 'gerencial' ? `${kpis.jornadas} jornadas · ${kpis.auxiliares} auxiliares` : `${kpis.jornadas} ${kpis.jornadas === 1 ? 'jornada' : 'jornadas'} en el periodo`}
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
                valor={kpis.cumplimientoPod === null ? <SinDato /> : fmt.pct(kpis.cumplimientoPod)}
                detalle={`${fmt.numero(kpis.sinEvidencia)} entregas sin evidencia`}
                variacionValor={variacion(kpis.cumplimientoPod, previos.cumplimientoPod, 'puntos')}
                sufijo=" pts"
                tono="steel"
            />
        </section>
    );
}
