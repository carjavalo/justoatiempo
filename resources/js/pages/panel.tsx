import { ArrowRight, Bandeja, Building2, Layers, LayoutGrid, Lightbulb, MapPinned, Store, type TipoIcono, UsersRound } from '@/components/iconos';
import AppLayout from '@/layouts/app-layout';
import { SERVICIOS } from '@/lib/portafolio';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

interface Resumen {
    usuarios: { total: number; activos: number };
    empresas: { total: number; activas: number };
    sedes: { total: number; activas: number };
    sucursales: { total: number; activas: number; propias: number };
    solicitudes: { total: number; pendientes: number };
}

interface LineaPanel {
    slug: string;
    nombre: string;
    empresas: number;
    personas: number;
    tablero: boolean;
}

interface Props {
    resumen?: Resumen;
    lineas?: LineaPanel[];
    asignacion?: { empresa: string | null; sede: string | null; sucursal: string | null };
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function saludo(): string {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

/**
 * Inicio del administrador: la administración (usuarios, empresas, sedes y sucursales) y las líneas de servicio.
 * Quien no es administrador entra directo a su línea; aquí solo llega si aún no tiene una.
 */
export default function Panel({ resumen, lineas, asignacion }: Props) {
    const { auth } = usePage<SharedData>().props;
    const primerNombre = auth.user.name.split(' ')[0];

    return (
        <AppLayout>
            <Head title="Panel" />

            <div className={cn('mx-auto flex w-full flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8', ANCHO_PLATAFORMA)}>
                <header>
                    <p className="text-brand-coral-ink text-xs font-bold tracking-[0.16em] uppercase first-letter:uppercase">
                        {formatoFecha.format(new Date())}
                    </p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                        {saludo()}, {primerNombre}
                    </h1>
                    {resumen && <p className="text-muted-foreground mt-2 text-base">¿Qué quieres gestionar hoy?</p>}
                </header>

                {resumen ? (
                    <>
                        <OpcionesAdmin resumen={resumen} />
                        {lineas && <LineasServicio lineas={lineas} />}
                    </>
                ) : (
                    <SinOpciones asignacion={asignacion} />
                )}
            </div>
        </AppLayout>
    );
}

function OpcionesAdmin({ resumen }: { resumen: Resumen }) {
    const { usuarios, empresas, sedes, sucursales, solicitudes } = resumen;
    const opciones: { id: string; titulo: string; texto: string; href: string; icono: TipoIcono; dato: string }[] = [
        {
            id: 'usuarios',
            titulo: 'Usuarios',
            texto: 'Crea accesos y asigna a cada persona su rol, su línea de servicio y dónde trabaja.',
            href: route('usuarios.index'),
            icono: UsersRound,
            dato: usuarios.total ? plural(usuarios.activos, 'usuario activo', 'usuarios activos') : 'Aún no hay usuarios',
        },
        {
            id: 'empresas',
            titulo: 'Empresas',
            texto: 'Las empresas clientes (como Ditranza), con su NIT, su contacto y las líneas que reciben.',
            href: route('empresas.index'),
            icono: Building2,
            dato: empresas.total ? plural(empresas.activas, 'empresa activa', 'empresas activas') : 'Aún no hay empresas',
        },
        {
            id: 'sedes',
            titulo: 'Sedes',
            texto: 'Las sedes de cada empresa (como TuGo y Sodimac, de Ditranza), con su meta de efectividad.',
            href: route('sedes.index'),
            icono: Store,
            dato: sedes.total ? plural(sedes.activas, 'sede activa', 'sedes activas') : 'Aún no hay sedes',
        },
        {
            id: 'sucursales',
            titulo: 'Sucursales',
            texto: 'Los puntos de cada sede (como Cali Sur o Cañasgordas) y los propios de Justo a Tiempo.',
            href: route('sucursales.index'),
            icono: MapPinned,
            dato: sucursales.total
                ? `${plural(sucursales.activas, 'activa', 'activas')}${sucursales.propias ? ` · ${plural(sucursales.propias, 'propia', 'propias')}` : ''}`
                : 'Aún no hay sucursales',
        },
    ];

    return (
        <section aria-labelledby="titulo-opciones" className="flex flex-col gap-5">
            <h2 id="titulo-opciones" className="text-lg font-extrabold tracking-tight">
                Administración
            </h2>
            <ul role="list" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {opciones.map(({ id, titulo, texto, href, icono: Icono, dato }) => (
                    <li
                        key={id}
                        className={cn(
                            'group bg-card relative isolate flex flex-col overflow-hidden rounded-3xl border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all md:p-7',
                            'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[var(--sombra-elevada)]',
                            'has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-ring/25 has-[a:focus-visible]:ring-[3px]',
                        )}
                    >
                        {/* Ícono grande de fondo: decorativo */}
                        <Icono
                            className="text-primary/[0.05] absolute -right-6 -bottom-6 -z-10 size-40 transition-transform group-hover:scale-105"
                            strokeWidth={1.2}
                            aria-hidden="true"
                        />
                        <span className="bg-brand-navy-deep flex size-14 items-center justify-center rounded-2xl shadow-md">
                            <Icono className="text-brand-coral-on-dark size-8" aria-hidden="true" />
                        </span>
                        <h3 className="mt-6 text-xl font-extrabold tracking-tight">
                            {/* El enlace cubre toda la tarjeta (::after), pero su nombre es solo el título */}
                            <Link
                                href={href}
                                prefetch
                                aria-describedby={`opcion-${id}`}
                                className="outline-hidden after:absolute after:inset-0 after:content-['']"
                            >
                                {titulo}
                            </Link>
                        </h3>
                        <p id={`opcion-${id}`} className="text-muted-foreground mt-2 mb-6 text-sm leading-relaxed">
                            {texto}
                        </p>
                        {/* mt-auto: el pie queda abajo en todas las tarjetas aunque los textos tengan largos distintos */}
                        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                            <span className="text-sm font-semibold">{dato}</span>
                            <ArrowRight className="text-primary size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </div>
                    </li>
                ))}
            </ul>

            <SolicitudesSitio solicitudes={solicitudes} />

            {empresas.total === 0 && (
                <p className="bg-secondary/60 text-secondary-foreground flex items-start gap-3 rounded-2xl px-5 py-4 text-sm">
                    <Lightbulb className="text-brand-coral-ink mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <span>
                        <strong className="font-semibold">Para empezar:</strong> registra primero las empresas, luego sus sedes y sus sucursales y por
                        último los usuarios, así podrás asignarle a cada persona dónde trabaja.
                    </span>
                </p>
            )}
        </section>
    );
}

/**
 * Lo que llega del formulario "Hablemos de su operación" del sitio web. Va a lo ancho, debajo de las cuatro
 * tarjetas: no es un registro que se administre sino una bandeja que se revisa, y así resalta lo pendiente.
 */
function SolicitudesSitio({ solicitudes }: { solicitudes: Resumen['solicitudes'] }) {
    const { total, pendientes } = solicitudes;
    const dato = pendientes
        ? plural(pendientes, 'solicitud pendiente', 'solicitudes pendientes')
        : total
          ? 'Todas atendidas'
          : 'Aún no han llegado';

    return (
        <div
            className={cn(
                'group bg-card relative isolate flex flex-wrap items-center gap-x-5 gap-y-3 overflow-hidden rounded-3xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all md:px-7',
                'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[var(--sombra-elevada)]',
                'has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-ring/25 has-[a:focus-visible]:ring-[3px]',
            )}
        >
            <span className="bg-brand-navy-deep flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-md">
                <Bandeja className="text-brand-coral-on-dark size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 basis-64">
                <h3 className="text-lg font-extrabold tracking-tight">
                    <Link
                        href={route('solicitudes.index')}
                        prefetch
                        aria-describedby="opcion-solicitudes"
                        className="outline-hidden after:absolute after:inset-0 after:content-['']"
                    >
                        Solicitudes de cotización
                    </Link>
                </h3>
                <p id="opcion-solicitudes" className="text-muted-foreground text-sm">
                    Lo que escriben los clientes desde el formulario del sitio web.
                </p>
            </div>
            <span
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap',
                    pendientes ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
                )}
            >
                {pendientes > 0 && <span className="bg-warning size-2 rounded-full" aria-hidden="true" />}
                {dato}
            </span>
            <ArrowRight className="text-primary size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
    );
}

/** Las 8 líneas del portafolio: se entra a cada una para ver su operación por empresa. */
function LineasServicio({ lineas }: { lineas: LineaPanel[] }) {
    return (
        <section aria-labelledby="titulo-lineas" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="titulo-lineas" className="text-lg font-extrabold tracking-tight">
                    Líneas de servicio
                </h2>
                <p className="text-muted-foreground text-sm">Entra a cada línea para ver su operación por empresa.</p>
            </div>
            <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {lineas.map((l) => {
                    const Icono = SERVICIOS.find((s) => s.id === l.slug)?.icono ?? Layers;
                    return (
                        <li
                            key={l.slug}
                            className={cn(
                                'group bg-card relative flex flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all',
                                'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[var(--sombra-elevada)]',
                                'has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-ring/25 has-[a:focus-visible]:ring-[3px]',
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <span className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                                    <Icono className="size-6" aria-hidden="true" />
                                </span>
                                <span
                                    id={`linea-${l.slug}-estado`}
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[0.68rem] font-semibold whitespace-nowrap',
                                        l.tablero ? 'bg-good-soft text-good' : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {l.tablero ? 'Tablero activo' : 'Tablero por definir'}
                                </span>
                            </div>
                            <h3 className="mt-4 text-[0.95rem] leading-snug font-bold">
                                <Link
                                    href={route('lineas.show', l.slug)}
                                    prefetch
                                    aria-describedby={`linea-${l.slug} linea-${l.slug}-estado`}
                                    className="outline-hidden after:absolute after:inset-0 after:content-['']"
                                >
                                    {l.nombre}
                                </Link>
                            </h3>
                            <p id={`linea-${l.slug}`} className="text-muted-foreground mt-auto pt-3 text-xs">
                                {l.empresas ? plural(l.empresas, 'empresa', 'empresas') : 'Sin empresas aún'} ·{' '}
                                {plural(l.personas, 'persona', 'personas')}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function SinOpciones({ asignacion }: { asignacion?: Props['asignacion'] }) {
    return (
        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-asignacion" className="bg-card rounded-3xl border p-6">
                <h2 id="titulo-asignacion" className="text-sm font-bold tracking-[0.14em] uppercase">
                    Tu asignación
                </h2>
                <dl className="mt-4 grid gap-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground text-xs">Empresa</dt>
                        <dd className="font-semibold">{asignacion?.empresa ?? 'Justo a Tiempo SP'}</dd>
                    </div>
                    {asignacion?.sede && (
                        <div>
                            <dt className="text-muted-foreground text-xs">Sede</dt>
                            <dd className="font-semibold">{asignacion.sede}</dd>
                        </div>
                    )}
                    <div>
                        <dt className="text-muted-foreground text-xs">Sucursal</dt>
                        <dd className="font-semibold">{asignacion?.sucursal ?? 'Sin sucursal asignada'}</dd>
                    </div>
                </dl>
            </section>
            <section className="bg-card flex flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center">
                <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                    <LayoutGrid className="size-7" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-extrabold tracking-tight">Aún no tienes una línea de servicio asignada</h2>
                <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                    Cuando el administrador te asigne la línea en la que trabajas, al ingresar entrarás directo a ella.
                </p>
            </section>
        </div>
    );
}
