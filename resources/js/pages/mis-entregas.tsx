import { Paginacion } from '@/components/admin/piezas';
import { Cifra, Cifras } from '@/components/cargas/piezas';
import { EstadoBadge as EstadoNivel, Panel, Vacio } from '@/components/dashboard/piezas';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Link } from '@inertiajs/react';

/** Las entregas se cuentan por producto; las órdenes son las paradas en que iban. */
interface Jornada {
    fecha: string;
    ordenes: number;
    entregas: number;
    realizadas: number;
    devoluciones: number;
    sinImagenes: number;
    cumplimiento: number;
}

type Evidencias = 'cumple' | 'no_cumple' | 'sin_evidencia' | 'sin_imagenes' | 'con_imagenes' | null;

interface Orden {
    id: number;
    codigo: string;
    destinatario: string | null;
    direccion: string | null;
    ciudad: string | null;
    lugar: string;
    ruta: string | null;
    placa: string | null;
    estado: 'aprobada' | 'rechazada' | 'pendiente';
    motivo: string | null;
    productos: number;
    productosEntregados: number;
    hora: string | null;
    evidencias: Evidencias;
}

interface Props {
    jornadas: Paginado<Jornada>;
    /** Los 30 días hasta su última jornada (null si aún no tiene entregas). */
    resumen: (Omit<Jornada, 'fecha'> & { desde: string; hasta: string; jornadas: number }) | null;
    fecha: string | null;
    ordenes: Orden[];
}

const ESTADO: Record<Orden['estado'], { texto: string; clase: string }> = {
    aprobada: { texto: 'Entregada', clase: 'bg-good-soft text-good' },
    rechazada: { texto: 'Devuelta', clase: 'bg-critical-soft text-critical' },
    pendiente: { texto: 'Pendiente', clase: 'bg-warning-soft text-warning' },
};

/** Solo lo que dice algo: con fotos y sin auditar es lo normal y no se marca. */
const EVIDENCIAS: Partial<Record<Exclude<Evidencias, null>, { texto: string; clase: string }>> = {
    cumple: { texto: 'Protocolo completo', clase: 'text-good' },
    no_cumple: { texto: 'Protocolo incompleto', clase: 'text-warning' },
    sin_evidencia: { texto: 'Sin evidencia', clase: 'text-critical' },
    sin_imagenes: { texto: 'Sin fotos en Drivin', clase: 'text-critical' },
};

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

/** La escala del Excel (100 % / 80 %), con palabras para quien hizo las entregas, no para su supervisor. */
function paraTi(cumplimiento: number) {
    const s = semaforo(cumplimiento)!;
    return {
        nivel: s.nivel,
        texto: cumplimiento >= 100 ? 'Todo entregado' : cumplimiento >= 80 ? 'Quedó algo pendiente' : 'Por debajo del 80 %',
    };
}

const TONO = { good: 'good', warning: 'warning', critical: 'critical' } as const;

/** El valor que comparten todas las órdenes de la jornada (la ruta, la placa, el lugar), o null si cambia. */
function comun(valores: (string | null)[]): string | null {
    const distintos = [...new Set(valores.filter((v): v is string => Boolean(v)))];
    return distintos.length === 1 && valores.every(Boolean) ? distintos[0] : null;
}

/**
 * Mis entregas: el historial de quien hace las rutas, jornada por jornada, con el detalle de sus órdenes y sus
 * evidencias. Las entregas se cuentan por producto, como el informe diario.
 */
export default function MisEntregas({ jornadas, resumen, fecha, ordenes }: Props) {
    const general = resumen ? paraTi(resumen.cumplimiento) : null;

    // Lo que es igual en toda la jornada va arriba del detalle, una vez; en cada orden, solo si cambia
    const ruta = comun(ordenes.map((o) => o.ruta));
    const placa = comun(ordenes.map((o) => o.placa));
    const lugar = comun(ordenes.map((o) => o.lugar));

    // En el teléfono el detalle queda debajo de la lista: al elegir una jornada, se lleva la vista hasta él
    const irAlDetalle = () => {
        if (window.matchMedia('(min-width: 1280px)').matches) return;
        // Después de que se pinta la jornada elegida (si no, la vista se queda a medio camino)
        window.setTimeout(() => document.getElementById('detalle-jornada')?.scrollIntoView({ block: 'start' }), 60);
    };

    return (
        <MarcoLinea slug={LINEA_LOGISTICA} titulo="Mis entregas" seccion="entregas" pestanas>
            {!resumen || !general ? (
                <div className="bg-card rounded-2xl border border-dashed px-6 py-12 text-center">
                    <h2 className="text-lg font-extrabold tracking-tight">Aún no tienes entregas</h2>
                    <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm text-pretty">
                        Aparecen aquí cuando se carga la preliquidación de Drivin de una jornada en la que hiciste rutas.
                    </p>
                </div>
            ) : (
                <>
                    <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
                        <h2 id="titulo-resumen" className="text-muted-foreground text-sm text-pretty">
                            Tus últimos 30 días: del <span className="text-foreground font-semibold">{fmt.fechaMedia(resumen.desde)}</span> al{' '}
                            <span className="text-foreground font-semibold">{fmt.fechaMedia(resumen.hasta)}</span>
                        </h2>
                        <Cifras>
                            <Cifra etiqueta="Efectividad" valor={fmt.pct(resumen.cumplimiento)} tono={TONO[general.nivel]} detalle={general.texto} />
                            <Cifra
                                etiqueta="Entregas"
                                valor={`${fmt.numero(resumen.realizadas)} de ${fmt.numero(resumen.entregas)}`}
                                detalle={resumen.devoluciones ? plural(resumen.devoluciones, 'devolución', 'devoluciones') : 'Sin devoluciones'}
                            />
                            <Cifra etiqueta="Jornadas" valor={fmt.numero(resumen.jornadas)} detalle={plural(resumen.ordenes, 'orden', 'órdenes')} />
                            <Cifra
                                etiqueta="Órdenes sin fotos"
                                valor={fmt.numero(resumen.sinImagenes)}
                                tono={resumen.sinImagenes ? 'critical' : undefined}
                                detalle={resumen.sinImagenes ? 'En Drivin' : 'Todas tienen fotos en Drivin'}
                            />
                        </Cifras>
                    </section>

                    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
                        <section aria-labelledby="titulo-jornadas" className="flex flex-col gap-3">
                            <h2 id="titulo-jornadas" className="text-base font-bold">
                                Tus jornadas
                            </h2>
                            {/* Una lista (no una tabla): cada jornada se elige entera y nada se desliza de lado */}
                            <ul role="list" className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                                {jornadas.data.map((j) => {
                                    const elegida = j.fecha === fecha;
                                    const n = paraTi(j.cumplimiento);
                                    return (
                                        <li key={j.fecha}>
                                            <Link
                                                href={route('mis-entregas', {
                                                    fecha: j.fecha,
                                                    pagina: jornadas.current_page > 1 ? jornadas.current_page : undefined,
                                                })}
                                                preserveScroll
                                                preserveState
                                                onSuccess={irAlDetalle}
                                                aria-current={elegida ? 'true' : undefined}
                                                className={cn(
                                                    'focus-visible:ring-ring flex items-center justify-between gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset sm:px-5',
                                                    elegida
                                                        ? 'bg-secondary dark:ring-primary/40 dark:bg-background dark:ring-1 dark:ring-inset'
                                                        : 'hover:bg-muted/40',
                                                )}
                                            >
                                                <span className="min-w-0">
                                                    <span className="block font-semibold">
                                                        <span className="first-letter:uppercase">{fmt.diaSemana(j.fecha)}</span>{' '}
                                                        {fmt.fechaMedia(j.fecha)}
                                                    </span>
                                                    <span className="text-muted-foreground block text-xs tabular-nums">
                                                        {fmt.numero(j.realizadas)} de {plural(j.entregas, 'entrega', 'entregas')}
                                                        {j.sinImagenes > 0 && (
                                                            <span className="text-critical">
                                                                {' '}
                                                                · {plural(j.sinImagenes, 'sin fotos', 'sin fotos')}
                                                            </span>
                                                        )}
                                                    </span>
                                                </span>
                                                <EstadoNivel nivel={n.nivel}>
                                                    {fmt.pct(j.cumplimiento)}
                                                    <span className="sr-only">: {n.texto}</span>
                                                </EstadoNivel>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                            <Paginacion pagina={jornadas} nombre="jornadas" />
                        </section>

                        {fecha && (
                            <div id="detalle-jornada" className="scroll-mt-4">
                                <Panel
                                    titulo={<span className="first-letter:uppercase">{fmt.fechaLarga(fecha)}</span>}
                                    descripcion={[ruta, placa && `Placa ${placa}`, lugar, plural(ordenes.length, 'orden', 'órdenes')]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    cuerpoClassName="px-0 pb-0"
                                >
                                    {ordenes.length === 0 ? (
                                        <div className="px-5 pb-5">
                                            <Vacio>Sin órdenes en esta jornada.</Vacio>
                                        </div>
                                    ) : (
                                        <ul role="list" aria-label="Órdenes de la jornada" className="divide-y border-t">
                                            {ordenes.map((o) => {
                                                const estado = ESTADO[o.estado];
                                                const evidencias = o.evidencias ? EVIDENCIAS[o.evidencias] : undefined;
                                                // Solo lo que no comparte con las demás órdenes del día
                                                const propio = [!ruta && o.ruta, !placa && o.placa, !lugar && o.lugar].filter(Boolean).join(' · ');
                                                return (
                                                    <li key={o.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-3.5">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                <span className="font-mono text-sm font-semibold">{o.codigo}</span>
                                                                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clase)}>
                                                                    {estado.texto}
                                                                </span>
                                                                {o.hora && (
                                                                    <span className="text-muted-foreground text-xs tabular-nums">{o.hora}</span>
                                                                )}
                                                            </p>
                                                            <p className="mt-1 text-sm break-words">{o.destinatario ?? 'Sin destinatario'}</p>
                                                            <p className="text-muted-foreground text-xs break-words">
                                                                {[o.direccion, o.ciudad].filter(Boolean).join(', ') || 'Sin dirección'}
                                                            </p>
                                                            {o.motivo && <p className="text-critical mt-1 text-xs">Motivo: {o.motivo}</p>}
                                                        </div>
                                                        <div className="text-right text-xs">
                                                            <p className="font-semibold tabular-nums">
                                                                {o.estado === 'aprobada' && o.productosEntregados !== o.productos
                                                                    ? `${o.productosEntregados} de ${plural(o.productos, 'producto', 'productos')}`
                                                                    : plural(o.productos, 'producto', 'productos')}
                                                            </p>
                                                            {evidencias && (
                                                                <p className={cn('mt-0.5 font-medium', evidencias.clase)}>{evidencias.texto}</p>
                                                            )}
                                                            {propio && <p className="text-muted-foreground mt-0.5">{propio}</p>}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </Panel>
                            </div>
                        )}
                    </div>
                </>
            )}
        </MarcoLinea>
    );
}
