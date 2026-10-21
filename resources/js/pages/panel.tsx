import { EstadoBadge as EstadoNivel } from '@/components/dashboard/piezas';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Info, LayoutGrid, type TipoIcono } from '@/components/iconos';
import AppLayout from '@/layouts/app-layout';
import { fmt, nivelFrenteAMeta, semaforo } from '@/lib/formato';
import { iconoLinea } from '@/lib/iconos-linea';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

type Nivel = 'critical' | 'warning' | 'info';

/** Algo que pide atención, con a dónde ir a resolverlo (solo de lo que su rol ve y hace). */
interface Pendiente {
    clave: string;
    texto: string;
    detalle: string;
    href: string;
    nivel: Nivel;
}

interface LineaPanel {
    slug: string;
    nombre: string;
    icono: string | null;
    empresas: number;
    personas: number;
    /** Logística: la última jornada cargada de Drivin (null si no hay o su rol no ve el tablero). */
    jornada: { fecha: string; propia: boolean; asignadas: number; efectividad: number | null; meta: number | null } | null;
    /** Las demás líneas: la programación y la asistencia de hoy (si su rol ve la programación). */
    hoy: { lugares: number; requeridas: number; programadas: number; presentes: number; sinRegistrar: number; cobertura: number | null } | null;
    /** A dónde lleva la tarjeta: el informe de la última jornada, sus entregas o la programación de hoy. */
    enlace: { href: string; texto: string } | null;
}

interface Props {
    pendientes?: Pendiente[];
    lineas?: LineaPanel[];
    /** Sin línea que ver: dónde está asignado; sinTablero: tiene línea, pero su rol no abre su tablero. */
    asignacion?: { lugares: { lugar: string; lineas: string[] }[]; sinTablero: boolean };
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function saludo(): string {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

const NIVEL: Record<Nivel, { icono: TipoIcono; clase: string }> = {
    critical: { icono: AlertTriangle, clase: 'bg-critical-soft text-critical' },
    warning: { icono: AlertTriangle, clase: 'bg-warning-soft text-warning' },
    info: { icono: Info, clase: 'bg-secondary text-primary' },
};

/**
 * Inicio: el resumen del día. Lo que pide atención y cómo va cada línea que ve; los módulos están en el menú
 * lateral. Quien no administra nada entra directo a su línea; aquí solo llega si trabaja en varias o en ninguna.
 */
export default function Panel({ pendientes, lineas, asignacion }: Props) {
    const { auth } = usePage<SharedData>().props;
    const primerNombre = auth.user.name.split(' ')[0];

    return (
        <AppLayout>
            <Head title="Inicio" />

            <div className={cn('mx-auto flex w-full flex-1 flex-col gap-8 p-4 pt-3 md:p-6 md:pt-3 lg:p-8 lg:pt-4', ANCHO_PLATAFORMA)}>
                <header>
                    <p className="text-brand-coral-ink text-xs font-bold tracking-[0.16em] uppercase first-letter:uppercase">
                        {formatoFecha.format(new Date())}
                    </p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                        {saludo()}, {primerNombre}
                    </h1>
                    {/* Sin pendientes, lo dice la sección "Pide atención" (no se repite aquí) */}
                    {pendientes && pendientes.length > 0 && <p className="text-muted-foreground mt-2 text-base">Esto es lo que pide atención hoy.</p>}
                </header>

                {asignacion ? (
                    <SinOpciones asignacion={asignacion} />
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                        {/* En pantallas grandes lo pendiente va a la derecha; en el celular, primero */}
                        <PorAtender pendientes={pendientes ?? []} />
                        {lineas && lineas.length > 0 && <OperacionDeHoy lineas={lineas} />}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function PorAtender({ pendientes }: { pendientes: Pendiente[] }) {
    return (
        <section aria-labelledby="titulo-pendientes" className="flex flex-col gap-4 lg:order-2">
            <h2 id="titulo-pendientes" className="text-lg font-extrabold tracking-tight">
                Pide atención
            </h2>
            {pendientes.length === 0 ? (
                <p className="bg-card text-muted-foreground flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm">
                    <CheckCircle2 className="text-good size-5 shrink-0" aria-hidden="true" />
                    No hay pendientes: nada espera respuesta.
                </p>
            ) : (
                <ul role="list" className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    {pendientes.map((p) => {
                        const { icono: Icono, clase } = NIVEL[p.nivel];
                        return (
                            <li
                                key={p.clave}
                                className="group has-[a:focus-visible]:ring-ring relative has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset"
                            >
                                <div className="hover:bg-muted/40 flex items-start gap-3 px-4 py-3.5 transition-colors">
                                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', clase)}>
                                        <Icono className="size-4" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold">
                                            {/* El enlace cubre toda la fila (::after); su nombre es el aviso */}
                                            <Link
                                                href={p.href}
                                                aria-describedby={`pendiente-${p.clave}`}
                                                className="outline-hidden after:absolute after:inset-0 after:content-['']"
                                            >
                                                {p.texto}
                                            </Link>
                                        </p>
                                        <p id={`pendiente-${p.clave}`} className="text-muted-foreground mt-0.5 text-xs">
                                            {p.detalle}
                                        </p>
                                    </div>
                                    <ArrowRight
                                        className="text-muted-foreground mt-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/** Cómo va cada línea: logística, su última jornada de Drivin; las demás, la asistencia de hoy. */
function OperacionDeHoy({ lineas }: { lineas: LineaPanel[] }) {
    // Las líneas que aún no se prestan en ninguna empresa no tienen nada que mostrar: van en una sola frase
    const conOperacion = lineas.filter((l) => l.empresas > 0 || l.jornada || (l.hoy?.lugares ?? 0) > 0);
    const sinOperacion = lineas.filter((l) => !conOperacion.includes(l));

    return (
        <section aria-labelledby="titulo-lineas" className="flex flex-col gap-4">
            <h2 id="titulo-lineas" className="text-lg font-extrabold tracking-tight">
                Operación de hoy
            </h2>
            {sinOperacion.length > 0 && (
                <p className={cn('text-muted-foreground text-sm', conOperacion.length > 0 && 'order-last')}>
                    {sinOperacion.length === 1 ? 'Aún no se presta en ninguna empresa: ' : 'Aún no se prestan en ninguna empresa: '}
                    {sinOperacion.map((l) => l.nombre).join(', ')}. Se marcan en cada empresa, en «Líneas de servicio que recibe».
                </p>
            )}
            <ul role="list" className="grid gap-4 empty:hidden sm:grid-cols-2">
                {conOperacion.map((l) => {
                    const Icono = iconoLinea(l);
                    return (
                        <li
                            key={l.slug}
                            className={cn(
                                'group bg-card relative flex flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all',
                                l.enlace && 'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[var(--sombra-elevada)]',
                                'has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-ring/25 has-[a:focus-visible]:ring-[3px]',
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                                    <Icono className="size-5" aria-hidden="true" />
                                </span>
                                <h3 id={`linea-${l.slug}`} className="min-w-0 text-[0.95rem] leading-snug font-bold">
                                    {l.nombre}
                                </h3>
                            </div>
                            <div className="mt-4 flex flex-1 flex-col">
                                <EstadoLinea linea={l} />
                                <p className="text-muted-foreground mt-auto border-t pt-3 text-xs">
                                    {l.empresas ? plural(l.empresas, 'empresa', 'empresas') : 'Sin empresas aún'} ·{' '}
                                    {plural(l.personas, 'persona', 'personas')}
                                </p>
                                {/* La línea ya está en el menú: la tarjeta lleva a algo más concreto (y cubre toda la tarjeta) */}
                                {l.enlace && (
                                    <Link
                                        href={l.enlace.href}
                                        aria-describedby={`linea-${l.slug}`}
                                        className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-semibold outline-hidden after:absolute after:inset-0 after:content-['']"
                                    >
                                        {l.enlace.texto}
                                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function EstadoLinea({ linea }: { linea: LineaPanel }) {
    const { jornada, hoy } = linea;

    if (jornada) {
        const nivel = jornada.meta ? nivelFrenteAMeta(jornada.efectividad, jornada.meta) : null;
        return (
            <div className="mb-4">
                <p className="text-muted-foreground text-xs">
                    {jornada.propia ? 'Tu última jornada' : 'Última jornada'} · {fmt.fechaMedia(jornada.fecha)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-extrabold tabular-nums">{fmt.pct(jornada.efectividad)}</span>
                    {nivel && jornada.meta && (
                        <EstadoNivel nivel={nivel}>{nivel === 'good' ? 'En la meta' : `Meta ${fmt.pctEntero(jornada.meta)}`}</EstadoNivel>
                    )}
                </p>
                <p className="text-muted-foreground text-xs">Efectividad en {plural(jornada.asignadas, 'entrega', 'entregas')}</p>
            </div>
        );
    }

    if (hoy) {
        if (hoy.lugares === 0) return <p className="text-muted-foreground mb-4 text-sm">Hoy aún no hay programación.</p>;
        const registrada = hoy.programadas > hoy.sinRegistrar;
        const nivel = registrada ? semaforo(hoy.cobertura) : null;
        return (
            <div className="mb-4">
                <p className="text-muted-foreground text-xs">Cobertura de hoy</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-extrabold tabular-nums">{registrada ? fmt.pct(hoy.cobertura) : '—'}</span>
                    {nivel && <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel>}
                </p>
                <p className="text-muted-foreground text-xs">
                    {registrada
                        ? `${hoy.presentes} de ${hoy.requeridas || hoy.programadas} asistieron${hoy.sinRegistrar ? ` · ${hoy.sinRegistrar} sin registrar` : ''}`
                        : `${plural(hoy.programadas, 'persona programada', 'personas programadas')} · asistencia sin registrar`}
                </p>
            </div>
        );
    }

    return null;
}

function SinOpciones({ asignacion }: { asignacion: NonNullable<Props['asignacion']> }) {
    return (
        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-asignacion" className="bg-card rounded-3xl border p-6">
                <h2 id="titulo-asignacion" className="text-sm font-bold tracking-[0.14em] uppercase">
                    Dónde prestas el servicio
                </h2>
                {asignacion.lugares.length ? (
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
                {asignacion.sinTablero ? (
                    <>
                        <h2 className="mt-4 text-lg font-extrabold tracking-tight">Tu rol aún no tiene módulos asignados</h2>
                        <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                            Por ahora puedes ver tu carnet desde el menú de tu usuario. Si necesitas más acceso, pídeselo a quien administra los
                            roles.
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
