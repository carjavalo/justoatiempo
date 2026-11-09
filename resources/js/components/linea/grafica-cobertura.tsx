import { EstadoBadge, Panel, TablaGrafica, useTooltipDescartable } from '@/components/dashboard/piezas';
import { fmt, semaforo } from '@/lib/formato';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { plural } from './dia';

/**
 * La cobertura de un día. Sin cobertura (null) si no hubo programación (`programado` falso) o si no se registró la
 * asistencia de nadie: eso no se califica, como en el informe.
 */
export interface DiaCobertura {
    fecha: string;
    programado: boolean;
    cobertura: number | null;
}

/** Con menos días calificados no hay evolución que ver (como en la evolución de logística). */
export const MINIMO_DIAS = 3;

/** Por debajo, el semáforo pide seguimiento inmediato (el mismo del informe y su Excel). */
const UMBRAL = 80;

/** Alto de la marca de los días sin cobertura, en puntos del eje: se ve sin pasar por una barra de verdad. */
const MARCA = 4;

const ejes = {
    tick: { fill: 'var(--chart-ink)', fontSize: 12 },
    tickLine: false,
    axisLine: { stroke: 'var(--chart-axis)' },
} as const;

const sinCobertura = (d: DiaCobertura) => (d.programado ? 'Sin asistencia registrada' : 'Sin programación');

function TooltipCobertura({ active, payload }: { active?: boolean; payload?: { payload: DiaCobertura }[] }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const nivel = semaforo(d.cobertura);

    return (
        // Al recorrer la gráfica con las flechas, el lector anuncia cada día
        <div role="status" className="bg-popover text-popover-foreground min-w-44 rounded-xl border p-3 text-xs shadow-xl">
            <p className="font-bold first-letter:uppercase">{fmt.fechaLarga(d.fecha)}</p>
            {d.cobertura === null ? (
                <p className="text-muted-foreground mt-1">{sinCobertura(d)}</p>
            ) : (
                <>
                    <p className="mt-1.5 flex items-baseline justify-between gap-4">
                        Cobertura <span className="tabular font-bold">{fmt.pct(d.cobertura)}</span>
                    </p>
                    {nivel && (
                        <EstadoBadge nivel={nivel.nivel} className="mt-2">
                            {nivel.texto}
                        </EstadoBadge>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * La cobertura de cada uno de los días anteriores a hoy (hoy va arriba, en "Hoy"): una barra por día, a su altura real,
 * con la línea del seguimiento (80%). Los días sin cobertura llevan una marca punteada en la base, así que un hueco solo
 * puede ser un 0% (que además se rotula). Lo esencial se lee sin pasar el puntero; el detalle, en el tooltip y la tabla.
 */
export function GraficaCobertura({ dias }: { dias: DiaCobertura[] }) {
    const tooltip = useTooltipDescartable();
    const valores = dias.flatMap((d) => (d.cobertura === null ? [] : [d.cobertura]));
    const programados = dias.filter((d) => d.programado).length;
    const sinRegistro = dias.filter((d) => d.programado && d.cobertura === null).length;
    const completos = valores.filter((v) => v >= 100).length;
    const bajo = valores.filter((v) => v < UMBRAL).length;
    const lectura = [
        plural(programados, 'día programado', 'días programados'),
        plural(completos, 'completo', 'completos'),
        bajo > 0 && `${fmt.numero(bajo)} bajo ${UMBRAL}%`,
        sinRegistro > 0 && `${fmt.numero(sinRegistro)} sin asistencia registrada`,
    ]
        .filter(Boolean)
        .join(' · ');
    const resumen =
        `${lectura}, del ${fmt.fechaMedia(dias[0].fecha)} al ${fmt.fechaMedia(dias[dias.length - 1].fecha)}.` +
        (valores.length ? ` Cobertura entre ${fmt.pct(Math.min(...valores))} y ${fmt.pct(Math.max(...valores))}.` : '');
    // Series auxiliares, apiladas con la cobertura (la misma columna): la marca de los días sin cobertura y, en los días
    // al 0% (sin barra que rotular), un soporte invisible para su cifra
    const datos = dias.map((d) => ({ ...d, marca: d.cobertura === null ? MARCA : null, cero: d.cobertura === 0 ? MARCA : null }));

    return (
        <Panel
            titulo={`Cobertura de los ${dias.length} días anteriores`}
            descripcion={`Presentes frente a las personas requeridas. Completa al 100%; bajo ${UMBRAL}%, seguimiento inmediato.`}
        >
            <p className="text-sm font-semibold">{lectura}</p>
            <div className="mt-3 h-48" {...tooltip.manejadores}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datos} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} title="Cobertura por día" desc={resumen}>
                        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="fecha" tickFormatter={fmt.fechaCorta} {...ejes} minTickGap={16} />
                        <YAxis domain={[0, 100]} ticks={[0, 50, UMBRAL, 100]} tickFormatter={(v) => `${v}%`} {...ejes} axisLine={false} width={48} />
                        {/* El umbral se rotula en su marca del eje y en la descripción del panel */}
                        <ReferenceLine y={UMBRAL} stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" />
                        <Tooltip
                            active={tooltip.oculto ? false : undefined}
                            content={<TooltipCobertura />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                            wrapperStyle={{ outline: 'none' }}
                        />
                        <Bar dataKey="cobertura" stackId="dia" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={600} />
                        {/* Un 0% no tiene barra: se dice con su cifra, en la base */}
                        <Bar dataKey="cero" stackId="dia" fill="transparent" maxBarSize={32} isAnimationActive={false}>
                            <LabelList
                                dataKey="cero"
                                position="center"
                                fill="var(--chart-ink)"
                                fontSize={12}
                                fontWeight={700}
                                formatter={() => '0%'}
                            />
                        </Bar>
                        <Bar
                            dataKey="marca"
                            stackId="dia"
                            fill="var(--muted)"
                            stroke="var(--muted-foreground)"
                            strokeDasharray="2 2"
                            maxBarSize={32}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                <span className="border-muted-foreground bg-muted h-2 w-3 rounded-[2px] border border-dashed" aria-hidden="true" />
                Sin programación o sin asistencia registrada
            </p>
            <TablaGrafica
                id="tabla-cobertura"
                resumen={`Cobertura de cada día; bajo ${UMBRAL}%, seguimiento inmediato`}
                columnas={[{ texto: 'Fecha' }, { texto: 'Cobertura', numero: true, destacada: true }, { texto: 'Estado' }]}
                filas={dias.map((d) => ({
                    clave: d.fecha,
                    celdas: [
                        fmt.fechaMedia(d.fecha),
                        d.cobertura === null ? '—' : fmt.pct(d.cobertura),
                        semaforo(d.cobertura)?.texto ?? sinCobertura(d),
                    ],
                }))}
            />
        </Panel>
    );
}
