import { CargaLote } from '@/components/auditoria/carga-lote';
import { Cola, consultaFiltros, EstadoAuditoriaBadge } from '@/components/auditoria/cola';
import { Evidencias } from '@/components/auditoria/evidencias';
import { FormularioAuditoria } from '@/components/auditoria/formulario';
import { LecturaPdf } from '@/components/auditoria/lectura-pdf';
import { type FiltrosAuditoria, type Jornada, type OrdenCola, type OrdenDetalle, type Resumen, type TipoNovedad } from '@/components/auditoria/tipos';
import { Search } from '@/components/iconos';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { usePuede } from '@/hooks/use-puede';
import { Selector } from '@/components/selector';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

interface Props {
    filtros: FiltrosAuditoria;
    jornadas: Jornada[];
    sedes: { id: number; nombre: string }[];
    resumen: Resumen;
    ordenes: OrdenCola[];
    seleccionada: OrdenDetalle | null;
    siguiente: { id: number; codigo: string } | null;
    tiposNovedad: TipoNovedad[];
}

/** El campo de búsqueda como el de las demás listas (mismo alto que las listas desplegables). */
const claseBusqueda =
    'border-input bg-card placeholder:text-muted-foreground h-10 w-full rounded-lg border pr-3 pl-9 text-sm transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25';

export default function Auditoria({ filtros, jornadas, sedes, resumen, ordenes, seleccionada, siguiente, tiposNovedad }: Props) {
    const puede = usePuede();
    const [busqueda, setBusqueda] = useState(filtros.q ?? '');

    const filtrar = (cambios: Partial<FiltrosAuditoria>) => {
        const f = { ...filtros, ...cambios };
        router.get('/auditoria', { fecha: f.fecha, ...consultaFiltros(f) }, { preserveScroll: true, replace: true });
    };

    // Búsqueda con espera breve para no recargar en cada tecla
    useEffect(() => {
        if ((filtros.q ?? '') === busqueda) return;
        const t = window.setTimeout(() => filtrar({ q: busqueda || null }), 350);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busqueda]);

    const opcionesEstado: { valor: FiltrosAuditoria['estado']; texto: string; cuenta?: number }[] = [
        { valor: 'pendientes', texto: 'Por auditar', cuenta: resumen.pendientes },
        { valor: 'no_cumplen', texto: 'No cumplen', cuenta: resumen.noCumplen },
        // Las que no tienen archivos (por auditar o auditadas así): el mismo nombre que en la cola
        { valor: 'sin_evidencia', texto: 'Sin archivos', cuenta: resumen.sinEvidencia },
        { valor: 'auditadas', texto: 'Auditadas' },
        { valor: 'todas', texto: 'Todas' },
    ];

    const avance = resumen.aprobadas ? (resumen.auditadas / resumen.aprobadas) * 100 : 0;

    return (
        <MarcoLinea slug={LINEA_LOGISTICA} titulo={seleccionada ? `Auditoría ${seleccionada.codigo}` : 'Auditoría POD'} seccion="auditoria" pestanas>
            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                    <label htmlFor="filtro-jornada" className="text-muted-foreground text-xs font-semibold">
                        Jornada
                    </label>
                    {/* Cada jornada dice cuántas le faltan; la elegida, solo su fecha (lo suyo está en los segmentos) */}
                    <Selector
                        id="filtro-jornada"
                        valor={filtros.fecha}
                        onCambio={(v) => filtrar({ fecha: v })}
                        className="bg-card min-w-52"
                        opciones={jornadas.map((j) => ({
                            valor: j.fecha,
                            texto:
                                j.fecha === filtros.fecha
                                    ? fmt.fechaMedia(j.fecha)
                                    : `${fmt.fechaMedia(j.fecha)}${j.pendientes > 0 ? ` · ${j.pendientes} por auditar` : ' · al día'}`,
                        }))}
                    />
                </div>
                <div className="grid gap-1">
                    <label htmlFor="filtro-sede" className="text-muted-foreground text-xs font-semibold">
                        Sede
                    </label>
                    <Selector
                        id="filtro-sede"
                        valor={filtros.sede ? String(filtros.sede) : ''}
                        onCambio={(v) => filtrar({ sede: v ? Number(v) : null })}
                        className="bg-card min-w-44"
                        opciones={[{ valor: '', texto: 'Todas' }, ...sedes.map((s) => ({ valor: String(s.id), texto: s.nombre }))]}
                    />
                </div>
                <div className="grid min-w-52 flex-1 gap-1 sm:max-w-xs">
                    <label htmlFor="filtro-busqueda" className="text-muted-foreground text-xs font-semibold">
                        Buscar
                    </label>
                    <div className="relative">
                        <Search
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                            aria-hidden="true"
                        />
                        <input
                            id="filtro-busqueda"
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Código, destinatario, auxiliar o placa"
                            autoComplete="off"
                            className={claseBusqueda}
                        />
                    </div>
                </div>
            </div>

            {/* Los estados con cuántas hay (como en las demás listas) y, al lado, el avance de la jornada */}
            <div className="-mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div role="group" aria-label="Estado de la auditoría" className="bg-muted flex w-full gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit">
                    {opcionesEstado.map((o) => {
                        const activo = filtros.estado === o.valor;
                        return (
                            <button
                                key={o.valor}
                                type="button"
                                aria-pressed={activo}
                                onClick={() => !activo && filtrar({ estado: o.valor })}
                                className={cn(
                                    'focus-visible:ring-ring flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:outline-hidden',
                                    activo
                                        ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {o.texto}
                                {o.cuenta !== undefined && (
                                    <>
                                        {' '}
                                        <span className={cn('tabular-nums', activo ? 'text-foreground' : 'text-muted-foreground')}>{fmt.numero(o.cuenta)}</span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex min-w-0 items-center gap-3 text-sm lg:w-80">
                    <p className="shrink-0">
                        <span className="font-semibold">
                            {fmt.numero(resumen.auditadas)} de {fmt.numero(resumen.aprobadas)}
                        </span>{' '}
                        auditadas
                        {resumen.cumplimiento !== null && <span className="text-muted-foreground"> · {fmt.pct(resumen.cumplimiento)} cumple</span>}
                    </p>
                    <div
                        className="bg-foreground/10 h-2 min-w-16 flex-1 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label="Avance de la auditoría de la jornada"
                        aria-valuenow={Math.round(avance)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${fmt.pctEntero(avance)} auditado`}
                    >
                        <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${avance}%` }} />
                    </div>
                </div>
            </div>

            {/* Subir el lote de PDF de la jornada pide el permiso de subir evidencias */}
            {puede('auditoria.subir') && <CargaLote fecha={filtros.fecha} />}

            <div className="grid gap-5 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start">
                <div className="lg:sticky lg:top-20">
                    <Cola ordenes={ordenes} seleccionadaId={seleccionada?.id ?? null} filtros={filtros} />
                </div>

                {/* En móvil, la orden abierta va primero */}
                <div className="order-first lg:order-none">
                    {seleccionada ? (
                        <Detalle orden={seleccionada} tiposNovedad={tiposNovedad} siguiente={siguiente} filtros={filtros} />
                    ) : (
                        <div className="bg-card rounded-2xl border px-6 py-8">
                            <h2 className="text-lg font-bold text-balance">
                                {resumen.aprobadas ? 'No hay órdenes con este filtro' : 'No hay órdenes aprobadas en esta jornada'}
                            </h2>
                            <p className="text-muted-foreground mt-1 max-w-prose text-sm text-pretty">
                                {resumen.aprobadas && filtros.estado === 'pendientes'
                                    ? 'Todas las entregas de esta jornada ya están auditadas.'
                                    : 'Cambia la jornada o el filtro para ver otras órdenes.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </MarcoLinea>
    );
}

function Detalle({
    orden,
    tiposNovedad,
    siguiente,
    filtros,
}: {
    orden: OrdenDetalle;
    tiposNovedad: TipoNovedad[];
    siguiente: Props['siguiente'];
    filtros: FiltrosAuditoria;
}) {
    const estado = !orden.auditoria.auditada
        ? orden.evidencias.length
            ? 'pendiente'
            : 'pendiente_sin_archivos'
        : orden.auditoria.sin_evidencia
          ? 'sin_evidencia'
          : orden.sugerencia.cumple
            ? 'cumple'
            : 'no_cumple';

    const datos: [string, string | null][] = [
        ['Sede · sucursal', [orden.sede, orden.sucursal].filter(Boolean).join(' · ') || null],
        ['Entrega', `${fmt.fechaMedia(orden.fecha)}${orden.horaEntrega ? ` · ${orden.horaEntrega}` : ''}`],
        ['Auxiliar', orden.auxiliar],
        ['Vehículo', [orden.placa, orden.conductor].filter(Boolean).join(' · ') || null],
        ['Destinatario', orden.destinatario],
        ['Dirección', [orden.direccion, orden.ciudad].filter(Boolean).join(', ') || null],
    ];

    return (
        <article aria-labelledby="titulo-orden" className="bg-card rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                    {/* Destino del foco al pasar de una orden a otra (ver app.tsx) */}
                    <h2 id="titulo-orden" tabIndex={-1} data-foco-navegacion className="scroll-mt-24 text-xl font-bold tracking-tight outline-none">
                        <span className="text-muted-foreground text-base font-semibold">Orden </span>
                        <span className="font-mono">{orden.codigo}</span>
                    </h2>
                    {orden.ruta && <p className="text-muted-foreground mt-0.5 text-xs">{orden.ruta}</p>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                    <Link
                        href={route('trazabilidad.index', { q: orden.codigo, codigo: orden.codigo })}
                        className="text-primary focus-visible:ring-ring rounded-sm text-xs font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                    >
                        Ver su recorrido
                    </Link>
                    <EstadoAuditoriaBadge estado={estado} />
                </div>
            </header>

            <div className="grid gap-6 p-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                        {datos.map(([etiqueta, valor]) => (
                            <div key={etiqueta}>
                                <dt className="text-muted-foreground text-xs font-medium">{etiqueta}</dt>
                                <dd className="font-medium break-words">{valor ?? '—'}</dd>
                            </div>
                        ))}
                    </dl>

                    {orden.productos.length > 0 && (
                        <div>
                            <p className="text-muted-foreground text-xs font-medium">Productos</p>
                            <ul role="list" className="mt-1 flex flex-wrap gap-1.5">
                                {orden.productos.map((p) => (
                                    <li key={p} className="bg-muted rounded-md px-2 py-0.5 text-xs">
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {orden.faltante && (
                        <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs font-semibold">Entrega parcial · {orden.faltante}</p>
                    )}

                    {orden.comentarioPod && (
                        <figure className="border-brand-coral border-l-2 pl-3">
                            <blockquote className="text-sm italic">«{orden.comentarioPod}»</blockquote>
                            <figcaption className="text-muted-foreground mt-0.5 text-xs">Comentario del auxiliar en Drivin</figcaption>
                        </figure>
                    )}

                    {orden.lecturaPdf && orden.lecturaPdf.avisos.length > 0 && <LecturaPdf avisos={orden.lecturaPdf.avisos} />}

                    <Evidencias ordenId={orden.id} evidencias={orden.evidencias} deshabilitado={orden.informeCerrado} />
                </div>

                <div className="min-w-0 border-t pt-6 2xl:border-t-0 2xl:border-l 2xl:pt-0 2xl:pl-6">
                    <FormularioAuditoria key={orden.id} orden={orden} tiposNovedad={tiposNovedad} siguiente={siguiente} filtros={filtros} />
                </div>
            </div>
        </article>
    );
}
