import { AlertTriangle, ArrowRight, CheckCircle2, Info, type TipoIcono, XCircle } from '@/components/iconos';
import { aFecha, fmt, type NivelEstado, nivelFrenteAMeta, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { type ReactNode, useId } from 'react';

/** Cómo está algo: bien, conviene revisarlo, es crítico o solo se informa. Siempre con dibujo y texto, nunca solo color. */
export type Estado = 'bien' | 'atencion' | 'critico' | 'neutro';

export const ESTADO: Record<Estado, { icono: TipoIcono; clase: string }> = {
    bien: { icono: CheckCircle2, clase: 'bg-good-soft text-good' },
    atencion: { icono: AlertTriangle, clase: 'bg-warning-soft text-warning' },
    critico: { icono: XCircle, clase: 'bg-critical-soft text-critical' },
    neutro: { icono: Info, clase: 'bg-secondary text-primary' },
};
export const DEL_NIVEL: Record<NivelEstado, Estado> = { good: 'bien', warning: 'atencion', critical: 'critico' };
/** Las mismas palabras que el indicador de efectividad del tablero de la línea. */
const FRENTE_A_META: Record<NivelEstado, string> = { good: 'en meta', warning: 'cerca de la meta', critical: 'bajo la meta' };

export const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

/** "2 de oct", como en el resto del día; con el año solo si no es el de hoy. */
export function fechaDia(iso: string) {
    return aFecha(iso).getFullYear() === new Date().getFullYear() ? fmt.fechaCorta(iso) : fmt.fechaMedia(iso);
}
const cuando = (dias: number) => (dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${fmt.numero(dias)} días`);

/** Un paso del día de una línea, con su estado y, si hay a dónde ir, su enlace (uno distinto por paso). */
export interface Paso {
    clave: string;
    etiqueta: string;
    valor: string;
    estado: Estado;
    href?: string | null;
}

/** El día de logística (`DiaLogistica` en el servidor). Cada parte es null si su rol no la ve. */
export interface DiaLogistica {
    /** La última jornada cargada de Drivin; `reciente` si es de ayer (o del sábado, un lunes). */
    jornada: {
        fecha: string;
        propia: boolean;
        asignadas: number;
        efectividad: number | null;
        meta: number | null;
        dias: number;
        reciente: boolean;
        href: string | null;
    } | null;
    cargas: { porConfirmar: number; href: string } | null;
    /** Solo en el tablero de la línea: las órdenes aprobadas sin auditar de los informes abiertos. */
    porAuditar?: { ordenes: number; href: string | null } | null;
    informes: { sinCerrar: number; desde: string | null; href: string | null } | null;
}

/**
 * La programación de un día y su asistencia (`JornadaLinea::resumenDia` en el servidor). `necesarias`: las requeridas de
 * cada lugar (o sus programadas, donde no se dijo cuántas). `tarde`, donde se cuenta: presentes que llegaron tarde.
 */
export interface ResumenDia {
    lugares: number;
    incompletos: number;
    necesarias: number;
    programadas: number;
    presentes: number;
    tarde?: number;
    faltas: number;
    justificadas: number;
    sinRegistrar: number;
    cobertura: number | null;
}

/** El día de una línea sin Drivin (`DiaLinea` en el servidor). Cada parte es null si su rol no la ve. */
export interface DiaLinea {
    /** La programación de hoy y su asistencia. */
    hoy: (ResumenDia & { href: string }) | null;
    novedades: { sinCerrar: number; graves: number; href: string } | null;
}

/**
 * Los destinos que la página ya ofrece: las rutas de sus pestañas visibles y las opciones del menú lateral. Un enlace a
 * una pestaña la repite aunque lleve fecha (la pestaña abre ese mismo día o deja elegirlo); uno del menú, solo si es
 * igual (las asignaciones de una línea no son la lista general).
 */
export interface EnPantalla {
    pestanas: string[];
    menu: string[];
}

const NADA_EN_PANTALLA: EnPantalla = { pestanas: [], menu: [] };

/** El enlace de un paso, salvo que la página ya ofrezca ese destino: no se repite. */
export const sinRepetir =
    ({ pestanas, menu }: EnPantalla = NADA_EN_PANTALLA) =>
    (href: string | null | undefined) =>
        href && !menu.includes(href) && !pestanas.includes(href.split('?')[0]) ? href : null;

/**
 * El día de logística en el orden en que pasa: la jornada que llegó de Drivin, su carga, la auditoría de sus evidencias
 * y el cierre de su informe. El inicio agrega la efectividad de esa jornada; el tablero la muestra en sus indicadores.
 * `yaEnPantalla`: destinos que la página ya ofrece (p. ej. sus pestañas); esos pasos van sin enlace.
 */
export function pasosLogistica(
    dia: DiaLogistica,
    { conEfectividad, yaEnPantalla }: { conEfectividad: boolean; yaEnPantalla?: EnPantalla },
): Paso[] {
    const pasos: Paso[] = [];
    const j = dia.jornada;
    // Si el informe sin cerrar más antiguo es el de esa misma jornada, su enlace va una sola vez (en "Informes diarios")
    const mismoInforme = !!j?.href && dia.informes?.href === j.href;
    const enlace = sinRepetir(yaEnPantalla);

    if (j) {
        pasos.push(
            j.propia
                ? // La suya es cuándo trabajó: un día libre no es una carga atrasada, solo se informa
                  {
                      clave: 'jornada',
                      etiqueta: 'Tu última jornada',
                      valor: `${fechaDia(j.fecha)} (${cuando(j.dias)})`,
                      estado: 'neutro',
                      href: enlace(j.href),
                  }
                : {
                      clave: 'jornada',
                      etiqueta: 'Última jornada de Drivin',
                      valor: j.reciente
                          ? `${fechaDia(j.fecha)} (${cuando(j.dias)})`
                          : `${fechaDia(j.fecha)}, ${cuando(j.dias)}: no ha llegado otra carga`,
                      estado: j.reciente ? 'bien' : 'critico',
                      href: mismoInforme ? null : enlace(j.href),
                  },
        );
        if (conEfectividad && j.efectividad !== null) {
            const nivel = j.meta ? nivelFrenteAMeta(j.efectividad, j.meta) : null;
            pasos.push({
                clave: 'efectividad',
                etiqueta: j.reciente ? 'Efectividad' : 'Efectividad de esa jornada',
                valor: `${fmt.pct(j.efectividad)} en ${plural(j.asignadas, 'entrega', 'entregas')}${nivel && j.meta ? ` · ${FRENTE_A_META[nivel]} (${fmt.pctEntero(j.meta)})` : ''}`,
                estado: nivel ? DEL_NIVEL[nivel] : 'neutro',
            });
        }
    } else if (dia.cargas || dia.informes) {
        pasos.push({ clave: 'jornada', etiqueta: 'Última jornada de Drivin', valor: 'Aún no hay jornadas cargadas', estado: 'neutro' });
    }

    if (dia.cargas) {
        const n = dia.cargas.porConfirmar;
        pasos.push(
            n > 0
                ? {
                      clave: 'cargas',
                      etiqueta: 'Cargas de Drivin',
                      valor: `${fmt.numero(n)} por confirmar`,
                      estado: 'atencion',
                      href: enlace(dia.cargas.href),
                  }
                : { clave: 'cargas', etiqueta: 'Cargas de Drivin', valor: 'Ninguna por confirmar', estado: 'bien' },
        );
    }

    if (dia.porAuditar) {
        const n = dia.porAuditar.ordenes;
        pasos.push(
            n > 0
                ? {
                      clave: 'auditoria',
                      etiqueta: 'Auditoría POD',
                      valor: `${plural(n, 'orden aprobada', 'órdenes aprobadas')} por auditar`,
                      estado: 'atencion',
                      href: enlace(dia.porAuditar.href),
                  }
                : { clave: 'auditoria', etiqueta: 'Auditoría POD', valor: 'Nada por auditar', estado: 'bien' },
        );
    }

    if (dia.informes) {
        const { sinCerrar, desde, href } = dia.informes;
        pasos.push(
            sinCerrar > 0
                ? {
                      clave: 'informes',
                      etiqueta: 'Informes diarios',
                      valor: `${plural(sinCerrar, 'sin cerrar', 'sin cerrar')}${desde ? `, desde el ${fechaDia(desde)}` : ''}`,
                      estado: 'atencion',
                      href: enlace(href),
                  }
                : { clave: 'informes', etiqueta: 'Informes diarios', valor: 'Todos cerrados', estado: 'bien' },
        );
    }

    return pasos;
}

/**
 * La programación de un día y su asistencia, con las mismas palabras en el inicio, el tablero y la programación. La
 * asistencia solo se califica cuando está toda registrada: antes, quien no tiene registro no es una falta. Un día que
 * aún no llega no tiene asistencia que registrar (`futuro`). `deHoy` lo dice en la etiqueta (donde no hay otra fecha).
 */
export function pasosDelDia(
    h: ResumenDia,
    { deHoy = false, futuro = false, href = null }: { deHoy?: boolean; futuro?: boolean; href?: string | null } = {},
): Paso[] {
    const de = deHoy ? ' de hoy' : '';
    if (h.lugares === 0) {
        return [{ clave: 'programacion', etiqueta: `Programación${de}`, valor: 'Sin programar', estado: 'atencion', href }];
    }

    const corta = h.incompletos > 0 || h.programadas < h.necesarias;
    const pasos: Paso[] = [
        {
            clave: 'programacion',
            etiqueta: `Programación${de}`,
            valor: [
                plural(h.lugares, 'lugar', 'lugares'),
                `${fmt.numero(h.programadas)} de ${plural(h.necesarias, 'persona', 'personas')}`,
                h.incompletos > 0 && plural(h.incompletos, 'lugar incompleto', 'lugares incompletos'),
            ]
                .filter(Boolean)
                .join(' · '),
            estado: corta ? 'atencion' : 'bien',
            href,
        },
    ];

    // La asistencia se registra en la misma programación: su enlace ya está en el paso anterior
    if (futuro) {
        pasos.push({ clave: 'asistencia', etiqueta: 'Asistencia', valor: 'Se registra ese día', estado: 'neutro' });
    } else if (h.programadas > 0) {
        const noAsistieron = h.faltas + h.justificadas;
        const ausencias =
            noAsistieron > 0 &&
            `${plural(noAsistieron, 'no asistió', 'no asistieron')}${h.justificadas ? ` (${plural(h.justificadas, 'justificada', 'justificadas')})` : ''}`;
        const tarde = !!h.tarde && plural(h.tarde, 'llegó tarde', 'llegaron tarde');
        const sinRegistrar = h.sinRegistrar > 0 && `${fmt.numero(h.sinRegistrar)} sin registrar`;
        const nivel = semaforo(h.cobertura);
        pasos.push(
            h.sinRegistrar === h.programadas
                ? // Nada registrado todavía: no hay a quién calificar
                  { clave: 'asistencia', etiqueta: `Asistencia${de}`, valor: `${fmt.numero(h.sinRegistrar)} sin registrar`, estado: 'neutro' }
                : h.sinRegistrar > 0
                  ? {
                        clave: 'asistencia',
                        etiqueta: `Asistencia${de}`,
                        valor: [plural(h.presentes, 'presente', 'presentes'), tarde, ausencias, sinRegistrar].filter(Boolean).join(' · '),
                        estado: ausencias ? 'atencion' : 'neutro',
                    }
                  : // Toda registrada: se califica con el semáforo del informe, también en texto
                    {
                        clave: 'asistencia',
                        etiqueta: `Asistencia${de}`,
                        valor: [
                            `${fmt.numero(h.presentes)} de ${fmt.numero(h.necesarias)} presentes (${fmt.pct(h.cobertura)})`,
                            tarde,
                            ausencias,
                            nivel?.texto.toLowerCase(),
                        ]
                            .filter(Boolean)
                            .join(' · '),
                        estado: nivel ? DEL_NIVEL[nivel.nivel] : 'neutro',
                    },
        );
    }

    return pasos;
}

/**
 * El día de una línea sin Drivin en el orden en que pasa: la programación de hoy, su asistencia y las novedades sin
 * cerrar. `yaEnPantalla`: destinos que la página ya ofrece (p. ej. sus pestañas); esos pasos van sin enlace.
 */
export function pasosLinea(dia: DiaLinea, { yaEnPantalla }: { yaEnPantalla?: EnPantalla } = {}): Paso[] {
    const enlace = sinRepetir(yaEnPantalla);
    const pasos: Paso[] = dia.hoy ? pasosDelDia(dia.hoy, { deHoy: true, href: enlace(dia.hoy.href) }) : [];

    if (dia.novedades) {
        const { sinCerrar, graves, href } = dia.novedades;
        pasos.push(
            sinCerrar > 0
                ? {
                      clave: 'novedades',
                      etiqueta: 'Novedades',
                      valor: `${plural(sinCerrar, 'sin cerrar', 'sin cerrar')}${graves ? ` · ${plural(graves, 'grave', 'graves')}` : ''}`,
                      estado: graves ? 'critico' : 'atencion',
                      href: enlace(href),
                  }
                : { clave: 'novedades', etiqueta: 'Novedades', valor: 'Ninguna sin cerrar', estado: 'bien' },
        );
    }

    return pasos;
}

/** Columnas de "Hoy" según cuántos pasos ve: nunca queda una celda vacía. */
const COLUMNAS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'sm:grid-cols-2 xl:grid-cols-4' };

/**
 * "Hoy" en el tablero de una línea: su día, cada paso con su estado y, si hay algo que hacer allí, su enlace. En la
 * programación es el resumen del día elegido: su título queda solo para los lectores de pantalla (la fecha ya se ve).
 */
export function FranjaHoy({ pasos, titulo = 'Hoy', tituloOculto = false }: { pasos: Paso[]; titulo?: string; tituloOculto?: boolean }) {
    const id = useId();
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
            <h2 id={id} className={tituloOculto ? 'sr-only' : 'text-lg font-extrabold tracking-tight'}>
                {titulo}
            </h2>
            {/* La separación entre pasos es el fondo del borde que asoma entre celdas (gap de 1 px) */}
            <ul
                role="list"
                className={cn(
                    'bg-border grid gap-px overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-white/10 dark:bg-white/10',
                    COLUMNAS[pasos.length],
                )}
            >
                {pasos.map((p) => (
                    <Fila key={p.clave} estado={p.estado} href={p.href} className="bg-card">
                        <TextoPaso paso={p} />
                    </Fila>
                ))}
            </ul>
        </section>
    );
}

/**
 * Una fila con su estado (dibujo + texto). Con enlace, toda la fila se puede tocar y el foco es un aro de 2 px dentro
 * de ella: el mismo en el inicio y en el tablero de la línea.
 */
export function Fila({
    estado,
    href,
    describedBy,
    className,
    children,
}: {
    estado: Estado;
    href?: string | null;
    describedBy?: string;
    className?: string;
    children: ReactNode;
}) {
    const { icono: Icono, clase } = ESTADO[estado];
    return (
        <li className={cn('group has-[a:focus-visible]:ring-ring relative has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset', className)}>
            <div className={cn('flex h-full items-start gap-3 px-4 py-3', href && 'group-hover:bg-muted/40 transition-colors')}>
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', clase)}>
                    <Icono className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    {href ? (
                        // El enlace cubre toda la fila (::after)
                        <Link
                            href={href}
                            aria-describedby={describedBy}
                            className="block outline-hidden after:absolute after:inset-0 after:content-['']"
                        >
                            {children}
                        </Link>
                    ) : (
                        children
                    )}
                </div>
                {href && (
                    <ArrowRight
                        className="text-muted-foreground mt-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                    />
                )}
            </div>
        </li>
    );
}

/** El texto de un paso: qué es y cómo está. */
export function TextoPaso({ paso }: { paso: Paso }) {
    return (
        <>
            <span className="text-muted-foreground block text-xs">{paso.etiqueta}</span>{' '}
            <span className="block text-sm font-semibold text-pretty">{paso.valor}</span>
        </>
    );
}
