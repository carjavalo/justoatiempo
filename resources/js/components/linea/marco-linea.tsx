import { ClipboardCheck, FileSpreadsheet, LayoutGrid, Target, type TipoIcono, UploadCloud } from '@/components/iconos';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { iconoLinea } from '@/lib/iconos-linea';
import { SERVICIOS } from '@/lib/portafolio';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData, type Volver } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { type ReactNode } from 'react';

export type SeccionLogistica = 'tablero' | 'cargas' | 'auditoria' | 'informes' | 'seguimiento';

const PESTANAS_LOGISTICA: { id: SeccionLogistica; texto: string; icono: TipoIcono; href: (slug: string) => string; permiso: string }[] = [
    { id: 'tablero', texto: 'Tablero', icono: LayoutGrid, href: (slug) => route('lineas.show', slug), permiso: 'tablero.ver' },
    { id: 'cargas', texto: 'Cargas Drivin', icono: UploadCloud, href: () => route('cargas.index'), permiso: 'cargas.ver' },
    { id: 'auditoria', texto: 'Auditoría POD', icono: ClipboardCheck, href: () => route('auditoria.index'), permiso: 'auditoria.ver' },
    { id: 'informes', texto: 'Informe diario', icono: FileSpreadsheet, href: () => route('informes.index'), permiso: 'informes.ver' },
    { id: 'seguimiento', texto: 'Seguimiento', icono: Target, href: () => route('seguimiento.index'), permiso: 'seguimiento.ver' },
];

/** La línea de las herramientas de Drivin (sus páginas no reciben la línea desde el servidor). */
export const LINEA_LOGISTICA = 'logisticos';

interface Props {
    slug: string;
    /** Nombre guardado en la base de datos; si no llega, el del portafolio. */
    nombre?: string;
    /** Clave del ícono elegido para la línea; si no llega, el de su servicio en el portafolio. */
    icono?: string | null;
    /** Título de la pestaña del navegador. */
    titulo: string;
    /** Pestaña activa (solo en la línea de logística, para quien usa sus herramientas). */
    seccion?: SeccionLogistica;
    /**
     * Si la página es la de la pestaña o una página interna (p. ej. la revisión de una carga). La interna
     * no muestra las pestañas: su "Volver" ya lleva a la de su sección.
     */
    paginaDeLaPestana?: boolean;
    /** Si la página es de la línea de logística: muestra las pestañas que el rol permite (si son más de una). */
    pestanas?: boolean;
    /** Texto pequeño sobre el nombre de la línea. */
    antetitulo?: string;
    /** Controles a la derecha del encabezado (filtros de la página). */
    acciones?: ReactNode;
    /** Espaciado extra del contenido. El ancho no se cambia: es el de toda la plataforma. */
    className?: string;
    children: ReactNode;
}

/**
 * Marco de cada línea de servicio: encabezado con su nombre y, en logística, las pestañas de sus
 * herramientas. Las páginas no repiten su título: lo dice la pestaña activa.
 */
export function MarcoLinea({
    slug,
    nombre,
    icono,
    titulo,
    seccion,
    paginaDeLaPestana = true,
    pestanas = false,
    antetitulo = 'Línea de servicio',
    acciones,
    className,
    children,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const puede = usePuede();
    const Icono = iconoLinea({ icono, slug });
    const nombreLinea = nombre ?? SERVICIOS.find((s) => s.id === slug)?.nombre ?? 'Línea de servicio';
    const pestana = PESTANAS_LOGISTICA.find((p) => p.id === seccion);
    // Para quien trabaja en esta línea, la línea es su inicio: sus pestañas ya son la navegación
    const esInicio = auth.user.inicio.url === new URL(route('lineas.show', slug)).pathname;
    // Una página interna vuelve a su pestaña; una pestaña, al inicio (si no lo es ya)
    const volver: Volver | false | undefined = !paginaDeLaPestana
        ? pestana
            ? { texto: `Volver a ${pestana.texto}`, href: pestana.href(slug) }
            : { texto: `Volver a ${nombreLinea}`, href: route('lineas.show', slug) }
        : esInicio
          ? false
          : undefined;
    // Solo las herramientas que su rol abre; con una sola, no hay entre qué cambiar
    const pestanasVisibles = PESTANAS_LOGISTICA.filter((p) => puede(p.permiso));
    const verPestanas = pestanas && paginaDeLaPestana && pestanasVisibles.length > 1;

    return (
        <AppLayout volver={volver}>
            <Head title={titulo} />

            <div
                className={cn(
                    'mx-auto flex w-full flex-1 flex-col gap-6 p-4 pt-3 md:p-6 md:pt-3 lg:p-8 lg:pt-4',
                    ANCHO_PLATAFORMA,
                    volver === false && 'pt-6 md:pt-8 lg:pt-10',
                    className,
                )}
            >
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <span className="bg-brand-navy-deep flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-md">
                            <Icono className="text-brand-coral-on-dark size-8" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-brand-coral-ink text-xs font-bold tracking-[0.14em] uppercase">{antetitulo}</p>
                            <h1 className="mt-0.5 text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-[1.75rem]">
                                {nombreLinea}
                            </h1>
                        </div>
                    </div>
                    {acciones}
                </header>

                {verPestanas && (
                    <nav aria-label={`Herramientas de ${nombreLinea}`} className="-mt-1 border-b">
                        <ul role="list" className="-mb-px flex gap-1 overflow-x-auto">
                            {pestanasVisibles.map(({ id, texto, icono: IconoPestana, href }) => {
                                const activa = id === seccion;
                                return (
                                    <li key={id} className="shrink-0">
                                        <Link
                                            href={href(slug)}
                                            prefetch
                                            aria-current={activa ? 'page' : undefined}
                                            className={cn(
                                                'focus-visible:ring-ring flex items-center gap-2 rounded-t-md border-b-2 px-3 pt-1 pb-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset',
                                                activa
                                                    ? 'border-brand-coral-ink text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground border-transparent',
                                            )}
                                        >
                                            <IconoPestana className={cn('size-4', activa && 'text-brand-coral-ink')} aria-hidden="true" />
                                            {texto}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}
                {/* La pestaña activa ya se ve; aquí queda como encabezado para quien navega por encabezados */}
                {verPestanas && pestana && seccion !== 'tablero' && <h2 className="sr-only">{pestana.texto}</h2>}

                {children}
            </div>
        </AppLayout>
    );
}
