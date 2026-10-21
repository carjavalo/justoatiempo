import { claseTd, claseTh, Paginacion, Tabla } from '@/components/admin/piezas';
import { Dato, EstadoBadge as EstadoNivel, Panel, Vacio } from '@/components/dashboard/piezas';
import { PackageCheck } from '@/components/iconos';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Link } from '@inertiajs/react';

interface Jornada {
    fecha: string;
    ordenes: number;
    entregadas: number;
    devueltas: number;
    productos: number;
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

const EVIDENCIAS: Record<Exclude<Evidencias, null>, { texto: string; clase: string }> = {
    cumple: { texto: 'Protocolo completo', clase: 'text-good' },
    no_cumple: { texto: 'Protocolo incompleto', clase: 'text-warning' },
    sin_evidencia: { texto: 'Sin evidencia', clase: 'text-critical' },
    sin_imagenes: { texto: 'Sin imágenes en Drivin', clase: 'text-critical' },
    con_imagenes: { texto: 'Con imágenes, sin auditar', clase: 'text-muted-foreground' },
};

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

/**
 * Mis entregas: el historial de quien hace las rutas, jornada por jornada, con el detalle de sus órdenes y sus
 * evidencias. Se cuenta por orden (NP), como el informe diario.
 */
export default function MisEntregas({ jornadas, resumen, fecha, ordenes }: Props) {
    const nivel = semaforo(resumen?.cumplimiento ?? null);
    const jornada = jornadas.data.find((j) => j.fecha === fecha);

    return (
        <MarcoLinea slug={LINEA_LOGISTICA} titulo="Mis entregas" seccion="entregas" pestanas>
            {!resumen ? (
                <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
                    <span className="bg-secondary text-primary flex size-16 items-center justify-center rounded-2xl">
                        <PackageCheck className="size-8" aria-hidden="true" />
                    </span>
                    <h2 className="mt-5 text-lg font-extrabold tracking-tight">Aún no tienes entregas</h2>
                    <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                        Aparecen aquí cuando se carga la preliquidación de Drivin de una jornada en la que hiciste rutas.
                    </p>
                </div>
            ) : (
                <>
                    <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
                        <h2 id="titulo-resumen" className="text-muted-foreground text-sm">
                            Tus últimos 30 días: del <span className="text-foreground font-semibold">{fmt.fechaMedia(resumen.desde)}</span> al{' '}
                            <span className="text-foreground font-semibold">{fmt.fechaMedia(resumen.hasta)}</span>
                        </h2>
                        <ul role="list" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <Dato
                                titulo="Cumplimiento"
                                valor={fmt.pct(resumen.cumplimiento)}
                                detalle={nivel && <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel>}
                            />
                            <Dato
                                titulo="Entregas"
                                valor={`${fmt.numero(resumen.entregadas)} de ${fmt.numero(resumen.ordenes)}`}
                                detalle={plural(resumen.devueltas, 'devolución', 'devoluciones')}
                            />
                            <Dato
                                titulo="Jornadas"
                                valor={fmt.numero(resumen.jornadas)}
                                detalle={plural(resumen.productos, 'producto', 'productos')}
                            />
                            <Dato
                                titulo="Sin imágenes"
                                valor={fmt.numero(resumen.sinImagenes)}
                                detalle={resumen.sinImagenes ? 'Órdenes sin fotos en Drivin' : 'Todas con fotos en Drivin'}
                            />
                        </ul>
                    </section>

                    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
                        <section aria-labelledby="titulo-jornadas" className="flex flex-col gap-3">
                            <h2 id="titulo-jornadas" className="text-base font-bold">
                                Tus jornadas
                            </h2>
                            <Tabla titulo="Tus jornadas" minimo="min-w-[420px]" columnas={['38%', '30%', '32%']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Jornada
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Entregas
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Cumplimiento
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {jornadas.data.map((j) => {
                                        const elegida = j.fecha === fecha;
                                        const nivelDia = semaforo(j.cumplimiento);
                                        return (
                                            <tr key={j.fecha} className={cn('hover:bg-muted/40 transition-colors', elegida && 'bg-secondary/60')}>
                                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                    <Link
                                                        href={route('mis-entregas', {
                                                            fecha: j.fecha,
                                                            pagina: jornadas.current_page > 1 ? jornadas.current_page : undefined,
                                                        })}
                                                        preserveScroll
                                                        preserveState
                                                        aria-current={elegida ? 'true' : undefined}
                                                        className="text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                                    >
                                                        {fmt.fechaMedia(j.fecha)}
                                                    </Link>
                                                    <p className="text-muted-foreground text-xs first-letter:uppercase">{fmt.diaSemana(j.fecha)}</p>
                                                </th>
                                                <td className={cn(claseTd, 'tabular-nums')}>
                                                    <p className="font-semibold">
                                                        {fmt.numero(j.entregadas)} de {fmt.numero(j.ordenes)}
                                                    </p>
                                                    {j.sinImagenes > 0 && (
                                                        <p className="text-critical text-xs">
                                                            {plural(j.sinImagenes, 'sin imágenes', 'sin imágenes')}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className={claseTd}>
                                                    <p className="font-semibold tabular-nums">{fmt.pct(j.cumplimiento)}</p>
                                                    {nivelDia && <EstadoNivel nivel={nivelDia.nivel}>{nivelDia.texto}</EstadoNivel>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Tabla>
                            <Paginacion pagina={jornadas} nombre="jornadas" />
                        </section>

                        {fecha && (
                            <Panel
                                titulo={<span className="first-letter:uppercase">{fmt.fechaLarga(fecha)}</span>}
                                descripcion={
                                    jornada
                                        ? `${plural(jornada.entregadas, 'entrega', 'entregas')} de ${plural(jornada.ordenes, 'orden', 'órdenes')} · ${plural(jornada.productos, 'producto', 'productos')}`
                                        : plural(ordenes.length, 'orden', 'órdenes')
                                }
                                cuerpoClassName="px-0 pb-0"
                            >
                                {ordenes.length === 0 ? (
                                    <Vacio>Sin órdenes en esta jornada.</Vacio>
                                ) : (
                                    <ul role="list" aria-label="Órdenes de la jornada" className="divide-y border-t">
                                        {ordenes.map((o) => {
                                            const estado = ESTADO[o.estado];
                                            const evidencias = o.evidencias ? EVIDENCIAS[o.evidencias] : null;
                                            return (
                                                <li key={o.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-3.5">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="font-mono text-sm font-semibold">{o.codigo}</span>
                                                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clase)}>
                                                                {estado.texto}
                                                            </span>
                                                            {o.hora && <span className="text-muted-foreground text-xs tabular-nums">{o.hora}</span>}
                                                        </p>
                                                        <p className="mt-1 truncate text-sm" title={o.destinatario ?? undefined}>
                                                            {o.destinatario ?? 'Sin destinatario'}
                                                        </p>
                                                        <p
                                                            className="text-muted-foreground truncate text-xs"
                                                            title={[o.direccion, o.ciudad].filter(Boolean).join(', ')}
                                                        >
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
                                                        <p className="text-muted-foreground mt-0.5">
                                                            {[o.placa, o.lugar].filter(Boolean).join(' · ')}
                                                        </p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </Panel>
                        )}
                    </div>
                </>
            )}
        </MarcoLinea>
    );
}
