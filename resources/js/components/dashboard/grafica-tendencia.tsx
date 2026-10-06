import { fmt } from '@/lib/formato';
import { ChevronDown } from 'lucide-react';
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

function TooltipTendencia({ active, payload, meta }: { active?: boolean; payload?: { payload: PuntoTendencia }[]; meta: number }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;

    return (
        // Al recorrer la gráfica con las flechas, el lector anuncia cada jornada
        <div role="status" className="bg-popover text-popover-foreground min-w-48 rounded-xl border p-3 text-xs shadow-xl">
            <p className="mb-2 font-bold first-letter:uppercase">{fmt.fechaLarga(p.fecha)}</p>
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

/** Tabla equivalente a la gráfica: alternativa textual completa (WCAG 1.1.1). */
function TablaDatos({ datos, meta }: { datos: PuntoTendencia[]; meta: number }) {
    const [abierta, setAbierta] = useState(false);
    return (
        <div className="mt-3 border-t pt-3">
            <button
                type="button"
                onClick={() => setAbierta((a) => !a)}
                aria-expanded={abierta}
                aria-controls="tabla-tendencia"
                className="text-primary flex items-center gap-1 text-xs font-semibold hover:underline"
            >
                <ChevronDown className={abierta ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} aria-hidden="true" />
                {abierta ? 'Ocultar los datos de la gráfica' : 'Ver los datos de la gráfica'}
            </button>
            <div
                id="tabla-tendencia"
                hidden={!abierta}
                className="focus-visible:ring-ring relative mt-3 max-h-72 overflow-auto rounded-lg border focus-visible:ring-2 focus-visible:outline-hidden"
                tabIndex={0}
                role="region"
                aria-label="Datos de la gráfica, desplazable"
            >
                <table className="w-full text-left text-xs">
                    <caption className="sr-only">Efectividad y volumen por jornada; meta {fmt.pctEntero(meta)}</caption>
                    <thead className="bg-muted text-muted-foreground sticky top-0">
                        <tr>
                            <th scope="col" className="px-3 py-2 font-semibold">
                                Fecha
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">
                                Efectividad
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">
                                Aprobadas
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">
                                Rechazadas
                            </th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">
                                Asignadas
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {datos.map((d) => (
                            <tr key={d.fecha}>
                                <th scope="row" className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                                    {fmt.fechaMedia(d.fecha)}
                                </th>
                                <td className="tabular px-3 py-1.5 text-right font-semibold">{fmt.pct(d.efectividad)}</td>
                                <td className="tabular px-3 py-1.5 text-right">{fmt.numero(d.aprobadas)}</td>
                                <td className="tabular px-3 py-1.5 text-right">{fmt.numero(d.rechazadas)}</td>
                                <td className="tabular px-3 py-1.5 text-right">{fmt.numero(d.asignadas)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/** Evolución diaria: efectividad vs. meta, o volumen aprobadas/rechazadas. Un solo eje por gráfica. */
export function GraficaTendencia({ datos, meta }: { datos: PuntoTendencia[]; meta: number }) {
    const [vista, setVista] = useState<Vista>('efectividad');
    // Escape oculta el tooltip (WCAG 1.4.13); se vuelve a mostrar al mover el puntero o las flechas
    const [tooltipOculto, setTooltipOculto] = useState(false);
    const minimo = Math.max(0, Math.floor((Math.min(...datos.map((d) => d.efectividad), meta) - 5) / 5) * 5);
    const muchos = datos.length > 20;

    const efectividades = datos.map((d) => d.efectividad);
    const resumen =
        datos.length > 0
            ? `${datos.length} jornadas del ${fmt.fechaMedia(datos[0].fecha)} al ${fmt.fechaMedia(datos[datos.length - 1].fecha)}. ` +
              `Efectividad entre ${fmt.pct(Math.min(...efectividades))} y ${fmt.pct(Math.max(...efectividades))}; meta ${fmt.pctEntero(meta)}. ` +
              `${datos.filter((d) => d.efectividad >= meta).length} jornadas en meta.`
            : '';

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
                            // La meta se rotula directamente sobre su línea de referencia
                            <Leyenda items={[{ color: 'var(--series-1)', texto: 'Efectividad diaria', linea: true }]} />
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
                    <div
                        className="h-72"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setTooltipOculto(true);
                            else if (e.key.startsWith('Arrow')) setTooltipOculto(false);
                        }}
                        onMouseMove={() => tooltipOculto && setTooltipOculto(false)}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            {vista === 'efectividad' ? (
                                <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} title="Efectividad diaria frente a la meta" desc={resumen}>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fmt.fechaCorta} {...ejes} minTickGap={24} />
                                    <YAxis domain={[minimo, 100]} tickFormatter={(v) => `${v}%`} {...ejes} axisLine={false} width={48} />
                                    <ReferenceLine
                                        y={meta}
                                        stroke="var(--foreground)"
                                        strokeOpacity={0.55}
                                        strokeWidth={1.5}
                                        label={{ value: `Meta ${fmt.pctEntero(meta)}`, position: 'insideBottomLeft', fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        active={tooltipOculto ? false : undefined}
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
                                <BarChart
                                    data={datos}
                                    margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                                    barCategoryGap={muchos ? 2 : '20%'}
                                    title="Entregas aprobadas y rechazadas por jornada"
                                    desc={resumen}
                                >
                                    <defs>
                                        <pattern id="rayado-rechazadas" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                            <rect width="5" height="5" fill="var(--series-2)" />
                                            <rect width="1.6" height="5" fill="var(--card)" />
                                        </pattern>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                    <XAxis dataKey="fecha" tickFormatter={fmt.fechaCorta} {...ejes} minTickGap={24} />
                                    <YAxis allowDecimals={false} {...ejes} axisLine={false} width={48} />
                                    <Tooltip
                                        active={tooltipOculto ? false : undefined}
                                        content={<TooltipTendencia meta={meta} />}
                                        cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                                        wrapperStyle={{ outline: 'none' }}
                                    />
                                    <Bar dataKey="aprobadas" stackId="v" fill="var(--series-1)" stroke="var(--card)" strokeWidth={1} animationDuration={600} />
                                    <Bar dataKey="rechazadas" stackId="v" fill="url(#rayado-rechazadas)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} animationDuration={600} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                    <TablaDatos datos={datos} meta={meta} />
                </>
            )}
        </Panel>
    );
}
