import {
    AlertTriangle,
    CalendarClock,
    ClipboardCheck,
    FileSpreadsheet,
    LayoutGrid,
    MapPinned,
    PackageCheck,
    Target,
    type TipoIcono,
    UploadCloud,
} from '@/components/iconos';
import { type EnPantalla } from '@/components/linea/dia';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { saludo } from '@/lib/formato';
import { iconoLinea } from '@/lib/iconos-linea';
import { SERVICIOS } from '@/lib/portafolio';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData, type Volver } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

export type SeccionLinea = 'tablero' | 'programacion' | 'novedades' | 'informe' | 'cargas' | 'auditoria' | 'trazabilidad' | 'informes' | 'seguimiento' | 'entregas';

/** La línea de las herramientas de Drivin (sus páginas no reciben la línea desde el servidor). */
export const LINEA_LOGISTICA = 'logisticos';

/**
 * Las herramientas de cada línea: todas tienen tablero y programación; logística, las de Drivin (cargas, auditoría,
 * su informe y su seguimiento); las demás, novedades y su informe diario.
 */
const PESTANAS: {
    id: SeccionLinea;
    texto: string;
    icono: TipoIcono;
    href: (slug: string) => string;
    permiso: string;
    en: 'todas' | 'logistica' | 'otras';
}[] = [
    { id: 'tablero', texto: 'Tablero', icono: LayoutGrid, href: (slug) => route('lineas.show', slug), permiso: 'tablero.ver', en: 'todas' },
    {
        id: 'programacion',
        texto: 'Programación',
        icono: CalendarClock,
        href: (slug) => route('programacion.index', slug),
        permiso: 'programacion.ver',
        en: 'todas',
    },
    { id: 'cargas', texto: 'Cargas Drivin', icono: UploadCloud, href: () => route('cargas.index'), permiso: 'cargas.ver', en: 'logistica' },
    {
        id: 'auditoria',
        texto: 'Auditoría POD',
        icono: ClipboardCheck,
        href: () => route('auditoria.index'),
        permiso: 'auditoria.ver',
        en: 'logistica',
    },
    {
        id: 'trazabilidad',
        texto: 'Trazabilidad',
        icono: MapPinned,
        href: () => route('trazabilidad.index'),
        permiso: 'auditoria.ver',
        en: 'logistica',
    },
    {
        id: 'informes',
        texto: 'Informe diario',
        icono: FileSpreadsheet,
        href: () => route('informes.index'),
        permiso: 'informes.ver',
        en: 'logistica',
    },
    { id: 'seguimiento', texto: 'Seguimiento', icono: Target, href: () => route('seguimiento.index'), permiso: 'seguimiento.ver', en: 'logistica' },
    { id: 'entregas', texto: 'Mis entregas', icono: PackageCheck, href: () => route('mis-entregas'), permiso: 'entregas.ver', en: 'logistica' },
    {
        id: 'novedades',
        texto: 'Novedades',
        icono: AlertTriangle,
        href: (slug) => route('novedades.index', slug),
        permiso: 'novedades.ver',
        en: 'otras',
    },
    {
        id: 'informe',
        texto: 'Informe diario',
        icono: FileSpreadsheet,
        href: (slug) => route('lineas.informe', slug),
        permiso: 'informes.ver',
        en: 'otras',
    },
];

/** Las pestañas de su tipo de línea; con menú lateral, sin el tablero (la opción de la línea en el menú ya lleva a él). */
function pestanasDe(slug: string, conMenu: boolean) {
    const esLogistica = slug === LINEA_LOGISTICA;
    return PESTANAS.filter((p) => (p.en === 'todas' || p.en === (esLogistica ? 'logistica' : 'otras')) && !(conMenu && p.id === 'tablero'));
}

/** De esas, las que su rol abre ("Mis entregas", solo para quien tiene entregas a su nombre). Con una sola no se muestran. */
function abiertas(pestanas: typeof PESTANAS, puede: (permiso: string) => boolean, conEntregas: boolean) {
    return pestanas.filter((p) => puede(p.permiso) && (p.id !== 'entregas' || conEntregas));
}

/**
 * Los destinos que la página de una pestaña ya ofrece: las pestañas que se ven (con una sola no se muestran) y las
 * opciones del menú lateral. Un enlace del contenido a uno de ellos lo repetiría.
 */
export function useYaEnPantalla(slug: string): EnPantalla {
    const { auth, menu } = usePage<SharedData>().props;
    const puede = usePuede();
    const visibles = abiertas(pestanasDe(slug, !!menu), puede, !!auth.user.entregas);
    return {
        pestanas: visibles.length > 1 ? visibles.map((p) => new URL(p.href(slug)).pathname) : [],
        menu: (menu ?? []).flatMap((g) => g.items.map((i) => i.href)),
    };
}

interface Props {
    slug: string;
    /** Nombre guardado en la base de datos; si no llega, el del portafolio. */
    nombre?: string;
    /** Clave del ícono elegido para la línea; si no llega, el de su servicio en el portafolio. */
    icono?: string | null;
    /** Título de la pestaña del navegador. */
    titulo: string;
    /** Pestaña activa. */
    seccion?: SeccionLinea;
    /**
     * Si la página es la de la pestaña o una página interna (p. ej. la revisión de una carga). La interna
     * no muestra las pestañas: su "Volver" ya lleva a la de su sección.
     */
    paginaDeLaPestana?: boolean;
    /** Muestra las pestañas de las herramientas de la línea que el rol permite (si son más de una). */
    pestanas?: boolean;
    /** Controles a la derecha del encabezado (filtros de la página). */
    acciones?: ReactNode;
    /** Espaciado extra del contenido. El ancho no se cambia: es el de toda la plataforma. */
    className?: string;
    children: ReactNode;
}

/**
 * Marco de cada línea de servicio: encabezado con su nombre y las pestañas de sus herramientas. Las páginas no
 * repiten su título: lo dice la pestaña activa.
 */
export function MarcoLinea({
    slug,
    nombre,
    icono,
    titulo,
    seccion,
    paginaDeLaPestana = true,
    pestanas = false,
    acciones,
    className,
    children,
}: Props) {
    const { auth, menu } = usePage<SharedData>().props;
    const puede = usePuede();
    const Icono = iconoLinea({ icono, slug });
    const nombreLinea = nombre ?? SERVICIOS.find((s) => s.id === slug)?.nombre ?? 'Línea de servicio';
    const deLaLinea = pestanasDe(slug, !!menu);
    const pestana = deLaLinea.find((p) => p.id === seccion);
    // Para quien trabaja en esta línea, la línea es su inicio: sus pestañas ya son la navegación
    const esInicio = auth.user.inicio.url === new URL(route('lineas.show', slug)).pathname;
    // En su tablero, a quien tiene la línea como inicio se le saluda bajo el nombre (nunca como antetítulo)
    const bienvenida = esInicio && seccion === 'tablero' ? `${saludo()}, ${auth.user.name.split(' ')[0]}` : null;
    // Una página interna vuelve a su pestaña; una pestaña, al inicio (si no lo es ya)
    const volver: Volver | false | undefined = !paginaDeLaPestana
        ? pestana
            ? { texto: `Volver a ${pestana.texto}`, href: pestana.href(slug) }
            : { texto: `Volver a ${nombreLinea}`, href: route('lineas.show', slug) }
        : esInicio
          ? false
          : undefined;
    // Solo las herramientas que su rol abre; con una sola, no hay entre qué cambiar
    const pestanasVisibles = abiertas(deLaLinea, puede, !!auth.user.entregas);
    const verPestanas = pestanas && paginaDeLaPestana && pestanasVisibles.length > 1;
    const desborde = useDesborde(verPestanas);

    return (
        <AppLayout volver={volver}>
            <Head title={titulo} />

            <div className={cn('mx-auto flex w-full flex-1 flex-col gap-6 p-4 pt-3 md:p-6 md:pt-3 lg:p-8 lg:pt-4', ANCHO_PLATAFORMA, className)}>
                {/* Nombre, pestañas y los controles de la página, en ese orden (también para el teclado). En el teléfono van
                    uno bajo otro: las pestañas, enseguida del nombre; desde 1024 px, los controles suben a la derecha del nombre */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-x-6 lg:gap-y-5">
                    <header className="flex min-w-0 items-center gap-4 lg:col-start-1 lg:row-start-1">
                        <span className="bg-brand-navy-deep flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-md">
                            <Icono className="text-brand-coral-on-dark size-8" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance md:text-[1.75rem]">{nombreLinea}</h1>
                            {bienvenida && <p className="text-muted-foreground mt-0.5 text-sm">{bienvenida}</p>}
                        </div>
                    </header>

                    {verPestanas && (
                        <nav aria-label={`Herramientas de ${nombreLinea}`} className="border-b lg:col-span-2 lg:row-start-2">
                            {/* Si no caben (en el teléfono), el borde que sigue se desvanece: hay más pestañas al desplazar */}
                            <ul
                                ref={desborde.ref}
                                role="list"
                                className="-mb-px flex gap-1 overflow-x-auto [mask-image:var(--desvanecido,none)] focus-within:[mask-image:none]"
                                style={desborde.estilo}
                            >
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
                    {/* La pestaña activa ya se ve; aquí queda como encabezado para quien navega por encabezados (sus
                        controles y su contenido van debajo) */}
                    {verPestanas && pestana && seccion !== 'tablero' && <h2 className="sr-only">{pestana.texto}</h2>}

                    {acciones && <div className="min-w-0 lg:col-start-2 lg:row-start-1">{acciones}</div>}
                </div>

                {children}
            </div>
        </AppLayout>
    );
}

const DESVANECIDO = '2.5rem';

/** Si la lista de pestañas tiene más a la izquierda o a la derecha, su borde se desvanece (máscara, sin cubrir nada). */
function useDesborde(activo: boolean) {
    const ref = useRef<HTMLUListElement>(null);
    const [lados, setLados] = useState({ izq: false, der: false });

    useEffect(() => {
        const lista = ref.current;
        if (!activo || !lista) return;
        const medir = () => {
            const izq = lista.scrollLeft > 1;
            const der = lista.scrollLeft + lista.clientWidth < lista.scrollWidth - 1;
            setLados((antes) => (antes.izq === izq && antes.der === der ? antes : { izq, der }));
        };
        // En el teléfono, la pestaña activa se ve aunque esté al final (sin mover la página: solo la lista). Se mide con la
        // letra ya cargada: antes, los textos son más angostos
        const mostrarActiva = () => {
            const activa = lista.querySelector<HTMLElement>('[aria-current="page"]');
            const fuera = activa ? activa.getBoundingClientRect().right - lista.getBoundingClientRect().right : 0;
            if (fuera > 0) lista.scrollLeft += fuera + 24;
        };
        mostrarActiva();
        document.fonts?.ready.then(mostrarActiva);
        medir();
        lista.addEventListener('scroll', medir, { passive: true });
        const observador = new ResizeObserver(medir);
        observador.observe(lista);
        return () => {
            lista.removeEventListener('scroll', medir);
            observador.disconnect();
        };
    }, [activo]);

    const { izq, der } = lados;
    const mascara =
        izq || der
            ? `linear-gradient(to right, ${izq ? 'transparent' : 'black'}, black ${DESVANECIDO}, black calc(100% - ${DESVANECIDO}), ${der ? 'transparent' : 'black'})`
            : undefined;
    const estilo = mascara ? ({ '--desvanecido': mascara } as CSSProperties) : undefined;

    return { ref, estilo };
}
