import { CargaLote } from '@/components/auditoria/carga-lote';
import { Cola, consultaFiltros, EstadoAuditoriaBadge } from '@/components/auditoria/cola';
import { Evidencias } from '@/components/auditoria/evidencias';
import { FormularioAuditoria } from '@/components/auditoria/formulario';
import { type FiltrosAuditoria, type Jornada, type OrdenCola, type OrdenDetalle, type Resumen, type TipoNovedad } from '@/components/auditoria/tipos';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { ClipboardCheck, Search } from '@/components/iconos';
import { useEffect, useState } from 'react';
import { Selector } from '@/components/selector';

interface Props {
    filtros: FiltrosAuditoria;
    jornadas: Jornada[];
    clientes: { id: number; nombre: string }[];
    resumen: Resumen;
    ordenes: OrdenCola[];
    seleccionada: OrdenDetalle | null;
    siguiente: { id: number; codigo: string } | null;
    tiposNovedad: TipoNovedad[];
}

const claseSelect = 'border-input bg-card h-9 rounded-lg border px-2.5 text-sm transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25';

export default function Auditoria({ filtros, jornadas, clientes, resumen, ordenes, seleccionada, siguiente, tiposNovedad }: Props) {
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
        { valor: 'sin_evidencia', texto: 'Sin evidencia', cuenta: resumen.sinEvidencia },
        { valor: 'auditadas', texto: 'Auditadas' },
        { valor: 'todas', texto: 'Todas' },
    ];

    const avance = resumen.aprobadas ? (resumen.auditadas / resumen.aprobadas) * 100 : 0;

    return (
        <AppLayout>
            <Head title={seleccionada ? `Auditoría ${seleccionada.codigo}` : 'Auditoría POD'} />

            <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">Auditoría POD</h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            Revisa la prueba de entrega de cada orden aprobada: fachada, producto sellado y destapado, y remesa firmada.
                        </p>
                    </div>

                    {/* Avance de la jornada */}
                    <div className="bg-card w-full max-w-md rounded-2xl border p-4 xl:w-96">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <p className="font-semibold">
                                {fmt.numero(resumen.auditadas)} de {fmt.numero(resumen.aprobadas)} entregas auditadas
                            </p>
                            {resumen.cumplimiento !== null && <p className="text-muted-foreground text-xs">{fmt.pct(resumen.cumplimiento)} cumple</p>}
                        </div>
                        <div
                            className="bg-muted mt-2 h-2 rounded-full"
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

                {/* Filtros */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1">
                        <label htmlFor="filtro-jornada" className="text-muted-foreground text-xs font-semibold">
                            Jornada
                        </label>
                        <Selector
                            id="filtro-jornada"
                            valor={filtros.fecha}
                            onCambio={(v) => filtrar({ fecha: v })}
                            className="bg-card h-9 min-w-56"
                            opciones={jornadas.map((j) => ({ valor: j.fecha, texto: `${fmt.fechaMedia(j.fecha)}${j.pendientes > 0 ? ` · ${j.pendientes} por auditar` : ' · al día'}` }))}
                        />
                    </div>
                    <div className="grid gap-1">
                        <label htmlFor="filtro-cliente" className="text-muted-foreground text-xs font-semibold">
                            Cliente
                        </label>
                        <Selector
                            id="filtro-cliente"
                            valor={filtros.cliente ? String(filtros.cliente) : ''}
                            onCambio={(v) => filtrar({ cliente: v ? Number(v) : null })}
                            className="bg-card h-9 min-w-44"
                            opciones={[{ valor: '', texto: 'Todos' }, ...clientes.map((c) => ({ valor: String(c.id), texto: c.nombre }))]}
                        />
                    </div>
                    <div className="grid min-w-52 flex-1 gap-1 sm:max-w-xs">
                        <label htmlFor="filtro-busqueda" className="text-muted-foreground text-xs font-semibold">
                            Buscar
                        </label>
                        <div className="relative">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden="true" />
                            <input
                                id="filtro-busqueda"
                                type="search"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Código, destinatario, auxiliar o placa"
                                className={cn(claseSelect, 'w-full pl-8')}
                            />
                        </div>
                    </div>

                    <div role="group" aria-label="Estado de la auditoría" className="bg-muted flex flex-wrap rounded-lg p-0.5">
                        {opcionesEstado.map((o) => {
                            const activo = filtros.estado === o.valor;
                            return (
                                <button
                                    key={o.valor}
                                    type="button"
                                    aria-pressed={activo}
                                    onClick={() => filtrar({ estado: o.valor })}
                                    className={cn(
                                        'focus-visible:ring-ring flex min-h-8 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                                        activo ? 'bg-accion text-accion-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {o.texto}
                                    {o.cuenta !== undefined && (
                                        <span className={cn('tabular rounded-full px-1.5 text-[0.68rem]', activo ? 'bg-black/20' : 'bg-card')}>{fmt.numero(o.cuenta)}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <CargaLote fecha={filtros.fecha} />

                <div className="grid gap-5 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start">
                    <div className="lg:sticky lg:top-20">
                        <Cola ordenes={ordenes} seleccionadaId={seleccionada?.id ?? null} filtros={filtros} />
                    </div>

                    {/* En móvil, la orden abierta va primero */}
                    <div className="order-first lg:order-none">
                        {seleccionada ? (
                            <Detalle orden={seleccionada} tiposNovedad={tiposNovedad} siguiente={siguiente} filtros={filtros} />
                        ) : (
                            <div className="bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
                                <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                                    <ClipboardCheck className="size-7" aria-hidden="true" />
                                </span>
                                <h2 className="mt-4 text-lg font-bold">{resumen.aprobadas ? 'No hay órdenes con este filtro' : 'No hay entregas aprobadas en esta jornada'}</h2>
                                <p className="text-muted-foreground mt-1 max-w-md text-sm">
                                    {resumen.aprobadas && filtros.estado === 'pendientes' ? 'Todas las entregas de esta jornada ya están auditadas.' : 'Cambia la jornada o el filtro para ver otras órdenes.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function Detalle({ orden, tiposNovedad, siguiente, filtros }: { orden: OrdenDetalle; tiposNovedad: TipoNovedad[]; siguiente: Props['siguiente']; filtros: FiltrosAuditoria }) {
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
        ['Cliente', [orden.cliente, orden.sede].filter(Boolean).join(' · ') || null],
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
                    <p className="text-brand-coral-ink text-xs font-bold tracking-[0.14em] uppercase">Orden</p>
                    <h2 id="titulo-orden" className="mt-0.5 font-mono text-xl font-bold tracking-tight">
                        {orden.codigo}
                    </h2>
                    {orden.ruta && <p className="text-muted-foreground mt-0.5 text-xs">{orden.ruta}</p>}
                </div>
                <EstadoAuditoriaBadge estado={estado} className="mt-1" />
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

                    {orden.faltante && <p className="bg-warning-soft text-warning rounded-lg px-3 py-2 text-xs font-semibold">Entrega parcial · {orden.faltante}</p>}

                    {orden.comentarioPod && (
                        <figure className="border-brand-coral border-l-2 pl-3">
                            <blockquote className="text-sm italic">«{orden.comentarioPod}»</blockquote>
                            <figcaption className="text-muted-foreground mt-0.5 text-xs">Comentario del auxiliar en Drivin</figcaption>
                        </figure>
                    )}

                    <Evidencias ordenId={orden.id} evidencias={orden.evidencias} deshabilitado={orden.informeCerrado} />
                </div>

                <div className="min-w-0 border-t pt-6 2xl:border-t-0 2xl:border-l 2xl:pt-0 2xl:pl-6">
                    <FormularioAuditoria key={orden.id} orden={orden} tiposNovedad={tiposNovedad} siguiente={siguiente} filtros={filtros} />
                </div>
            </div>
        </article>
    );
}
