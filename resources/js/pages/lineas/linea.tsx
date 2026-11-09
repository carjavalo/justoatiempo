import { EstadoBadge } from '@/components/admin/piezas';
import { EstadoBadge as EstadoNivel, Panel } from '@/components/dashboard/piezas';
import { ArrowRight, Check } from '@/components/iconos';
import { type DiaLinea, type EnPantalla, fechaDia, FranjaHoy, pasosLinea, plural, sinRepetir } from '@/components/linea/dia';
import { type DiaCobertura, GraficaCobertura, MINIMO_DIAS } from '@/components/linea/grafica-cobertura';
import { MarcoLinea, useYaEnPantalla } from '@/components/linea/marco-linea';
import { fmt } from '@/lib/formato';
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

/** Las novedades sin cerrar: cuántas, cuántas graves y las más urgentes (las graves primero). */
type Novedades = NonNullable<DiaLinea['novedades']> & {
    recientes: {
        id: number;
        fecha: string;
        tipo: string;
        gravedad: 'ninguna' | 'leve' | 'grave';
        lugar: string;
        persona: string | null;
        estado: string;
    }[];
};

/** Mientras la línea nunca se ha programado: lo que ya está y quién da cada paso que falta. */
interface PrimerosPasos {
    /** Empresas activas que la reciben y personas asignadas, en lo que ve. */
    empresas: number;
    personas: number;
    /** Si su rol marca la línea en el formulario de la empresa. */
    marcaEmpresas: boolean;
    /** A dónde ir, si su rol lo hace: las asignaciones de la línea y su programación. */
    asignaciones: string | null;
    programacion: string | null;
}

interface Props extends DiaLinea {
    linea: { id: number; slug: string; nombre: string; icono: string | null };
    empresas: Empresa[];
    /** Personas activas de la línea por rol de la empresa ("Conductor", "Auxiliar operativo"…). */
    personal: { rol: string; total: number }[];
    /** Si su rol ve los usuarios (la lista de las personas de la línea). */
    puedeUsuarios: boolean;
    /** Null cuando la línea ya opera. */
    primerosPasos: PrimerosPasos | null;
    /** La cobertura de cada uno de los días anteriores a hoy (si su rol ve la programación). */
    cobertura: DiaCobertura[];
    novedades: Novedades | null;
    /** Sus propios turnos: la última semana y las dos que vienen. */
    misTurnos: { id: number; fecha: string; lugar: string; turno: string | null; asistencia: string | null }[];
}

const claseEnlace =
    'text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden';
const claseFranja =
    'bg-border grid gap-px overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10 dark:bg-white/10';

/**
 * Tablero de una línea sin Drivin. Arriba, el día en el orden en que pasa (programación, asistencia y novedades), lo
 * mismo que su tarjeta en el inicio; luego sus turnos, las novedades por resolver y la cobertura de los días anteriores;
 * al final, en una franja, a qué empresas se presta y con qué personal. Mientras la línea no se ha programado nunca,
 * en su lugar va lo que falta para operarla.
 */
export default function Linea({ linea, empresas, personal, puedeUsuarios, primerosPasos, hoy, cobertura, novedades, misTurnos }: Props) {
    const yaEnPantalla = useYaEnPantalla(linea.slug);
    // Sin programación nunca no hay día que mostrar: la guía dice qué falta
    const pasos = primerosPasos ? [] : pasosLinea({ hoy, novedades }, { yaEnPantalla });
    const porResolver = novedades && novedades.recientes.length > 0 ? novedades : null;
    const verCobertura = cobertura.filter((d) => d.cobertura !== null).length >= MINIMO_DIAS;

    return (
        <MarcoLinea slug={linea.slug} nombre={linea.nombre} icono={linea.icono} titulo={linea.nombre} seccion="tablero" pestanas>
            {primerosPasos && <GuiaPrimerosPasos pasos={primerosPasos} linea={linea.nombre} yaEnPantalla={yaEnPantalla} />}

            {pasos.length > 0 && <FranjaHoy pasos={pasos} />}

            {misTurnos.length > 0 && <MisTurnos turnos={misTurnos} />}

            {(porResolver || verCobertura) && (
                <div className={cn('grid items-start gap-5', porResolver && verCobertura && 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]')}>
                    {porResolver && <NovedadesSinCerrar novedades={porResolver} conTotal={!!primerosPasos} />}
                    {verCobertura && <GraficaCobertura dias={cobertura} />}
                </div>
            )}

            {/* Mientras no opera, las empresas y el personal ya están en los pasos de la guía */}
            {!primerosPasos && (
                <EmpresasYPersonal
                    empresas={empresas}
                    personal={personal}
                    verPersonas={puedeUsuarios ? route('usuarios.index', { linea: linea.id }) : null}
                />
            )}
        </MarcoLinea>
    );
}

/**
 * Lo que falta para operar la línea, en orden: que una empresa la reciba, asignarle personas y programarla. Cada paso
 * dice si está listo o quién lo da; el siguiente lleva a donde se hace (salvo que ese destino ya esté en el menú o en
 * las pestañas: entonces el paso dice dónde). Desaparece con la primera programación.
 */
function GuiaPrimerosPasos({ pasos, linea, yaEnPantalla }: { pasos: PrimerosPasos; linea: string; yaEnPantalla: EnPantalla }) {
    const enlace = sinRepetir(yaEnPantalla);
    const lista = [
        {
            clave: 'empresas',
            titulo: 'Una empresa recibe la línea',
            listo: pasos.empresas > 0,
            hecho: plural(pasos.empresas, 'empresa la recibe', 'empresas la reciben'),
            // Asignar a alguien de una empresa a la línea también hace que esa empresa la reciba
            falta: pasos.marcaEmpresas
                ? `En Empresas, abre la empresa y marca «${linea}» en «Líneas de servicio que recibe».`
                : pasos.asignaciones
                  ? 'Queda lista al asignar a alguien de una empresa a esta línea, en Asignaciones.'
                  : 'La marca quien administra las empresas, en el formulario de cada una.',
            href: pasos.marcaEmpresas ? route('empresas.index', undefined, false) : pasos.asignaciones,
            accion: pasos.marcaEmpresas ? 'Abrir Empresas' : 'Abrir las asignaciones de la línea',
        },
        {
            clave: 'personas',
            titulo: 'Personas asignadas a la línea',
            listo: pasos.personas > 0,
            hecho: plural(pasos.personas, 'persona asignada', 'personas asignadas'),
            falta: pasos.asignaciones
                ? 'En Asignaciones, di dónde trabaja cada persona (empresa, sede o sucursal) y marca esta línea.'
                : 'Las asigna quien administra las asignaciones.',
            href: pasos.asignaciones,
            accion: 'Abrir las asignaciones de la línea',
        },
        {
            clave: 'programacion',
            titulo: 'La primera programación',
            listo: false,
            hecho: '',
            falta: pasos.programacion ? 'En Programación, elige el día, los lugares y quiénes van.' : 'La hace quien coordina la línea.',
            href: pasos.programacion,
            accion: 'Abrir Programación',
        },
    ];
    const siguiente = lista.findIndex((p) => !p.listo);
    const faltan = lista.filter((p) => !p.listo).length;

    return (
        <section
            aria-labelledby="titulo-primeros-pasos"
            className="bg-card rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10"
        >
            <header className="px-5 pt-5 pb-4">
                <h2 id="titulo-primeros-pasos" className="text-lg font-extrabold tracking-tight">
                    {faltan === 1 ? 'Falta un paso para operar la línea' : `Faltan ${faltan} pasos para operar la línea`}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
                    Con la primera programación, aquí verás cada día la programación, la asistencia y las novedades.
                </p>
            </header>
            <ol role="list" className="divide-y border-t">
                {lista.map((p, i) => {
                    const esSiguiente = i === siguiente;
                    const href = esSiguiente ? enlace(p.href) : null;
                    return (
                        <li
                            key={p.clave}
                            aria-current={esSiguiente ? 'step' : undefined}
                            className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
                        >
                            <span
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                                    p.listo
                                        ? 'bg-good-soft text-good'
                                        : esSiguiente
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground',
                                )}
                                aria-hidden="true"
                            >
                                {p.listo ? <Check className="size-4" /> : i + 1}
                            </span>
                            <div className="min-w-0">
                                <p className={cn('font-semibold', !p.listo && !esSiguiente && 'text-muted-foreground')}>
                                    <span className="sr-only">{`Paso ${i + 1}, ${p.listo ? 'listo' : esSiguiente ? 'el siguiente' : 'después'}: `}</span>
                                    {p.titulo}
                                </p>
                                <p className="text-muted-foreground mt-0.5 text-sm text-pretty">{p.listo ? p.hecho : p.falta}</p>
                            </div>
                            {href && (
                                <Link
                                    href={href}
                                    className={cn(
                                        claseEnlace,
                                        'col-start-2 inline-flex items-center gap-1 justify-self-start text-sm sm:col-start-3',
                                    )}
                                >
                                    {p.accion}
                                    <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/**
 * Las novedades sin cerrar más urgentes, cada una con su gravedad en texto. Cuántas son ya lo dice "Hoy"; solo sin
 * "Hoy" (mientras la línea no opera) lo dice aquí.
 */
function NovedadesSinCerrar({ novedades, conTotal }: { novedades: Novedades; conTotal: boolean }) {
    const { sinCerrar, recientes } = novedades;
    const parcial = sinCerrar > recientes.length;

    return (
        <Panel
            titulo="Novedades sin cerrar"
            descripcion={parcial ? `Las ${recientes.length} más urgentes${conTotal ? ` de ${fmt.numero(sinCerrar)}` : ''}` : undefined}
            cuerpoClassName="px-0 pb-0"
        >
            <ul role="list" className="divide-y border-t">
                {recientes.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">
                                {n.tipo}
                                {n.persona && <span className="text-muted-foreground font-normal"> · {n.persona}</span>}
                            </p>
                            <p className="text-muted-foreground text-xs text-pretty">
                                {fechaDia(n.fecha)} · {n.lugar} · {n.estado === 'abierta' ? 'Abierta' : 'En seguimiento'}
                            </p>
                        </div>
                        {n.gravedad !== 'ninguna' && (
                            <EstadoNivel nivel={n.gravedad === 'grave' ? 'critical' : 'warning'} className="shrink-0">
                                {n.gravedad === 'grave' ? 'Grave' : 'Leve'}
                            </EstadoNivel>
                        )}
                    </li>
                ))}
            </ul>
        </Panel>
    );
}

/** A qué empresas se presta la línea y con qué personal: lo que cambia poco, al final y en una franja. */
function EmpresasYPersonal({ empresas, personal, verPersonas }: { empresas: Empresa[]; personal: Props['personal']; verPersonas: string | null }) {
    return (
        <section aria-labelledby="titulo-empresas-personal" className="flex flex-col gap-3">
            <h2 id="titulo-empresas-personal" className="text-lg font-extrabold tracking-tight">
                Empresas y personal
            </h2>
            <div className={cn(claseFranja, 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
                <div className="bg-card px-5 py-4">
                    <h3 className="text-muted-foreground text-xs font-semibold">Empresas que reciben la línea</h3>
                    {empresas.length === 0 ? (
                        <p className="text-muted-foreground mt-2 text-sm">Ninguna en este momento.</p>
                    ) : (
                        <ul role="list" className="mt-1 divide-y">
                            {empresas.map((e) => (
                                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                                    <div className="min-w-0">
                                        <p className="font-semibold">{e.nombre}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {plural(e.sedes, 'sede', 'sedes')} · {plural(e.sucursales, 'sucursal', 'sucursales')} ·{' '}
                                            {plural(e.personas, 'persona', 'personas')} en esta línea
                                        </p>
                                    </div>
                                    {/* Solo se dice cuando no está activa: lo normal no se anuncia */}
                                    {!e.activo && <EstadoBadge activo={false} femenino />}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="bg-card px-5 py-4">
                    <h3 className="text-muted-foreground text-xs font-semibold">Personal con asignación vigente</h3>
                    {personal.length === 0 ? (
                        <p className="text-muted-foreground mt-2 text-sm">Nadie tiene hoy una asignación en esta línea.</p>
                    ) : (
                        <ul role="list" className="mt-1 divide-y">
                            {personal.map((p) => (
                                <li key={p.rol} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                                    <span className="min-w-0">{p.rol}</span>
                                    <span className="font-semibold tabular-nums">{fmt.numero(p.total)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {verPersonas && personal.length > 0 && (
                        <Link href={verPersonas} className={cn(claseEnlace, 'mt-2 inline-flex items-center gap-1 text-sm')}>
                            Ver las personas de la línea
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    )}
                </div>
            </div>
        </section>
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
                            <p className="text-muted-foreground text-xs text-pretty">
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
