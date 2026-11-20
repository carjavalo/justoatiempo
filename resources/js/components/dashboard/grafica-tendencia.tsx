import { aFecha, fmt } from '@/lib/formato';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, Segmentado, TablaGrafica, useTooltipDescartable, Vacio } from './piezas';
import { type Agrupacion, type PuntoTendencia } from './tipos';

type Vista = 'efectividad' | 'volumen';

/** Con menos puntos no hay evolución que ver: una línea entre uno o dos puntos no dice nada. */
const MINIMO_JORNADAS = 3;

/** Cómo se nombra cada punto: una jornada, una semana o un mes. */
const UNIDAD: Record<Agrupacion, { una: string; varias: string; titulo: string; adjetivo: string; columna: string }> = {
    dia: { una: 'jornada', varias: 'jornadas', titulo: 'Evolución diaria', adjetivo: 'diaria', columna: 'Fecha' },
    semana: { una: 'semana', varias: 'semanas', titulo: 'Evolución semanal', adjetivo: 'semanal', columna: 'Semana desde' },
    mes: { una: 'mes', varias: 'meses', titulo: 'Evolución mensual', adjetivo: 'mensual', columna: 'Mes' },
};

/**
 * Las fechas de los puntos, para el eje, el detalle y la tabla. Por mes: "nov 2026". Por día o semana: "3 nov" y, si el
 * periodo cruza de año, con el año ("3 nov 25").
 */
function fechasDe(agrupacion: Agrupacion, datos: PuntoTendencia[]) {
    const variosAnios = datos.length > 0 && datos[0].fecha.slice(0, 4) !== datos[datos.length - 1].fecha.slice(0, 4);
    const otroAnio = (iso: string) => variosAnios || aFecha(iso).getFullYear() !== new Date().getFullYear();
    const mesCorto = (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
    const mesLargo = (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const diaCorto = (iso: string) =>
        variosAnios ? aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '') : fmt.fechaCorta(iso);
    const diaLargo = (iso: string) =>
        otroAnio(iso) ? aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : fmt.fechaLarga(iso);

    return {
        eje: agrupacion === 'mes' ? mesCorto : diaCorto,
        detalle: agrupacion === 'mes' ? mesLargo : agrupacion === 'semana' ? (iso: string) => `Semana del ${fmt.fechaMedia(iso)}` : diaLargo,
        tabla: agrupacion === 'mes' ? mesLargo : fmt.fechaMedia,
    };
}

const ejes = {
    tick: { fill: 'var(--chart-ink)', fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: 'var(--chart-axis)' },
} as const;

/** Rayado de la serie "Rechazadas": se distingue de "Aprobadas" también sin color (WCAG 1.4.1). */
const RAYADO_LEYENDA = 'repeating-linear-gradient(45deg, var(--series-2) 0 3px, var(--card) 3px 5px)';

function Leyenda({ items }: { items: { color: string; texto: string; linea?: boolean }[] }) {
    return (
        <ul role="list" className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
            {items.map((i) => (
                <li key={i.texto} className="flex items-center gap-1.5">
                    {i.linea ? (
                        <span className="h-0.5 w-4 rounded-full" style={{ background: i.color }} aria-hidden="true" />
                    ) : (
                        <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden="true" />
                    )}
                    {i.texto}
                </li>
            ))}
        </ul>
    );
}

function TooltipTendencia({
    active,
    payload,
    meta,
    fecha,
}: {
    active?: boolean;
    payload?: { payload: PuntoTendencia }[];
    meta: number;
    fecha: (iso: string) => string;
}) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;

    return (
        // Al recorrer la gráfica con las flechas, el lector anuncia cada punto
        <div role="status" className="bg-popover text-popover-foreground min-w-48 rounded-xl border p-3 text-xs shadow-xl">
            <p className="mb-2 font-bold first-letter:uppercase">{fecha(p.fecha)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <dt className="flex items-center gap-1.5">
                    <span className="bg-series-1 h-0.5 w-3 rounded-full" aria-hidden="true" />
                    Efectividad
                </dt>
                <dd className="tabular text-right font-bold">{fmt.pct(p.efectividad)}</dd>
                <dt className="text-muted-foreground pl-[18px]">Frente a meta</dt>
                <dd className="tabular text-muted-foreground text-right">
                    {p.efectividad - meta >= 0 ? '+' : ''}
                    {(p.efectividad - meta).toLocaleString('es-CO', { maximumFractionDigits: 1 })} pts
                </dd>
                <dt className="flex items-center gap-1.5">
                    <span className="bg-series-1 size-2 rounded-[2px]" aria-hidden="true" />
                    Aprobadas
                </dt>
                <dd className="tabular text-right font-semibold">{fmt.numero(p.aprobadas)}</dd>
                <dt className="flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px]" style={{ background: RAYADO_LEYENDA }} aria-hidden="true" />
                    Rechazadas
                </dt>
                <dd className="tabular text-right font-semibold">{fmt.numero(p.rechazadas)}</dd>
                <dt className="text-muted-foreground border-t pt-1 pl-[14px]">Asignadas</dt>
                <dd className="tabular border-t pt-1 text-right font-semibold">{fmt.numero(p.asignadas)}</dd>
            </dl>
        </div>
    );
}

/**
 * Evolución por jornada (o por semana o mes, si el periodo es largo): efectividad vs. meta, o volumen
 * aprobadas/rechazadas. Un solo eje por gráfica.
 */
export function GraficaTendencia({ datos, meta, agrupacion = 'dia' }: { datos: PuntoTendencia[]; meta: number; agrupacion?: Agrupacion }) {
    const [vista, setVista] = useState<Vista>('efectividad');
    const u = UNIDAD[agrupacion];
    const fechas = fechasDe(agrupacion, datos);
    const tooltip = useTooltipDescartable();
    const minimo = Math.max(0, Math.floor((Math.min(...datos.map((d) => d.efectividad), meta) - 5) / 5) * 5);
    const muchos = datos.length > 20;

    const efectividades = datos.map((d) => d.efectividad);
    const enMeta = datos.filter((d) => d.efectividad >= meta).length;
    const resumen =
        datos.length > 0
            ? `${datos.length} ${datos.length === 1 ? u.una : u.varias} del ${fmt.fechaMedia(datos[0].fecha)} al ${fmt.fechaMedia(datos[datos.length - 1].fecha)}. ` +
              `Efectividad entre ${fmt.pct(Math.min(...efectividades))} y ${fmt.pct(Math.max(...efectividades))}; meta ${fmt.pctEntero(meta)}. ` +
              `${enMeta} ${enMeta === 1 ? u.una : u.varias} en meta.`
            : '';
    const conGrafica = datos.length >= MINIMO_JORNADAS;

    return (
        <Panel
            nivel={3}
            titulo={u.titulo}
            descripcion={
                !conGrafica ? undefined : vista === 'efectividad' ? `Efectividad por ${u.una} frente a la meta` : `Entregas aprobadas y rechazadas por ${u.una}`
            }
            acciones={
                conGrafica && (
                    <Segmentado<Vista>
                        etiqueta="Tipo de gráfica"
                        valor={vista}
                        onChange={setVista}
                        opciones={[
                            { valor: 'efectividad', texto: 'Efectividad' },
                            { valor: 'volumen', texto: 'Volumen' },
                        ]}
                    />
                )
            }
        >
            {!conGrafica ? (
                // Cuántas jornadas hay ya lo dice la tarjeta de entregas
                <Vacio>
                    La evolución se ve desde {MINIMO_JORNADAS} {u.varias}.
                </Vacio>
            ) : (
                <>
                    <div className="mb-3">
                        {vista === 'efectividad' ? (
                            // La meta se rotula directamente sobre su línea de referencia
                            <Leyenda items={[{ color: 'var(--series-1)', texto: `Efectividad ${u.adjetivo}`, linea: true }]} />
                        ) : (
                            // Mismo orden que la pila: rechazadas arriba, aprobadas en la base
                            <Leyenda
                                items={[
                                    { color: RAYADO_LEYENDA, texto: 'Rechazadas (arriba)' },
                                    { color: 'var(--series-1)', texto: 'Aprobadas (base)' },
                                ]}
                            />
                        )}
                    </div>
                    <div className="h-72" {...tooltip.manejadores}>
                        <ResponsiveContainer width="100%" height="100%">
                            {vista === 'efectividad' ? (
                                <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} title={`Efectividad ${u.adjetivo} frente a la meta`} desc={resumen}>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fechas.eje} {...ejes} minTickGap={24} />
                                    <YAxis domain={[minimo, 100]} tickFormatter={(v) => `${v}%`} {...ejes} axisLine={false} width={48} />
                                    <ReferenceLine
                                        y={meta}
                                        stroke="var(--foreground)"
                                        strokeOpacity={0.55}
                                        strokeWidth={1.5}
                                        label={{ value: `Meta ${fmt.pctEntero(meta)}`, position: 'insideBottomLeft', fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        active={tooltip.oculto ? false : undefined}
                                        content={<TooltipTendencia meta={meta} fecha={fechas.detalle} />}
                                        cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                                        wrapperStyle={{ outline: 'none' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="efectividad"
                                        stroke="var(--series-1)"
                                        strokeWidth={2}
                                        dot={muchos ? false : { r: 4, fill: 'var(--series-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                                        activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--card)', strokeWidth: 2 }}
                                        animationDuration={600}
                                    />
                                </LineChart>
                            ) : (
                                <BarChart
                                    data={datos}
                                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                                    barCategoryGap={muchos ? 2 : '20%'}
                                    title={`Entregas aprobadas y rechazadas por ${u.una}`}
                                    desc={resumen}
                                >
                                    <defs>
                                        <pattern id="rayado-rechazadas" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                            <rect width="5" height="5" fill="var(--series-2)" />
                                            <rect width="1.6" height="5" fill="var(--card)" />
                                        </pattern>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fechas.eje} {...ejes} minTickGap={24} />
                                    <YAxis allowDecimals={false} {...ejes} axisLine={false} width={48} />
                                    <Tooltip
                                        active={tooltip.oculto ? false : undefined}
                                        content={<TooltipTendencia meta={meta} fecha={fechas.detalle} />}
                                        cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                                        wrapperStyle={{ outline: 'none' }}
                                    />
                                    <Bar dataKey="aprobadas" stackId="v" fill="var(--series-1)" stroke="var(--card)" strokeWidth={1} animationDuration={600} />
                                    <Bar dataKey="rechazadas" stackId="v" fill="url(#rayado-rechazadas)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} animationDuration={600} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                    <TablaGrafica
                        id="tabla-tendencia"
                        resumen={`Efectividad y volumen por ${u.una}; meta ${fmt.pctEntero(meta)}`}
                        columnas={[
                            { texto: u.columna },
                            { texto: 'Efectividad', numero: true, destacada: true },
                            { texto: 'Aprobadas', numero: true },
                            { texto: 'Rechazadas', numero: true },
                            { texto: 'Asignadas', numero: true },
                        ]}
                        filas={datos.map((d) => ({
                            clave: d.fecha,
                            celdas: [fechas.tabla(d.fecha), fmt.pct(d.efectividad), fmt.numero(d.aprobadas), fmt.numero(d.rechazadas), fmt.numero(d.asignadas)],
                        }))}
                    />
                </>
            )}
        </Panel>
    );
}
