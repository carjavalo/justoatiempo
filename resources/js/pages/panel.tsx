import { ArrowRight, Bandeja, Building2, CalendarRange, Layers, LayoutGrid, Lightbulb, MapPinned, Store, type TipoIcono, UserCheck, UsersRound } from '@/components/iconos';
import AppLayout from '@/layouts/app-layout';
import { SERVICIOS } from '@/lib/portafolio';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

/** Solo llega lo que su rol le deja ver. */
interface Resumen {
    usuarios?: { total: number; activos: number };
    empresas?: { total: number; activas: number };
    sedes?: { total: number; activas: number };
    sucursales?: { total: number; activas: number; propias: number };
    solicitudes?: { total: number; pendientes: number };
    roles?: { total: number; activos: number };
    asignaciones?: { vigentes: number; personas: number };
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
    /** Sin nada que administrar ni línea que ver; sinTablero: tiene línea, pero su rol no abre su tablero. */
    asignacion?: { lugares: { lugar: string; lineas: string[] }[]; sinTablero: boolean };
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function saludo(): string {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

/**
 * Inicio: los módulos de la administración que su rol le deja ver y las líneas de servicio que ve. Quien no
 * administra nada entra directo a su línea; aquí solo llega si aún no tiene una (o su rol no abre su tablero).
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
                        {Object.keys(resumen).length > 0 && <OpcionesAdmin resumen={resumen} />}
                        {lineas && lineas.length > 0 && <LineasServicio lineas={lineas} />}
                    </>
                ) : (
                    <SinOpciones asignacion={asignacion} />
                )}
            </div>
        </AppLayout>
    );
}

function OpcionesAdmin({ resumen }: { resumen: Resumen }) {
    const { usuarios, asignaciones, roles, empresas, sedes, sucursales, solicitudes } = resumen;
    type Opcion = { id: string; titulo: string; texto: string; href: string; icono: TipoIcono; dato: string; pendiente?: boolean };
    const todas: (Opcion | undefined)[] = [
        usuarios && {
            id: 'usuarios',
            titulo: 'Usuarios',
            texto: 'Crea accesos y asigna a cada persona su rol, su línea de servicio y dónde trabaja.',
            href: route('usuarios.index'),
            icono: UsersRound,
            dato: usuarios.total ? plural(usuarios.activos, 'usuario activo', 'usuarios activos') : 'Aún no hay usuarios',
        },
        asignaciones && {
            id: 'asignaciones',
            titulo: 'Asignaciones',
            texto: 'Dónde presta el servicio cada persona: sus empresas, sedes y sucursales, las líneas que hace allí y por cuánto tiempo.',
            href: route('asignaciones.index'),
            icono: CalendarRange,
            dato: asignaciones.vigentes
                ? `${plural(asignaciones.vigentes, 'vigente', 'vigentes')} · ${plural(asignaciones.personas, 'persona', 'personas')}`
                : 'Aún no hay asignaciones',
        },
        roles && {
            id: 'roles',
            titulo: 'Roles',
            texto: 'Los roles dentro de la empresa (auxiliar, conductor, supervisor…) y lo que cada uno puede ver y hacer.',
            href: route('roles.index'),
            icono: UserCheck,
            dato: plural(roles.activos, 'rol activo', 'roles activos'),
        },
        empresas && {
            id: 'empresas',
            titulo: 'Empresas',
            texto: 'Las empresas clientes (como Ditranza), con su NIT, su contacto y las líneas que reciben.',
            href: route('empresas.index'),
            icono: Building2,
            dato: empresas.total ? plural(empresas.activas, 'empresa activa', 'empresas activas') : 'Aún no hay empresas',
        },
        sedes && {
            id: 'sedes',
            titulo: 'Sedes',
            texto: 'Las sedes de cada empresa (como TuGo y Sodimac, de Ditranza), con su meta de efectividad.',
            href: route('sedes.index'),
            icono: Store,
            dato: sedes.total ? plural(sedes.activas, 'sede activa', 'sedes activas') : 'Aún no hay sedes',
        },
        sucursales && {
            id: 'sucursales',
            titulo: 'Sucursales',
            texto: 'Los puntos de cada sede (como Cali Sur o Cañasgordas) y los propios de Justo a Tiempo.',
            href: route('sucursales.index'),
            icono: MapPinned,
            dato: sucursales.total
                ? `${plural(sucursales.activas, 'activa', 'activas')}${sucursales.propias ? ` · ${plural(sucursales.propias, 'propia', 'propias')}` : ''}`
                : 'Aún no hay sucursales',
        },
        solicitudes && {
            id: 'solicitudes',
            titulo: 'Solicitudes de cotización',
            texto: 'Lo que escriben los clientes desde el formulario «Hablemos de su operación» del sitio web.',
            href: route('solicitudes.index'),
            icono: Bandeja,
            dato: solicitudes.pendientes
                ? plural(solicitudes.pendientes, 'solicitud pendiente', 'solicitudes pendientes')
                : solicitudes.total
                  ? 'Todas atendidas'
                  : 'Aún no han llegado',
            pendiente: solicitudes.pendientes > 0,
        },
    ];
    const opciones = todas.filter((o): o is Opcion => Boolean(o));

    return (
        <section aria-labelledby="titulo-opciones" className="flex flex-col gap-5">
            <h2 id="titulo-opciones" className="text-lg font-extrabold tracking-tight">
                Administración
            </h2>
            <ul role="list" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {opciones.map(({ id, titulo, texto, href, icono: Icono, dato, pendiente }) => (
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
                            {pendiente ? (
                                // Lo que espera respuesta resalta, con texto y no solo con color
                                <span className="bg-warning-soft text-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
                                    <span className="bg-warning size-2 rounded-full" aria-hidden="true" />
                                    {dato}
                                </span>
                            ) : (
                                <span className="text-sm font-semibold">{dato}</span>
                            )}
                            <ArrowRight className="text-primary size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </div>
                    </li>
                ))}
            </ul>

            {empresas?.total === 0 && (
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
                    Dónde prestas el servicio
                </h2>
                {asignacion?.lugares.length ? (
                    <ul role="list" className="mt-4 grid gap-3 text-sm">
                        {asignacion.lugares.map((l) => (
                            <li key={l.lugar} className="flex items-start gap-2.5">
                                <Building2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>
                                    <span className="block font-semibold">{l.lugar}</span>
                                    <span className="text-muted-foreground block text-xs">{l.lineas.join(', ')}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground mt-4 text-sm">Aún no tienes asignaciones.</p>
                )}
            </section>
            <section className="bg-card flex flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center">
                <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                    <LayoutGrid className="size-7" aria-hidden="true" />
                </span>
                {asignacion?.sinTablero ? (
                    <>
                        <h2 className="mt-4 text-lg font-extrabold tracking-tight">Tu rol aún no tiene módulos asignados</h2>
                        <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                            Por ahora puedes ver tu carnet desde el menú de tu usuario. Si necesitas más acceso, pídeselo a quien administra los roles.
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="mt-4 text-lg font-extrabold tracking-tight">Aún no tienes dónde prestar el servicio</h2>
                        <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                            Cuando te asignen a una empresa y una línea de servicio (en Asignaciones), al ingresar entrarás directo a ella.
                        </p>
                    </>
                )}
            </section>
        </div>
    );
}
