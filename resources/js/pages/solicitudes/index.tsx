import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { contenedorModulo, EncabezadoModulo, EstadoVacio, Iniciales, Paginacion, SinResultados } from '@/components/admin/piezas';
import { Bandeja, Check, Mail, Phone, Undo2 } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { fechaHoraCompleta, haceCuanto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

interface Solicitud {
    id: number;
    nombre: string;
    empresa: string | null;
    email: string;
    telefono: string | null;
    servicio: string | null;
    mensaje: string;
    recibida: string;
    atendida: boolean;
    atendidaEn: string | null;
    atendidaPor: string | null;
}

interface Props {
    solicitudes: Paginado<Solicitud>;
    total: number;
    pendientes: number;
    filtros: { q: string; estado: string };
}

const ASUNTO = encodeURIComponent('Su solicitud de cotización · Justo a Tiempo SP');

/**
 * Solicitudes de cotización del formulario "Hablemos de su operación" del sitio web. Al equipo le llega cada una
 * por correo; aquí quedan todas y se marcan como atendidas para que nadie la responda dos veces ni quede olvidada.
 */
export default function Solicitudes({ solicitudes, total, pendientes, filtros }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('solicitudes.index'), filtros);
    const atendidas = total - pendientes;
    // Sin filtros propios, la lista vacía significa que no queda nada por atender
    const vacia =
        !filtros.q && !filtros.estado ? 'No hay solicitudes pendientes: todas están atendidas.' : 'Ninguna solicitud coincide con los filtros.';
    const resumen = solicitudes.total ? `${solicitudes.total} ${solicitudes.total === 1 ? 'solicitud' : 'solicitudes'}` : vacia;

    return (
        <AppLayout>
            <Head title="Solicitudes de cotización" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Solicitudes de cotización"
                    descripcion="Lo que escriben los clientes en el formulario «Hablemos de su operación» del sitio web. Cuando atiendas una, márcala para que el equipo sepa que ya se respondió."
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={Bandeja}
                        titulo="Aún no han llegado solicitudes"
                        texto="Cuando alguien escriba desde el formulario del sitio web, su solicitud aparecerá aquí y les llegará un aviso por correo."
                        accion={
                            <Button asChild variant="outline" className="h-10 rounded-lg px-4 font-semibold">
                                <a href="/#contacto">Ver el formulario en el sitio web</a>
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={resumen}
                            soloAnunciar={solicitudes.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-solicitudes"
                        >
                            <CampoBusqueda
                                id="buscar-solicitudes"
                                etiqueta="Buscar solicitudes"
                                placeholder="Buscar por nombre, empresa o correo"
                                valor={valores.q}
                                onCambio={(v) => cambiar('q', v, { inmediato: false })}
                            />
                            <FiltroLista
                                id="filtro-estado"
                                etiqueta="Estado"
                                valor={valores.estado}
                                onCambio={(v) => cambiar('estado', v)}
                                opciones={[
                                    { valor: '', texto: `Pendientes (${pendientes})` },
                                    { valor: 'atendidas', texto: `Atendidas (${atendidas})` },
                                    { valor: 'todas', texto: `Todas (${total})` },
                                ]}
                            />
                        </BarraFiltros>

                        {solicitudes.data.length === 0 ? (
                            <SinResultados texto={vacia} />
                        ) : (
                            <ul role="list" aria-label="Solicitudes" className="grid gap-4">
                                {solicitudes.data.map((s) => (
                                    <TarjetaSolicitud key={s.id} solicitud={s} />
                                ))}
                            </ul>
                        )}

                        <Paginacion pagina={solicitudes} nombre="solicitudes" />
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
    const [procesando, setProcesando] = useState(false);
    const titulo = `solicitud-${s.id}`;

    const cambiarAtencion = () => {
        if (procesando) return;
        const botones = [...document.querySelectorAll<HTMLElement>('[data-accion-solicitud]')];
        const posicion = botones.findIndex((b) => b.dataset.accionSolicitud === String(s.id));

        router.patch(
            route('solicitudes.atencion', s.id),
            { atendida: !s.atendida },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => setProcesando(false),
                // Si la tarjeta salió de la lista (filtro de pendientes), el foco pasa a la siguiente, no se pierde
                onSuccess: () =>
                    window.setTimeout(() => {
                        const quedan = [...document.querySelectorAll<HTMLElement>('[data-accion-solicitud]')];
                        const destino =
                            quedan.find((b) => b.dataset.accionSolicitud === String(s.id)) ?? quedan[Math.min(posicion, quedan.length - 1)];
                        (destino ?? document.getElementById('buscar-solicitudes'))?.focus();
                    }, 50),
            },
        );
    };

    return (
        <li>
            <article aria-labelledby={titulo} className="bg-card rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <Iniciales texto={s.nombre} />
                        <div className="min-w-0">
                            <h2 id={titulo} className="leading-snug font-extrabold">
                                {s.nombre}
                                {s.empresa && <span className="text-muted-foreground font-semibold"> · {s.empresa}</span>}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Recibida{' '}
                                <time dateTime={s.recibida} title={fechaHoraCompleta.format(new Date(s.recibida))}>
                                    {haceCuanto(s.recibida)}
                                </time>
                            </p>
                        </div>
                    </div>
                    {/* Estado con texto, no solo color */}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                            s.atendida ? 'bg-good-soft text-good' : 'bg-warning-soft text-warning',
                        )}
                    >
                        <span className={cn('size-1.5 rounded-full', s.atendida ? 'bg-good' : 'bg-warning')} aria-hidden="true" />
                        {s.atendida ? 'Atendida' : 'Pendiente'}
                    </span>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Servicio</dt>
                        <dd className="mt-0.5 font-semibold">{s.servicio ?? 'No lo indicó'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Lo que necesita</dt>
                        <dd className="mt-1 leading-relaxed break-words whitespace-pre-line">{s.mensaje}</dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="sr-only">Contacto</dt>
                        <dd className="flex flex-wrap gap-x-5 gap-y-2">
                            <a
                                href={`mailto:${s.email}?subject=${ASUNTO}`}
                                className="text-primary focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm font-semibold break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                            >
                                <Mail className="size-4 shrink-0" aria-hidden="true" />
                                <span className="sr-only">Escribir a </span>
                                {s.email}
                            </a>
                            {s.telefono && (
                                <a
                                    href={`tel:${s.telefono.replace(/[^0-9+]/g, '')}`}
                                    className="text-primary focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                >
                                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                                    <span className="sr-only">Llamar al </span>
                                    {s.telefono}
                                </a>
                            )}
                        </dd>
                    </div>
                </dl>

                <div className={cn('mt-5 flex flex-wrap items-center gap-3 border-t pt-4', s.atendida ? 'justify-between' : 'justify-end')}>
                    {s.atendida && s.atendidaEn && (
                        <p className="text-muted-foreground text-xs">
                            Atendida por {s.atendidaPor ?? 'un usuario que ya no existe'} el {fechaHoraCompleta.format(new Date(s.atendidaEn))}
                        </p>
                    )}
                    <Button
                        type="button"
                        variant={s.atendida ? 'outline' : 'default'}
                        onClick={cambiarAtencion}
                        aria-disabled={procesando || undefined}
                        aria-describedby={titulo}
                        data-accion-solicitud={s.id}
                        className="h-9 rounded-lg px-3.5 font-semibold aria-disabled:cursor-wait aria-disabled:opacity-70"
                    >
                        {s.atendida ? <Undo2 className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                        {s.atendida ? 'Volver a pendientes' : 'Marcar como atendida'}
                    </Button>
                </div>
            </article>
        </li>
    );
}
