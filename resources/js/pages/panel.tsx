import { Building2, CheckCircle2, LayoutGrid } from '@/components/iconos';
import { type DiaLinea, type DiaLogistica, type Estado, Fila, type Paso, pasosLinea, pasosLogistica, TextoPaso } from '@/components/linea/dia';
import AppLayout from '@/layouts/app-layout';
import { saludo } from '@/lib/formato';
import { iconoLinea } from '@/lib/iconos-linea';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';

/** Algo general que pide atención (lo de cada línea va en su tarjeta), con a dónde ir a resolverlo. */
interface Pendiente {
    clave: string;
    texto: string;
    detalle: string;
    /** Sin enlace cuando el destino ya está en el menú (p. ej. "Empresas"): el aviso dice dónde. */
    href: string | null;
    nivel: 'critical' | 'warning' | 'info';
}

/**
 * Una línea con su día, el mismo que muestra su tablero arriba: logística, el de Drivin; las demás, la programación de
 * hoy, su asistencia y las novedades.
 */
interface LineaPanel extends DiaLogistica, DiaLinea {
    slug: string;
    nombre: string;
    icono: string | null;
    logistica: boolean;
    empresas: number;
    personas: number;
}

interface Props {
    pendientes?: Pendiente[];
    lineas?: LineaPanel[];
    /** Sin línea que ver: dónde está asignado; sinTablero: tiene línea, pero su rol no abre su tablero. */
    asignacion?: { lugares: { lugar: string; lineas: string[] }[]; sinTablero: boolean };
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

const DEL_PENDIENTE: Record<Pendiente['nivel'], Estado> = { critical: 'critico', warning: 'atencion', info: 'neutro' };

/** El día de una línea, en orden: logística (Drivin) o programación, asistencia y novedades. */
function pasosDe(l: LineaPanel): Paso[] {
    return l.logistica ? pasosLogistica(l, { conEfectividad: true }) : pasosLinea(l);
}

/**
 * Inicio: el resumen del día. Arriba, lo general que pide atención; debajo, cada línea con su día en orden y lo
 * pendiente dentro de ella. Los módulos están en el menú lateral. Quien no administra nada entra directo a su línea;
 * aquí solo llega si trabaja en varias o en ninguna.
 */
export default function Panel({ pendientes = [], lineas = [], asignacion }: Props) {
    const { auth } = usePage<SharedData>().props;
    const primerNombre = auth.user.name.split(' ')[0];
    // Las líneas que aún no se prestan en ninguna empresa no tienen día que mostrar (el aviso lo ve quien las configura)
    const tarjetas = lineas
        .filter((l) => l.empresas > 0 || l.jornada || (l.hoy?.lugares ?? 0) > 0)
        .map((l) => ({ linea: l, pasos: pasosDe(l) }))
        .filter((t) => t.pasos.length > 0);

    return (
        <AppLayout>
            <Head title="Inicio" />

            <div className={cn('mx-auto flex w-full flex-1 flex-col gap-8 p-4 pt-3 md:p-6 md:pt-3 lg:p-8 lg:pt-4', ANCHO_PLATAFORMA)}>
                {/* Una línea: el saludo y la fecha. El espacio grande queda para lo que hay que hacer */}
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h1 className="text-2xl font-extrabold tracking-tight">
                        {saludo()}, {primerNombre}
                    </h1>
                    <p className="text-muted-foreground text-sm first-letter:uppercase">{formatoFecha.format(new Date())}</p>
                </header>

                {asignacion ? (
                    <SinOpciones asignacion={asignacion} />
                ) : (
                    <>
                        {pendientes.length > 0 && <PorAtender pendientes={pendientes} />}
                        {tarjetas.length > 0 && <DiaDeCadaLinea tarjetas={tarjetas} />}
                        {pendientes.length === 0 && tarjetas.length === 0 && (
                            <p className="bg-card text-muted-foreground flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm">
                                <CheckCircle2 className="text-good size-5 shrink-0" aria-hidden="true" />
                                Todo en orden: nada pide atención.
                            </p>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function PorAtender({ pendientes }: { pendientes: Pendiente[] }) {
    return (
        <section aria-labelledby="titulo-pendientes" className="flex flex-col gap-3">
            <h2 id="titulo-pendientes" className="text-lg font-extrabold tracking-tight">
                Pide atención
            </h2>
            <ul
                role="list"
                className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10"
            >
                {pendientes.map((p) => (
                    // El aviso y su detalle van juntos en el nombre del enlace (sin descripción aparte: no se leen dos veces)
                    <Fila key={p.clave} estado={DEL_PENDIENTE[p.nivel]} href={p.href}>
                        <span className="block text-sm font-semibold text-pretty">{p.texto}</span>{' '}
                        <span className="text-muted-foreground mt-0.5 block text-xs text-pretty">{p.detalle}</span>
                    </Fila>
                ))}
            </ul>
        </section>
    );
}

function DiaDeCadaLinea({ tarjetas }: { tarjetas: { linea: LineaPanel; pasos: Paso[] }[] }) {
    return (
        <section aria-labelledby="titulo-lineas" className="flex flex-col gap-3">
            <h2 id="titulo-lineas" className="text-lg font-extrabold tracking-tight">
                Hoy en cada línea
            </h2>
            <ul role="list" className="grid items-start gap-4 lg:grid-cols-2">
                {tarjetas.map(({ linea: l, pasos }) => {
                    const Icono = iconoLinea(l);
                    return (
                        <li
                            key={l.slug}
                            className="bg-card overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10"
                        >
                            {/* El título no es enlace: la línea ya está en el menú; cada paso lleva a algo concreto */}
                            <h3 id={`linea-${l.slug}`} className="flex items-center gap-3 px-4 py-3.5 text-[0.95rem] leading-snug font-bold">
                                <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                                    <Icono className="size-[1.1rem]" aria-hidden="true" />
                                </span>
                                {l.nombre}
                            </h3>
                            <ul role="list" className="divide-y border-t">
                                {pasos.map((p) => (
                                    <Fila key={p.clave} estado={p.estado} href={p.href} describedBy={`linea-${l.slug}`}>
                                        <TextoPaso paso={p} />
                                    </Fila>
                                ))}
                            </ul>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function SinOpciones({ asignacion }: { asignacion: NonNullable<Props['asignacion']> }) {
    return (
        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-asignacion" className="bg-card rounded-3xl border p-6">
                <h2 id="titulo-asignacion" className="text-base font-bold">
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
