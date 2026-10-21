import { EstadoBadge } from '@/components/admin/piezas';
import { Dato, EstadoBadge as EstadoNivel, Panel, Vacio } from '@/components/dashboard/piezas';
import { AlertTriangle, Building2, CalendarClock, UsersRound } from '@/components/iconos';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

interface Empresa {
    id: number;
    nombre: string;
    activo: boolean;
    sedes: number;
    sucursales: number;
    personas: number;
}

interface Hoy {
    fecha: string;
    lugares: number;
    requeridas: number;
    programadas: number;
    presentes: number;
    faltas: number;
    sinRegistrar: number;
    cobertura: number | null;
    /** Cobertura de cada uno de los últimos 14 días (null: sin programación). */
    tendencia: { fecha: string; cobertura: number | null }[];
}

interface Novedades {
    abiertas: number;
    enSeguimiento: number;
    graves: number;
    recientes: {
        id: number;
        fecha: string;
        tipo: string;
        gravedad: 'ninguna' | 'leve' | 'grave';
        lugar: string;
        persona: string | null;
        estado: string;
    }[];
}

interface Props {
    linea: { id: number; slug: string; nombre: string; descripcion: string | null; icono: string | null };
    empresas: Empresa[];
    /** Personas activas de la línea por rol de la empresa ("Conductor", "Auxiliar operativo"…). */
    personal: { rol: string; total: number }[];
    /** Si su rol edita empresas (para asignarles la línea) y ve los usuarios. */
    puedeEmpresas: boolean;
    puedeUsuarios: boolean;
    /** La operación de hoy (si su rol ve la programación). */
    hoy: Hoy | null;
    /** Las novedades sin cerrar (si su rol las ve). */
    novedades: Novedades | null;
    /** Sus propios turnos: la última semana y las dos que vienen. */
    misTurnos: { id: number; fecha: string; lugar: string; turno: string | null; asistencia: string | null }[];
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const claseEnlace =
    'text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden';

const GRAVEDAD = { ninguna: 'bg-good', leve: 'bg-warning', grave: 'bg-critical' } as const;

/**
 * Tablero de una línea sin Drivin: la operación de hoy (programación y asistencia), sus novedades sin cerrar, a quién
 * se le presta (empresas, sedes y sucursales) y con qué personal.
 */
export default function Linea({ linea, empresas, personal, puedeEmpresas, puedeUsuarios, hoy, novedades, misTurnos }: Props) {
    const totalPersonas = personal.reduce((suma, p) => suma + p.total, 0);

    return (
        <MarcoLinea slug={linea.slug} nombre={linea.nombre} icono={linea.icono} titulo={linea.nombre} seccion="tablero" pestanas>
            {linea.descripcion && <p className="text-muted-foreground -mt-2 max-w-3xl text-sm leading-relaxed md:text-base">{linea.descripcion}</p>}

            {hoy && <OperacionHoy hoy={hoy} slug={linea.slug} />}

            {misTurnos.length > 0 && <MisTurnos turnos={misTurnos} />}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-5">
                    {novedades && <NovedadesPendientes novedades={novedades} slug={linea.slug} />}

                    {/* Empresas que reciben la línea */}
                    <section aria-labelledby="titulo-empresas" className="bg-card rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
                            <h2 id="titulo-empresas" className="flex items-center gap-2 text-base font-bold">
                                <Building2 className="text-primary size-5" aria-hidden="true" />
                                Empresas
                            </h2>
                            {puedeEmpresas && (
                                <Link href={route('empresas.index')} className={`${claseEnlace} text-sm`}>
                                    Asignar empresas
                                </Link>
                            )}
                        </header>
                        {empresas.length === 0 ? (
                            <p className="text-muted-foreground px-5 py-8 text-sm">
                                Ninguna empresa recibe esta línea todavía.
                                {puedeEmpresas && ' Márcala en el formulario de la empresa, en «Líneas de servicio que recibe».'}
                            </p>
                        ) : (
                            <ul role="list" className="divide-y">
                                {empresas.map((e) => (
                                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">{e.nombre}</p>
                                            <p className="text-muted-foreground text-xs">
                                                {plural(e.sedes, 'sede', 'sedes')} · {plural(e.sucursales, 'sucursal', 'sucursales')} ·{' '}
                                                {plural(e.personas, 'persona', 'personas')} en esta línea
                                            </p>
                                        </div>
                                        <EstadoBadge activo={e.activo} femenino />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* Personal de la línea */}
                <section aria-labelledby="titulo-personal" className="bg-card rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 id="titulo-personal" className="flex items-center gap-2 text-base font-bold">
                            <UsersRound className="text-primary size-5" aria-hidden="true" />
                            Personal
                        </h2>
                        {puedeUsuarios && totalPersonas > 0 && (
                            <Link href={route('usuarios.index', { linea: linea.id })} className={`${claseEnlace} text-sm`}>
                                Ver personas
                            </Link>
                        )}
                    </div>
                    {personal.length === 0 && <p className="text-muted-foreground mt-3 text-sm">Aún no hay personas activas en esta línea.</p>}
                    <dl className="mt-4 grid grid-cols-2 gap-3 empty:hidden">
                        {personal.map((p) => (
                            <div key={p.rol} className="bg-muted/60 rounded-xl px-4 py-3">
                                <dt className="text-muted-foreground truncate text-xs" title={p.rol}>
                                    {p.rol}
                                </dt>
                                <dd className="text-2xl font-extrabold tabular-nums">{p.total}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </div>
        </MarcoLinea>
    );
}

function OperacionHoy({ hoy, slug }: { hoy: Hoy; slug: string }) {
    const registrada = hoy.programadas > hoy.sinRegistrar;
    const nivel = registrada ? semaforo(hoy.cobertura) : null;
    const conDatos = hoy.tendencia.filter((d) => d.cobertura !== null);

    return (
        <section aria-labelledby="titulo-hoy" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="titulo-hoy" className="flex items-center gap-2 text-base font-bold">
                    <CalendarClock className="text-primary size-5" aria-hidden="true" />
                    Hoy, {fmt.fechaLarga(hoy.fecha)}
                </h2>
                <Link href={route('programacion.index', slug)} className={`${claseEnlace} text-sm`}>
                    {hoy.lugares ? 'Ver la programación' : 'Programar el día'}
                </Link>
            </div>
            {hoy.lugares === 0 ? (
                <p className="bg-card text-muted-foreground rounded-2xl border px-5 py-4 text-sm">Hoy aún no hay programación.</p>
            ) : (
                <ul role="list" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Dato
                        titulo="Cobertura"
                        valor={registrada ? fmt.pct(hoy.cobertura) : '—'}
                        detalle={nivel ? <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel> : 'Sin asistencia registrada'}
                    />
                    <Dato
                        titulo="Asistieron"
                        valor={`${hoy.presentes} de ${hoy.requeridas || hoy.programadas}`}
                        detalle={plural(hoy.lugares, 'lugar programado', 'lugares programados')}
                    />
                    <Dato titulo="No asistieron" valor={String(hoy.faltas)} detalle={hoy.faltas ? 'Sin justificar' : 'Ninguna falta'} />
                    <Dato
                        titulo="Sin registrar"
                        valor={String(hoy.sinRegistrar)}
                        detalle={hoy.sinRegistrar ? 'Falta su asistencia' : 'Asistencia al día'}
                    />
                </ul>
            )}

            {conDatos.length > 1 && (
                <Panel titulo="Cobertura de los últimos 14 días" descripcion="Personas que asistieron frente a las requeridas, cada día">
                    <ol role="list" className="flex h-28 items-end gap-1.5">
                        {hoy.tendencia.map((d) => {
                            const nivelDia = semaforo(d.cobertura);
                            const texto = `${fmt.fechaCorta(d.fecha)}: ${d.cobertura === null ? 'sin programación' : fmt.pct(d.cobertura)}`;
                            return (
                                <li key={d.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={texto}>
                                    <span className="sr-only">{texto}</span>
                                    {d.cobertura === null ? (
                                        <span
                                            className="border-muted-foreground/40 h-1 w-full rounded-full border border-dashed"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <span
                                            className={cn(
                                                'w-full rounded-t-[4px]',
                                                nivelDia?.nivel === 'good'
                                                    ? 'bg-primary'
                                                    : nivelDia?.nivel === 'warning'
                                                      ? 'bg-warning'
                                                      : 'bg-critical',
                                            )}
                                            style={{ height: `${Math.max(4, d.cobertura)}%` }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="text-muted-foreground text-[0.62rem] tabular-nums" aria-hidden="true">
                                        {fmt.diaSemana(d.fecha).slice(0, 2)}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </Panel>
            )}
        </section>
    );
}

function NovedadesPendientes({ novedades, slug }: { novedades: Novedades; slug: string }) {
    const pendientes = novedades.abiertas + novedades.enSeguimiento;

    return (
        <Panel
            titulo={
                <span className="flex items-center gap-2">
                    <AlertTriangle className="text-primary size-5" aria-hidden="true" />
                    Novedades sin cerrar
                </span>
            }
            descripcion={
                pendientes
                    ? `${plural(novedades.abiertas, 'abierta', 'abiertas')} · ${novedades.enSeguimiento} en seguimiento${novedades.graves ? ` · ${plural(novedades.graves, 'grave', 'graves')}` : ''}`
                    : 'Todas las novedades están cerradas'
            }
            acciones={
                <Link href={route('novedades.index', slug)} className={`${claseEnlace} text-sm`}>
                    Ver novedades
                </Link>
            }
            cuerpoClassName="px-0 pb-0"
        >
            {novedades.recientes.length === 0 ? (
                <Vacio>Sin novedades pendientes.</Vacio>
            ) : (
                <ul role="list" className="divide-y border-t">
                    {novedades.recientes.map((n) => (
                        <li key={n.id} className="flex items-start gap-3 px-5 py-3">
                            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', GRAVEDAD[n.gravedad])} aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                    {n.tipo}
                                    {n.persona && <span className="text-muted-foreground font-normal"> · {n.persona}</span>}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                    {fmt.fechaMedia(n.fecha)} · {n.lugar} · {n.estado === 'abierta' ? 'Abierta' : 'En seguimiento'}
                                    {n.gravedad === 'grave' && ' · Grave'}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function MisTurnos({ turnos }: { turnos: Props['misTurnos'] }) {
    return (
        <Panel titulo="Mis turnos" descripcion="La última semana y las dos que vienen" cuerpoClassName="px-0 pb-0">
            <ul role="list" className="divide-y border-t">
                {turnos.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                        <div className="min-w-0">
                            <p className="font-semibold first-letter:uppercase">{fmt.fechaLarga(t.fecha)}</p>
                            <p className="text-muted-foreground truncate text-xs">
                                {t.lugar}
                                {t.turno && ` · ${t.turno}`}
                            </p>
                        </div>
                        {t.asistencia && <span className="text-muted-foreground text-xs font-semibold">{t.asistencia}</span>}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
