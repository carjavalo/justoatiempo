import { ConfirmarEliminar } from '@/components/admin/acciones';
import { CampoBusqueda, POCOS_PARA_FILTRAR, useFiltros } from '@/components/admin/filtros';
import { contenedorModulo, EncabezadoModulo, EstadoVacio, Paginacion, SinResultados } from '@/components/admin/piezas';
import { Bandeja, Check, CheckCircle2, Mail, MoreHorizontal, Phone, Trash2, Undo2 } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { fechaHoraCompleta, fmt, haceCuanto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, router } from '@inertiajs/react';
import { type RefObject, useRef, useState } from 'react';

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
    const { valores, cambiar } = useFiltros(route('solicitudes.index'), filtros);
    const lista = useRef<HTMLUListElement>(null);
    const atendidas = total - pendientes;

    // El estado se elige en un solo lugar, con cuántas hay en cada uno (como en Novedades y Auditoría)
    const segmentos = [
        { valor: '', texto: 'Pendientes', total: pendientes },
        { valor: 'atendidas', texto: 'Atendidas', total: atendidas },
        { valor: 'todas', texto: 'Todas', total },
    ];
    // Con pocas solicitudes caben todas a la vista: la búsqueda aparece cuando hay muchas (o si ya hay una puesta)
    const conBusqueda = total > POCOS_PARA_FILTRAR || valores.q !== '';
    const vacia = valores.q
        ? 'Ninguna solicitud coincide con la búsqueda.'
        : valores.estado === 'atendidas'
          ? 'Aún no hay solicitudes atendidas.'
          : 'No hay solicitudes pendientes: todas están atendidas.';
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
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                            <div
                                role="group"
                                aria-label="Estado de las solicitudes"
                                className="bg-muted flex w-full shrink-0 gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
                            >
                                {segmentos.map((s) => {
                                    const elegido = valores.estado === s.valor;
                                    return (
                                        <button
                                            key={s.valor || 'pendientes'}
                                            type="button"
                                            aria-pressed={elegido}
                                            onClick={() => !elegido && cambiar('estado', s.valor)}
                                            className={cn(
                                                'focus-visible:ring-ring flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:outline-hidden',
                                                elegido
                                                    ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                                                    : 'text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {s.texto}{' '}
                                            <span className={cn('tabular-nums', elegido ? 'text-foreground' : 'text-muted-foreground')}>
                                                {fmt.numero(s.total)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {conBusqueda && (
                                <div role="search" className="min-w-0 flex-1">
                                    <CampoBusqueda
                                        id="buscar-solicitudes"
                                        etiqueta="Buscar solicitudes"
                                        placeholder="Buscar por nombre, empresa o correo"
                                        valor={valores.q}
                                        onCambio={(v) => cambiar('q', v, { inmediato: false })}
                                    />
                                </div>
                            )}
                        </div>
                        {/* Al cambiar de estado o buscar, se anuncia cuántas quedan */}
                        <p role="status" className="sr-only">
                            {resumen}
                        </p>

                        {solicitudes.data.length === 0 ? (
                            <SinResultados texto={vacia} />
                        ) : (
                            <ul
                                ref={lista}
                                role="list"
                                aria-label="Solicitudes"
                                tabIndex={-1}
                                className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-hidden"
                            >
                                {solicitudes.data.map((s) => (
                                    <FilaSolicitud key={s.id} solicitud={s} marcarPendiente={valores.estado === 'todas'} lista={lista} />
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

function FilaSolicitud({
    solicitud: s,
    marcarPendiente,
    lista,
}: {
    solicitud: Solicitud;
    /** Solo cuando se ven todas: en Pendientes o Atendidas el estado ya lo dice el filtro. */
    marcarPendiente: boolean;
    lista: RefObject<HTMLUListElement | null>;
}) {
    const puede = usePuede();
    const [procesando, setProcesando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const titulo = `solicitud-${s.id}`;
    const deQuien = ` de ${s.nombre}`;
    const puedeAtender = puede('solicitudes.atender');
    const puedeEliminar = puede('solicitudes.eliminar');
    // Lo que no es la acción principal; sin nada, no hay menú
    const conMenu = (s.atendida && puedeAtender) || puedeEliminar;

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
                // Si salió de la lista (al ver solo pendientes o atendidas), el foco pasa a la siguiente, no se pierde
                onSuccess: () =>
                    window.setTimeout(() => {
                        const quedan = [...document.querySelectorAll<HTMLElement>('[data-accion-solicitud]')];
                        const destino =
                            quedan.find((b) => b.dataset.accionSolicitud === String(s.id)) ?? quedan[Math.min(posicion, quedan.length - 1)];
                        (destino ?? lista.current ?? document.getElementById('contenido'))?.focus();
                    }, 50),
            },
        );
    };

    return (
        <li className="px-4 py-4 sm:px-5">
            <article aria-labelledby={titulo}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                        <h2 id={titulo} className="leading-snug font-bold text-balance">
                            {s.nombre}
                            {s.empresa && <span className="text-muted-foreground font-semibold"> · {s.empresa}</span>}
                        </h2>
                        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                            {s.servicio && (
                                <>
                                    <span className="text-foreground font-semibold">{s.servicio}</span>
                                    {' · '}
                                </>
                            )}
                            Recibida{' '}
                            <time dateTime={s.recibida} title={fechaHoraCompleta.format(new Date(s.recibida))}>
                                {haceCuanto(s.recibida)}
                            </time>
                            {marcarPendiente && !s.atendida && (
                                <>
                                    {' · '}
                                    <span className="text-warning font-semibold">Pendiente</span>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Marcarla pide su permiso; sin él, la solicitud solo se consulta */}
                        {puedeAtender && !s.atendida && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cambiarAtencion}
                                aria-disabled={procesando || undefined}
                                data-accion-solicitud={s.id}
                                className="h-9 rounded-lg text-xs font-semibold aria-disabled:cursor-wait aria-disabled:opacity-70"
                            >
                                <Check className="size-4" aria-hidden="true" />
                                Marcar como atendida
                                <span className="sr-only">{` la solicitud${deQuien}`}</span>
                            </Button>
                        )}
                        {conMenu && (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        data-accion-solicitud={s.atendida ? s.id : undefined}
                                        className="text-muted-foreground hover:text-foreground size-9 rounded-lg"
                                    >
                                        <MoreHorizontal className="size-5" aria-hidden="true" />
                                        <span className="sr-only">Más acciones para la solicitud{deQuien}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-48">
                                    {s.atendida && puedeAtender && (
                                        <DropdownMenuItem onSelect={cambiarAtencion} className="gap-2">
                                            <Undo2 className="size-4" aria-hidden="true" />
                                            Volver a pendientes
                                        </DropdownMenuItem>
                                    )}
                                    {puedeEliminar && (
                                        <DropdownMenuItem onSelect={() => setEliminando(true)} className="text-critical focus:text-critical gap-2">
                                            <Trash2 className="size-4" aria-hidden="true" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <p className="mt-2 max-w-prose text-sm leading-relaxed break-words whitespace-pre-line">{s.mensaje}</p>

                <p className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
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
                </p>

                {s.atendida && s.atendidaEn && (
                    <p className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="text-good size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            <span className="text-foreground font-semibold">Atendida</span> por {s.atendidaPor ?? 'un usuario que ya no existe'}{' '}
                            <time dateTime={s.atendidaEn} title={fechaHoraCompleta.format(new Date(s.atendidaEn))}>
                                {haceCuanto(s.atendidaEn)}
                            </time>
                        </span>
                    </p>
                )}
                <ConfirmarEliminar
                    abierto={eliminando}
                    nombre={`la solicitud${deQuien}`}
                    url={route('solicitudes.destroy', s.id)}
                    consecuencia="Deja de verse en la bandeja. No se borra: queda en el historial, con quién y cuándo se eliminó."
                    onCerrar={() => setEliminando(false)}
                />
            </article>
        </li>
    );
}
