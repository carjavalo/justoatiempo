import { useInitials } from '@/hooks/use-initials';
import { fmt, nivelFrenteAMeta } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Award, MessageCircle, Search, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarraProgreso, EstadoBadge, Panel, Vacio } from './piezas';
import { type FilaRanking } from './tipos';

type Columna = 'efectividad' | 'pod' | 'asignadas' | 'nombre';

const VISIBLES = 8;

function Encabezado({
    columna,
    orden,
    onOrden,
    children,
    className,
}: {
    columna: Columna;
    orden: { col: Columna; asc: boolean };
    onOrden: (c: Columna) => void;
    children: React.ReactNode;
    className?: string;
}) {
    const activo = orden.col === columna;
    const Flecha = orden.asc ? ArrowUp : ArrowDown;
    return (
        <th scope="col" className={cn('px-3 py-2.5 font-semibold', className)} aria-sort={activo ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
            <button
                type="button"
                onClick={() => onOrden(columna)}
                className={cn('hover:text-foreground inline-flex items-center gap-1 transition-colors', activo && 'text-foreground')}
            >
                {children}
                <Flecha className={cn('size-3', activo ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
            </button>
        </th>
    );
}

/** Ranking de cumplimiento por auxiliar (SRS 4.1) con acciones de desempeño del periodo (RF-11). */
export function RankingAuxiliares({ filas, meta, titulo = 'Ranking de auxiliares' }: { filas: FilaRanking[]; meta: number; titulo?: string }) {
    const iniciales = useInitials();
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({ col: 'efectividad', asc: false });
    const [todos, setTodos] = useState(false);

    const ordenadas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const filtradas = q ? filas.filter((f) => f.nombre.toLowerCase().includes(q) || f.cedula.includes(q)) : filas;
        return [...filtradas].sort((a, b) => {
            const va = a[orden.col] ?? -1;
            const vb = b[orden.col] ?? -1;
            const r = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
            return orden.asc ? r : -r;
        });
    }, [filas, busqueda, orden]);

    const mostradas = todos ? ordenadas : ordenadas.slice(0, VISIBLES);
    const cambiarOrden = (col: Columna) => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === 'nombre' }));

    return (
        <Panel
            titulo={titulo}
            descripcion="Efectividad, cumplimiento del protocolo POD y acciones registradas en el periodo"
            cuerpoClassName="px-0 pb-2"
            acciones={
                filas.length > 1 && (
                    <label className="bg-muted/70 focus-within:ring-ring flex h-8 items-center gap-2 rounded-lg border px-2.5 focus-within:ring-2">
                        <Search className="text-muted-foreground size-3.5" aria-hidden="true" />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar auxiliar o cédula"
                            className="placeholder:text-muted-foreground w-40 bg-transparent text-xs outline-none"
                        />
                    </label>
                )
            }
        >
            {filas.length === 0 ? (
                <div className="px-5 pb-3">
                    <Vacio>Sin entregas asignadas en el periodo.</Vacio>
                </div>
            ) : (
                <>
                    <div className="relative overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left text-sm">
                            <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                                <tr>
                                    <th scope="col" className="w-10 py-2.5 pl-5 font-semibold">
                                        #
                                    </th>
                                    <Encabezado columna="nombre" orden={orden} onOrden={cambiarOrden}>
                                        Auxiliar
                                    </Encabezado>
                                    <Encabezado columna="asignadas" orden={orden} onOrden={cambiarOrden} className="text-right">
                                        Entregas
                                    </Encabezado>
                                    <Encabezado columna="efectividad" orden={orden} onOrden={cambiarOrden} className="w-[28%]">
                                        Efectividad
                                    </Encabezado>
                                    <Encabezado columna="pod" orden={orden} onOrden={cambiarOrden} className="text-right">
                                        POD
                                    </Encabezado>
                                    <th scope="col" className="px-3 py-2.5 font-semibold">
                                        Acciones
                                    </th>
                                    <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold">
                                        Estado
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {mostradas.map((f, i) => {
                                    const nivel = nivelFrenteAMeta(f.efectividad, meta)!;
                                    const puesto = orden.col === 'efectividad' && !orden.asc && !busqueda ? i + 1 : null;
                                    return (
                                        <tr key={f.id} className="hover:bg-muted/40 transition-colors">
                                            <td className="text-muted-foreground tabular py-3 pl-5 text-xs font-bold">
                                                {puesto && puesto <= 3 ? (
                                                    <span
                                                        className={cn(
                                                            'flex size-6 items-center justify-center rounded-full text-[0.7rem]',
                                                            puesto === 1 ? 'bg-brand-coral text-white' : 'bg-secondary text-secondary-foreground',
                                                        )}
                                                    >
                                                        {puesto}
                                                    </span>
                                                ) : (
                                                    <span className="pl-1.5">{puesto ?? '·'}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-secondary text-primary flex size-8 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-bold">
                                                        {iniciales(f.nombre)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold">{f.nombre}</p>
                                                        <p className="text-muted-foreground tabular text-xs whitespace-nowrap">
                                                            C.C. {f.cedula} · {f.jornadas} {f.jornadas === 1 ? 'jornada' : 'jornadas'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="tabular px-3 py-3 text-right">
                                                <span className="font-semibold">{fmt.numero(f.aprobadas)}</span>
                                                <span className="text-muted-foreground"> / {fmt.numero(f.asignadas)}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <BarraProgreso valor={f.efectividad} meta={meta} etiqueta={`Efectividad de ${f.nombre}`} className="h-1.5 min-w-28 flex-1" />
                                                    <span className="tabular w-14 shrink-0 text-right font-bold">{fmt.pct(f.efectividad)}</span>
                                                </div>
                                            </td>
                                            <td className="tabular px-3 py-3 text-right font-semibold">
                                                {fmt.pct(f.pod)}
                                                {f.sinEvidencia > 0 && (
                                                    <p className="text-muted-foreground text-[0.7rem] font-medium whitespace-nowrap">
                                                        <span className="text-critical font-bold">{f.sinEvidencia}</span> sin evidencia
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2.5 text-xs font-semibold">
                                                    <span className={cn('flex items-center gap-1', !f.felicitaciones && 'opacity-30')} title="Felicitaciones">
                                                        <Award className="text-good size-3.5" aria-hidden="true" />
                                                        <span className="sr-only">Felicitaciones:</span>
                                                        {f.felicitaciones}
                                                    </span>
                                                    <span className={cn('flex items-center gap-1', !f.retroalimentaciones && 'opacity-30')} title="Retroalimentaciones">
                                                        <MessageCircle className="text-warning size-3.5" aria-hidden="true" />
                                                        <span className="sr-only">Retroalimentaciones:</span>
                                                        {f.retroalimentaciones}
                                                    </span>
                                                    <span className={cn('flex items-center gap-1', !f.llamados && 'opacity-30')} title="Llamados de atención">
                                                        <ShieldAlert className="text-critical size-3.5" aria-hidden="true" />
                                                        <span className="sr-only">Llamados de atención:</span>
                                                        {f.llamados}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-5 pl-3 text-right">
                                                <EstadoBadge nivel={nivel}>{nivel === 'good' ? 'En meta' : nivel === 'warning' ? 'Cerca' : 'Bajo meta'}</EstadoBadge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {ordenadas.length === 0 && <p className="text-muted-foreground px-5 py-6 text-center text-sm">Ningún auxiliar coincide con “{busqueda}”.</p>}
                    {ordenadas.length > VISIBLES && (
                        <div className="border-t px-5 pt-2">
                            <button type="button" onClick={() => setTodos((t) => !t)} className="text-primary text-xs font-semibold hover:underline">
                                {todos ? 'Ver menos' : `Ver los ${ordenadas.length} auxiliares`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </Panel>
    );
}
