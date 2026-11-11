import { BarraFiltros, CampoBusqueda, FiltroLista, POCOS_PARA_FILTRAR, useFiltros } from '@/components/admin/filtros';
import { Paginacion, SinResultados } from '@/components/admin/piezas';
import { Cifra, Cifras, EstadoCargaBadge, ListaAdvertencias, Pasos, TablaErrores, type Advertencia, type ErrorFila, type EstadoCarga } from '@/components/cargas/piezas';
import { BarraProgreso, Panel } from '@/components/dashboard/piezas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Link, router } from '@inertiajs/react';
import { AlertTriangle, Ban, CheckCircle2, FileSpreadsheet, type TipoIcono, Undo2, XCircle } from '@/components/iconos';
import { useState } from 'react';

interface Informe {
    id: number;
    fecha: string;
    sede: string | null;
    sucursal: string | null;
    estado: string;
    estadoLabel: string;
    asignadas: number;
    aprobadas: number;
    efectividad: number;
}

type EstadoOrden = 'aprobada' | 'rechazada' | 'pendiente';

interface Orden {
    id: number;
    /** El código de Drivin: la nota (NP) de la orden. */
    codigo: string;
    fecha: string;
    destinatario: string | null;
    ciudad: string | null;
    placa: string | null;
    auxiliar: string | null;
    estado: EstadoOrden;
    estadoLabel: string;
    productos: number;
    entregados: number;
    novedad: string | null;
}

interface Props {
    carga: {
        id: number;
        archivo: string;
        estado: EstadoCarga;
        estadoLabel: string;
        usuario: string | null;
        fechaOperacion: string | null;
        hoja: string | null;
        filas: number;
        filasError: number;
        ordenes: number;
        duracionMs: number | null;
        procesada: string | null;
        anuladaPor: string | null;
        anulada: string | null;
    };
    /**
     * Lo que mostró la revisión al importar. No se muestra: su efectividad se contaba por orden y la del informe (la que
     * vale) por producto; la de cada informe ya está en su fila.
     */
    totales: { efectividad: number } | null;
    advertencias: Advertencia[];
    errores: ErrorFila[];
    informes: Informe[];
    puedeAnular: boolean;
    /** Las órdenes que trajo, también las retiradas si se anuló. */
    ordenes: Paginado<Orden>;
    filtrosOrdenes: { q: string; estado: string };
    /** Si puede abrir el recorrido de cada orden (trazabilidad). */
    verRecorrido: boolean;
}

const fechaHora = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

export default function Resultado({ carga, advertencias, errores, informes, puedeAnular, ordenes, filtrosOrdenes, verRecorrido }: Props) {
    const anulada = carga.estado === 'anulada';
    const [anulando, setAnulando] = useState(false);

    return (
        <MarcoLinea slug={LINEA_LOGISTICA} titulo={carga.archivo} seccion="cargas" paginaDeLaPestana={false} pestanas>
                <header className="flex flex-col gap-3">
                    {!anulada && <Pasos actual={4} />}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight break-all sm:text-2xl md:text-[1.6rem]">
                                <FileSpreadsheet className="text-primary size-6 shrink-0" aria-hidden="true" />
                                {carga.archivo}
                            </h2>
                            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                                <EstadoCargaBadge estado={carga.estado} texto={carga.estadoLabel} />
                                {carga.procesada && (
                                    <span>
                                        {fechaHora.format(new Date(carga.procesada))}
                                        {carga.usuario && <> · {carga.usuario}</>}
                                    </span>
                                )}
                            </p>
                        </div>

                        {puedeAnular && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="text-critical hover:bg-critical-soft hover:text-critical rounded-lg font-semibold">
                                        <Undo2 className="size-4" aria-hidden="true" />
                                        Anular carga
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogTitle>¿Anular esta carga?</DialogTitle>
                                    <DialogDescription>
                                        Se retiran sus {fmt.numero(carga.ordenes)} órdenes y se recalculan los informes diarios afectados. Úsalo si subiste el archivo equivocado; después
                                        podrás subir el correcto.
                                    </DialogDescription>
                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button variant="outline" className="rounded-lg">
                                                Cancelar
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            variant="destructive"
                                            className="rounded-lg"
                                            disabled={anulando}
                                            onClick={() => router.post(`/cargas/${carga.id}/anular`, {}, { onStart: () => setAnulando(true), onFinish: () => setAnulando(false) })}
                                        >
                                            Sí, anular
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </header>

                {anulada && (
                    <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-xl p-4 text-sm">
                        <Ban className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <p>
                            Esta carga se anuló{carga.anulada && <> el {fechaHora.format(new Date(carga.anulada))}</>}
                            {carga.anuladaPor && <> por {carga.anuladaPor}</>}. Sus órdenes ya no forman parte de los informes.
                        </p>
                    </div>
                )}

                <Cifras columnas={3}>
                    <Cifra
                        etiqueta={anulada ? 'Órdenes retiradas' : 'Órdenes importadas'}
                        valor={fmt.numero(carga.ordenes)}
                        detalle={`de ${fmt.numero(carga.filas)} filas del archivo`}
                        enlace={ordenes.total > 0 ? { href: '#ordenes', texto: 'Ver cuáles' } : undefined}
                    />
                    <Cifra etiqueta="Jornada" valor={<span className="text-lg">{carga.fechaOperacion ? fmt.fechaMedia(carga.fechaOperacion) : '—'}</span>} detalle={carga.hoja ? `Hoja ${carga.hoja}` : undefined} />
                    <Cifra
                        etiqueta="Filas omitidas"
                        valor={fmt.numero(carga.filasError)}
                        tono={carga.filasError ? 'warning' : 'good'}
                        detalle={carga.filasError ? undefined : 'Ninguna'}
                        enlace={carga.filasError ? { href: '#filas-error', texto: 'Ver cuáles' } : undefined}
                    />
                </Cifras>

                {!anulada && (
                    <Panel titulo="Informes diarios actualizados" descripcion="Quedan en borrador hasta auditar las evidencias y cerrarlos." cuerpoClassName="px-0 pb-2">
                        {informes.length === 0 ? (
                            <p className="text-muted-foreground px-5 pb-4 text-sm">Esta carga no generó informes.</p>
                        ) : (
                            <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label="Informes diarios actualizados, desplazable">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <caption className="sr-only">Informes diarios actualizados por esta carga</caption>
                                    <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                                        <tr>
                                            <th scope="col" className="py-2.5 pl-5 font-semibold">
                                                Sede · sucursal
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                                Fecha
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                                Entregas
                                            </th>
                                            <th scope="col" className="w-52 px-3 py-2.5 font-semibold">
                                                Efectividad
                                            </th>
                                            <th scope="col" className="py-2.5 pr-5 pl-3 font-semibold">
                                                Estado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {informes.map((i) => (
                                            <tr key={i.id}>
                                                <td className="py-3 pl-5 font-semibold">
                                                    {i.sede} <span className="text-muted-foreground font-normal">· {i.sucursal ?? 'Sin sucursal'}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">{fmt.fechaMedia(i.fecha)}</td>
                                                <td className="tabular px-3 py-3 text-right">
                                                    <span className="font-semibold">{i.aprobadas}</span>
                                                    <span className="text-muted-foreground"> / {i.asignadas}</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <BarraProgreso valor={i.efectividad} etiqueta={`Efectividad ${i.sede} ${i.sucursal ?? ''}`} className="h-1.5 flex-1" />
                                                        <span className="tabular w-14 text-right text-xs font-bold">{fmt.pct(i.efectividad)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-muted-foreground py-3 pr-5 pl-3 text-xs">{i.estadoLabel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                )}

                {(ordenes.total > 0 || filtrosOrdenes.q || filtrosOrdenes.estado) && (
                    <OrdenesDeLaCarga carga={carga} anulada={anulada} ordenes={ordenes} filtros={filtrosOrdenes} verRecorrido={verRecorrido} />
                )}

                <div id="filas-error" className="scroll-mt-24 empty:hidden">
                    <TablaErrores errores={errores} total={errores.length} titulo="Filas que no se importaron" />
                </div>
                {!anulada && <ListaAdvertencias advertencias={advertencias} />}
        </MarcoLinea>
    );
}

const ESTADO: Record<EstadoOrden, { icono: TipoIcono; clase: string }> = {
    aprobada: { icono: CheckCircle2, clase: 'bg-good-soft text-good' },
    rechazada: { icono: XCircle, clase: 'bg-critical-soft text-critical' },
    pendiente: { icono: AlertTriangle, clase: 'bg-warning-soft text-warning' },
};

/**
 * Las órdenes de la carga con su nota, para encontrar una y abrir su recorrido. Las de una carga anulada siguen aquí:
 * se retiraron de los informes, no de la plataforma.
 */
function OrdenesDeLaCarga({
    carga,
    anulada,
    ordenes,
    filtros,
    verRecorrido,
}: {
    carga: Props['carga'];
    anulada: boolean;
    ordenes: Paginado<Orden>;
    filtros: Props['filtrosOrdenes'];
    verRecorrido: boolean;
}) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('cargas.show', carga.id), filtros);
    // Con pocas órdenes se ven todas: los filtros solo estorban
    const conFiltros = carga.ordenes > POCOS_PARA_FILTRAR || activos;

    return (
        <div id="ordenes" className="scroll-mt-24">
            <Panel
                titulo={anulada ? 'Órdenes retiradas' : 'Órdenes de esta carga'}
                descripcion={
                    anulada
                        ? 'Ya no cuentan en los informes; quedan aquí para consultarlas.'
                        : verRecorrido
                          ? 'Cada una con su nota de Drivin. Abre una para ver su recorrido.'
                          : 'Cada una con su nota de Drivin.'
                }
                cuerpoClassName="px-0 pb-2"
            >
                {conFiltros && (
                    <div className="px-5 pb-4">
                        <BarraFiltros
                            resumen={`${fmt.numero(ordenes.total)} ${ordenes.total === 1 ? 'orden' : 'órdenes'}`}
                            soloAnunciar={ordenes.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-orden-carga"
                        >
                            <CampoBusqueda
                                id="buscar-orden-carga"
                                etiqueta="Buscar una orden de esta carga"
                                placeholder="Nota, destinatario, ciudad, placa o auxiliar"
                                valor={valores.q}
                                onCambio={(v) => cambiar('q', v, { inmediato: false })}
                            />
                            <FiltroLista
                                id="filtro-estado-orden"
                                etiqueta="Estado de la orden"
                                valor={valores.estado}
                                onCambio={(v) => cambiar('estado', v)}
                                opciones={[
                                    { valor: '', texto: 'Todos los estados' },
                                    { valor: 'aprobada', texto: 'Aprobadas' },
                                    { valor: 'rechazada', texto: 'Rechazadas' },
                                    { valor: 'pendiente', texto: 'Pendientes' },
                                ]}
                            />
                        </BarraFiltros>
                    </div>
                )}

                {ordenes.data.length === 0 ? (
                    <div className="px-5 pb-4">
                        <SinResultados texto="Ninguna orden de esta carga coincide con la búsqueda." />
                    </div>
                ) : (
                    <ul role="list" className="divide-y border-t">
                        {ordenes.data.map((o) => {
                            const { icono: Icono, clase } = ESTADO[o.estado];
                            const datos = [o.destinatario, o.ciudad, o.placa, o.auxiliar].filter(Boolean).join(' · ');
                            const otraFecha = o.fecha !== carga.fechaOperacion;
                            const contenido = (
                                <>
                                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="font-mono font-bold">{o.codigo}</span>
                                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', clase)}>
                                            <Icono className="size-3.5" aria-hidden="true" />
                                            {o.estadoLabel}
                                        </span>
                                        {o.novedad && <span className="text-warning text-xs font-semibold">{o.novedad}</span>}
                                        <span className="text-muted-foreground tabular ml-auto text-xs whitespace-nowrap">
                                            {o.entregados} de {o.productos} {o.productos === 1 ? 'producto' : 'productos'}
                                            {otraFecha && <> · {fmt.fechaCorta(o.fecha)}</>}
                                        </span>
                                    </span>
                                    {datos && <span className="text-muted-foreground mt-0.5 block truncate text-xs">{datos}</span>}
                                </>
                            );
                            const clases = 'block px-5 py-3 text-sm';
                            return (
                                <li key={o.id}>
                                    {verRecorrido ? (
                                        <Link
                                            href={route('trazabilidad.index', { q: o.codigo })}
                                            className={cn(clases, 'hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset')}
                                        >
                                            {contenido}
                                        </Link>
                                    ) : (
                                        <div className={clases}>{contenido}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {ordenes.last_page > 1 && (
                    <div className="border-t px-5 pt-3">
                        <Paginacion pagina={ordenes} nombre="las órdenes de esta carga" />
                    </div>
                )}
            </Panel>
        </div>
    );
}
