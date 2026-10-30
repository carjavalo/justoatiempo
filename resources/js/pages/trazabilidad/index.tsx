import { BarraFiltros, CampoBusqueda, useFiltros } from '@/components/admin/filtros';
import { SinResultados } from '@/components/admin/piezas';
import { Panel } from '@/components/dashboard/piezas';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSpreadsheet, PackageCheck, type TipoIcono, Truck, UploadCloud, XCircle } from '@/components/iconos';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

type Tono = 'neutro' | 'bien' | 'alerta' | 'mal';

interface Evento {
    etapa: 'operacion' | 'entrega' | 'novedad' | 'importacion' | 'evidencia' | 'auditoria' | 'informe' | 'anulacion';
    titulo: string;
    detalle: string;
    responsable: string | null;
    tono: Tono;
    fecha: string;
    hora: string | null;
}

interface Resultado {
    codigo: string;
    jornadas: number;
    ultima: string;
    destinatario: string | null;
    placa: string | null;
    auxiliar: string | null;
}

interface Props {
    filtros: { q: string };
    resultados: Resultado[];
    limite: number;
    traza: {
        codigo: string;
        resumen: { destinatario: string | null; direccion: string | null; ciudad: string | null; estado: string; jornadas: number; productos: string[] } | null;
        eventos: Evento[];
    } | null;
}

const ICONO: Record<Evento['etapa'], TipoIcono> = {
    operacion: Truck,
    entrega: PackageCheck,
    novedad: AlertTriangle,
    importacion: UploadCloud,
    evidencia: UploadCloud,
    auditoria: ClipboardCheck,
    informe: FileSpreadsheet,
    anulacion: XCircle,
};

const COLOR: Record<Tono, string> = {
    neutro: 'bg-secondary text-primary',
    bien: 'bg-good-soft text-good',
    alerta: 'bg-warning-soft text-warning',
    mal: 'bg-critical-soft text-critical',
};

/**
 * Trazabilidad: el recorrido de una orden con lo que la plataforma registra de ella. Cada paso dice qué pasó, cuándo y
 * quién fue el responsable.
 */
export default function Trazabilidad({ filtros, resultados, limite, traza }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('trazabilidad.index'), filtros);

    return (
        <MarcoLinea slug={LINEA_LOGISTICA} titulo={traza ? `Trazabilidad ${traza.codigo}` : 'Trazabilidad'} seccion="trazabilidad" pestanas>
            <p className="text-muted-foreground -mt-2 max-w-3xl text-sm">
                Busca una orden para ver su recorrido: la jornada, la entrega, las novedades, la importación, las evidencias y la auditoría, con la fecha, la hora y el
                responsable de cada paso.
            </p>

            <BarraFiltros
                resumen={resultados.length ? `${resultados.length} ${resultados.length === 1 ? 'orden' : 'órdenes'}` : ''}
                soloAnunciar={resultados.length === 0}
                activos={activos}
                onLimpiar={limpiar}
                idBusqueda="buscar-orden"
            >
                <CampoBusqueda
                    id="buscar-orden"
                    etiqueta="Buscar una orden"
                    placeholder="Código de la orden, destinatario, placa, auxiliar o cédula"
                    valor={valores.q}
                    onCambio={(v) => cambiar('q', v, { inmediato: false })}
                />
            </BarraFiltros>

            {filtros.q && !traza && resultados.length === 0 && <SinResultados texto="Ninguna orden coincide con la búsqueda." />}

            {resultados.length > 1 && (
                <Panel
                    titulo="Órdenes encontradas"
                    descripcion={resultados.length >= limite ? `Se muestran las ${limite} más recientes: escribe algo más específico para encontrar otra.` : 'Elige una para ver su recorrido.'}
                >
                    <ul role="list" className="divide-y">
                        {resultados.map((r) => (
                            <li key={r.codigo}>
                                <Link
                                    href={route('trazabilidad.index', { q: filtros.q, codigo: r.codigo })}
                                    preserveScroll
                                    aria-current={traza?.codigo === r.codigo ? 'true' : undefined}
                                    className={cn(
                                        'hover:bg-muted/50 focus-visible:ring-ring flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-hidden',
                                        traza?.codigo === r.codigo && 'bg-secondary/60',
                                    )}
                                >
                                    <span className="font-mono font-bold">{r.codigo}</span>
                                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                                        {[r.destinatario, r.placa, r.auxiliar].filter(Boolean).join(' · ')}
                                    </span>
                                    <span className="text-muted-foreground text-xs whitespace-nowrap">{fmt.fechaCorta(r.ultima)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            {traza && (
                <Panel titulo={`Recorrido de la orden ${traza.codigo}`} descripcion={traza.resumen ? descripcion(traza.resumen) : 'Esta orden ya no está en la plataforma: su carga se anuló.'}>
                    {traza.resumen && traza.resumen.productos.length > 0 && (
                        <p className="text-muted-foreground mb-4 text-xs">
                            <span className="text-foreground font-semibold">Productos: </span>
                            {traza.resumen.productos.join(', ')}
                        </p>
                    )}
                    <ol role="list" className="relative grid gap-4">
                        {traza.eventos.map((e, i) => {
                            const Icono = e.tono === 'bien' ? CheckCircle2 : ICONO[e.etapa];
                            return (
                                <li key={i} className="flex gap-3">
                                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', COLOR[e.tono])}>
                                        <Icono className="size-4" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1 border-b pb-4 last:border-b-0">
                                        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                                            <span className="font-bold">{e.titulo}</span>
                                            <time dateTime={e.fecha} className="text-muted-foreground text-xs whitespace-nowrap first-letter:uppercase">
                                                {fmt.fechaMedia(e.fecha)}
                                                {e.hora && ` · ${e.hora}`}
                                            </time>
                                        </p>
                                        {e.detalle && <p className="text-muted-foreground mt-0.5 text-sm break-words">{e.detalle}</p>}
                                        {e.responsable && (
                                            <p className="mt-0.5 text-xs">
                                                <span className="text-muted-foreground">Responsable: </span>
                                                <span className="font-semibold">{e.responsable}</span>
                                            </p>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </Panel>
            )}
        </MarcoLinea>
    );
}

function descripcion(r: NonNullable<Props['traza']>['resumen'] & object): string {
    const partes = [r.destinatario, [r.direccion, r.ciudad].filter(Boolean).join(', '), `Estado: ${r.estado}`];
    if (r.jornadas > 1) partes.push(`${r.jornadas} jornadas`);
    return partes.filter(Boolean).join(' · ');
}
