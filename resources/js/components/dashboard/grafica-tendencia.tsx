import { fmt } from '@/lib/formato';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, Segmentado, Vacio } from './piezas';
import { type PuntoTendencia } from './tipos';

type Vista = 'efectividad' | 'volumen';

const ejes = {
    tick: { fill: 'var(--chart-ink)', fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: 'var(--chart-axis)' },
} as const;

function Leyenda({ items }: { items: { color: string; texto: string; linea?: boolean }[] }) {
    return (
        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
            {items.map((i) => (
                <li key={i.texto} className="flex items-center gap-1.5">
                    {i.linea ? (
                        <span className="h-0.5 w-4 rounded-full" style={{ background: i.color }} />
                    ) : (
                        <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
                    )}
                    {i.texto}
                </li>
            ))}
        </ul>
    );
}

function TooltipTendencia({ active, payload, meta }: { active?: boolean; payload?: { payload: PuntoTendencia }[]; meta: number }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;

    return (
        <div className="bg-popover text-popover-foreground min-w-48 rounded-xl border p-3 text-xs shadow-xl">
            <p className="mb-2 font-bold first-letter:uppercase">{fmt.fechaLarga(p.fecha)}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <dt className="flex items-center gap-1.5">
                    <span className="bg-series-1 h-0.5 w-3 rounded-full" />
                    Efectividad
                </dt>
                <dd className="tabular text-right font-bold">{fmt.pct(p.efectividad)}</dd>
                <dt className="text-muted-foreground pl-[18px]">Frente a meta</dt>
                <dd className="tabular text-muted-foreground text-right">
                    {p.efectividad - meta >= 0 ? '+' : ''}
                    {(p.efectividad - meta).toLocaleString('es-CO', { maximumFractionDigits: 1 })} pts
                </dd>
                <dt className="flex items-center gap-1.5">
                    <span className="bg-series-1 size-2 rounded-[2px]" />
                    Aprobadas
                </dt>
                <dd className="tabular text-right font-semibold">{fmt.numero(p.aprobadas)}</dd>
                <dt className="flex items-center gap-1.5">
                    <span className="bg-series-2 size-2 rounded-[2px]" />
                    Rechazadas
                </dt>
                <dd className="tabular text-right font-semibold">{fmt.numero(p.rechazadas)}</dd>
                <dt className="text-muted-foreground border-t pt-1 pl-[14px]">Asignadas</dt>
                <dd className="tabular border-t pt-1 text-right font-semibold">{fmt.numero(p.asignadas)}</dd>
            </dl>
        </div>
    );
}

/** Evolución diaria: efectividad vs. meta, o volumen aprobadas/rechazadas. Un solo eje por gráfica. */
export function GraficaTendencia({ datos, meta }: { datos: PuntoTendencia[]; meta: number }) {
    const [vista, setVista] = useState<Vista>('efectividad');
    const minimo = Math.max(0, Math.floor((Math.min(...datos.map((d) => d.efectividad), meta) - 5) / 5) * 5);
    const muchos = datos.length > 20;

    return (
        <Panel
            titulo="Evolución diaria"
            descripcion={vista === 'efectividad' ? 'Efectividad por jornada frente a la meta' : 'Entregas aprobadas y rechazadas por jornada'}
            acciones={
                <Segmentado<Vista>
                    etiqueta="Tipo de gráfica"
                    valor={vista}
                    onChange={setVista}
                    opciones={[
                        { valor: 'efectividad', texto: 'Efectividad' },
                        { valor: 'volumen', texto: 'Volumen' },
                    ]}
                />
            }
        >
            {datos.length === 0 ? (
                <Vacio>No hay jornadas en el periodo seleccionado.</Vacio>
            ) : (
                <>
                    <div className="mb-3">
                        {vista === 'efectividad' ? (
                            <Leyenda
                                items={[
                                    { color: 'var(--series-1)', texto: 'Efectividad diaria', linea: true },
                                    { color: 'var(--foreground)', texto: `Meta ${fmt.pctEntero(meta)}`, linea: true },
                                ]}
                            />
                        ) : (
                            <Leyenda
                                items={[
                                    { color: 'var(--series-1)', texto: 'Aprobadas' },
                                    { color: 'var(--series-2)', texto: 'Rechazadas' },
                                ]}
                            />
                        )}
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            {vista === 'efectividad' ? (
                                <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fmt.fechaCorta} {...ejes} minTickGap={24} />
                                    <YAxis domain={[minimo, 100]} tickFormatter={(v) => `${v}%`} {...ejes} axisLine={false} width={48} />
                                    <ReferenceLine
                                        y={meta}
                                        stroke="var(--foreground)"
                                        strokeOpacity={0.55}
                                        strokeWidth={1.5}
                                        label={{ value: `Meta ${meta}%`, position: 'insideBottomLeft', fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        content={<TooltipTendencia meta={meta} />}
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
                                <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={muchos ? 2 : '20%'}>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fmt.fechaCorta} {...ejes} minTickGap={24} />
                                    <YAxis allowDecimals={false} {...ejes} axisLine={false} width={48} />
                                    <Tooltip
                                        content={<TooltipTendencia meta={meta} />}
                                        cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                                        wrapperStyle={{ outline: 'none' }}
                                    />
                                    <Bar dataKey="aprobadas" stackId="v" fill="var(--series-1)" stroke="var(--card)" strokeWidth={1} animationDuration={600} />
                                    <Bar dataKey="rechazadas" stackId="v" fill="var(--series-2)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} animationDuration={600} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </Panel>
    );
}
