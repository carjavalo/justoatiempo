import { EscalaSemaforo, EstadoBadge as EstadoNivel, Panel } from '@/components/dashboard/piezas';
import { AlertTriangle, CheckCircle2, Download, Info, type TipoIcono, XCircle } from '@/components/iconos';
import { FranjaHoy, type Paso, pasosDelDia, plural } from '@/components/linea/dia';
import { DialogoDescarga } from '@/components/linea/dialogo-descarga';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { NavegadorFecha } from '@/components/linea/navegador-fecha';
import { Button } from '@/components/ui/button';
import { usePuede } from '@/hooks/use-puede';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useState } from 'react';

type Asistencia = 'asistio' | 'tarde' | 'falta' | 'permiso' | 'incapacidad';

interface Persona {
    id: number;
    nombre: string;
    cargo: string | null;
    turno: string | null;
    asistencia: Asistencia | null;
    asistenciaTexto: string | null;
    llegada: string | null;
    observacion: string | null;
    novedades: string[];
    acciones: string[];
}

interface Lugar {
    lugar: string;
    /** Sin programación ese día: solo trae novedades. */
    programado: boolean;
    requeridas: number;
    programadas: number;
    presentes: number;
    faltas: number;
    sinRegistrar: number;
    cobertura: number | null;
    observaciones: string | null;
    personas: Persona[];
    novedades: { id: number; tipo: string; gravedad: string; descripcion: string; persona: string | null; estado: string }[];
}

interface Props {
    linea: { id: number; slug: string; nombre: string; icono: string | null };
    fecha: string;
    /** El hoy del servidor y la jornada más reciente hasta hoy (a la que vuelve el selector de fecha). */
    hoy: string;
    ultima: string | null;
    anterior: string | null;
    siguiente: string | null;
    /** Las cuentas del día con las reglas del tablero y la programación. */
    resumen: {
        lugares: number;
        incompletos: number;
        requeridas: number;
        necesarias: number;
        programadas: number;
        presentes: number;
        tarde: number;
        faltas: number;
        justificadas: number;
        sinRegistrar: number;
        novedades: number;
        cobertura: number | null;
    };
    lugares: Lugar[];
}

/** La asistencia registrada: dibujo y texto, nunca solo color (como en la programación). */
const ASISTENCIA: Record<Asistencia, { icono: TipoIcono; clase: string }> = {
    asistio: { icono: CheckCircle2, clase: 'text-good' },
    tarde: { icono: AlertTriangle, clase: 'text-warning' },
    falta: { icono: XCircle, clase: 'text-critical' },
    permiso: { icono: Info, clase: 'text-muted-foreground' },
    incapacidad: { icono: Info, clase: 'text-muted-foreground' },
};

/** Columnas de cada persona desde 1024 px (debajo, una persona por bloque). Escritas enteras para que Tailwind las genere. */
const COLUMNAS = 'lg:grid-cols-[minmax(0,1.2fr)_7.5rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]';

/**
 * Informe diario de una línea: arriba, el día con las mismas palabras y reglas de la programación y el tablero (la
 * cobertura se califica cuando toda la asistencia está registrada); luego, cada lugar con quién fue, su asistencia y sus
 * novedades. Se descarga en Excel con el formato del informe de la operación.
 */
export default function InformeLinea({ linea, fecha, hoy, ultima, anterior, siguiente, resumen, lugares }: Props) {
    const puede = usePuede();
    const [descargar, setDescargar] = useState(false);
    const pasos: Paso[] = [
        ...pasosDelDia(resumen, { futuro: fecha > hoy }),
        resumen.novedades > 0
            ? { clave: 'novedades', etiqueta: 'Novedades del día', valor: plural(resumen.novedades, 'novedad', 'novedades'), estado: 'atencion' }
            : { clave: 'novedades', etiqueta: 'Novedades del día', valor: 'Ninguna', estado: 'bien' },
    ];

    return (
        <MarcoLinea
            slug={linea.slug}
            nombre={linea.nombre}
            icono={linea.icono}
            titulo={`Informe diario · ${fmt.fechaMedia(fecha)}`}
            seccion="informe"
            pestanas
            acciones={
                <div className="flex flex-wrap items-center gap-2">
                    <NavegadorFecha
                        id="fecha-informe"
                        etiqueta="Jornada"
                        fecha={fecha}
                        hoy={hoy}
                        anterior={anterior}
                        siguiente={siguiente}
                        atajo={ultima ? { fecha: ultima, texto: ultima === hoy ? 'Ir a hoy' : 'Ir a la más reciente' } : null}
                        onIr={(f) => router.get(route('lineas.informe', linea.slug), { fecha: f }, { preserveScroll: true, preserveState: true })}
                    />
                    {puede('informes.descargar') && (
                        <Button variant="outline" className="bg-card h-9 rounded-lg text-xs font-semibold" onClick={() => setDescargar(true)}>
                            <Download className="size-4" aria-hidden="true" />
                            Descargar Excel
                        </Button>
                    )}
                </div>
            }
        >
            {lugares.length === 0 ? (
                // Sin ícono decorativo; la programación y las novedades están en sus pestañas
                <section aria-labelledby="sin-operacion" className="bg-card rounded-2xl border px-5 py-6 sm:px-6">
                    <h2 id="sin-operacion" className="text-lg font-extrabold tracking-tight text-balance">
                        Este día no tiene operación registrada
                    </h2>
                    <p className="text-muted-foreground mt-1 max-w-prose text-sm text-pretty">
                        El informe se arma solo con la programación del día, la asistencia de cada persona y las novedades que se registren.
                    </p>
                </section>
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <FranjaHoy titulo="Resumen de la jornada" tituloOculto pasos={pasos} />
                        {/* Qué quiere decir el estado de cada lugar, una vez (solo si alguno ya está calificado) */}
                        {lugares.some((l) => estadoLugar(l).nivel) && <EscalaSemaforo que="Cobertura de cada lugar (asistieron frente a las requeridas)" />}
                    </div>
                    {lugares.map((l, i) => (
                        <LugarInforme key={`${l.lugar}-${i}`} lugar={l} />
                    ))}
                </>
            )}

            {descargar && (
                <DialogoDescarga
                    descripcion="Con las hojas Informe Diario (cada persona programada y su asistencia), Novedades y Resumen por lugar."
                    fecha={fecha}
                    url={(desde, hasta) => route('lineas.informe.descargar', { linea: linea.slug, desde, hasta })}
                    onCerrar={() => setDescargar(false)}
                />
            )}
        </MarcoLinea>
    );
}

/** Cómo va la asistencia del lugar, con la regla de la programación: se califica cuando está toda registrada. */
function estadoLugar(l: Lugar) {
    const necesarias = l.requeridas || l.programadas;
    if (!l.programado) return { texto: 'Sin programación este día', nivel: null };
    if (l.programadas === 0) return { texto: `Sin personas programadas (${plural(l.requeridas, 'requerida', 'requeridas')})`, nivel: null };
    if (l.sinRegistrar === l.programadas) return { texto: `${plural(l.programadas, 'persona programada', 'personas programadas')} · asistencia sin registrar`, nivel: null };
    if (l.sinRegistrar > 0) return { texto: `${plural(l.presentes, 'presente', 'presentes')} · ${fmt.numero(l.sinRegistrar)} sin registrar`, nivel: null };
    return { texto: `${fmt.numero(l.presentes)} de ${plural(necesarias, 'persona asistió', 'personas asistieron')} · cobertura ${fmt.pct(l.cobertura)}`, nivel: semaforo(l.cobertura) };
}

function LugarInforme({ lugar }: { lugar: Lugar }) {
    const { texto, nivel } = estadoLugar(lugar);

    return (
        <Panel
            titulo={lugar.lugar}
            descripcion={texto}
            acciones={nivel && <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel>}
            // Sin lista que llegue al borde, el cuerpo lleva su margen inferior
            cuerpoClassName={cn(
                'flex flex-col gap-4 px-0',
                lugar.personas.length || lugar.novedades.length ? 'pb-0' : lugar.observaciones ? 'pb-5' : 'pb-1',
            )}
        >
            {lugar.observaciones && <p className="bg-muted/50 mx-5 rounded-lg px-3 py-2 text-sm">{lugar.observaciones}</p>}

            {lugar.personas.length > 0 && (
                // A sangre dentro de la tarjeta del lugar: una lista con divisiones, no otra tarjeta
                <div className="border-t">
                    <div aria-hidden="true" className={cn('text-muted-foreground hidden gap-x-4 border-b px-5 py-2 text-xs font-semibold lg:grid', COLUMNAS)}>
                        <span>Trabajador</span>
                        <span>Turno</span>
                        <span>Asistencia</span>
                        <span>Novedades</span>
                        <span>Acción</span>
                    </div>
                    <ul role="list" aria-label={`Personal de ${lugar.lugar}`} className="divide-y">
                        {lugar.personas.map((p) => (
                            <FilaPersona key={p.id} persona={p} />
                        ))}
                    </ul>
                </div>
            )}

            {lugar.novedades.length > 0 && (
                <div className={cn('px-5 pb-5', lugar.personas.length > 0 && 'border-t pt-4')}>
                    <h3 className="text-sm font-bold">{lugar.programado ? 'Otras novedades del lugar' : 'Novedades'}</h3>
                    <ul role="list" className="mt-2 grid gap-2">
                        {lugar.novedades.map((n) => (
                            <li key={n.id} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                                <span className="font-semibold">{n.tipo}</span>
                                {n.persona && <span className="text-muted-foreground"> · {n.persona}</span>}
                                <span className="text-muted-foreground"> · {n.estado}</span>
                                <p className="mt-0.5 text-pretty">{n.descripcion}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Panel>
    );
}

/**
 * Una persona del lugar. Desde 1024 px, una fila en columnas (con su encabezado a la vista); debajo, un bloque con cada
 * dato rotulado y sin las filas vacías. Los rótulos quedan para el lector de pantalla en las dos formas.
 */
function FilaPersona({ persona: p }: { persona: Persona }) {
    const vista = p.asistencia ? ASISTENCIA[p.asistencia] : null;
    const rotulo = 'text-muted-foreground lg:sr-only';

    return (
        <li className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-5 py-3.5 lg:items-start lg:gap-x-4', COLUMNAS)}>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={p.nombre}>
                    {p.nombre}
                </p>
                {p.cargo && <p className="text-muted-foreground truncate text-xs">{p.cargo}</p>}
            </div>
            <p className="justify-self-end text-sm tabular-nums lg:justify-self-start">
                <span className="sr-only">Turno: </span>
                {p.turno ?? <span className="text-muted-foreground text-xs">Sin turno</span>}
            </p>
            <div className="col-span-2 text-sm lg:col-span-1">
                <span className="sr-only">Asistencia: </span>
                {vista ? (
                    <span className={cn('inline-flex items-center gap-1.5 font-semibold', vista.clase)}>
                        <vista.icono className="size-4 shrink-0" aria-hidden="true" />
                        {p.asistenciaTexto}
                    </span>
                ) : (
                    <span className="text-muted-foreground">Sin registrar</span>
                )}
                {(p.llegada || p.observacion) && (
                    <p className="text-muted-foreground text-xs">{[p.llegada && `Llegó ${p.llegada}`, p.observacion].filter(Boolean).join(' · ')}</p>
                )}
            </div>
            {/* Sin novedad ni acción: en el teléfono no se ocupa una fila para decirlo */}
            <div className={cn('col-span-2 text-xs lg:col-span-1', p.novedades.length === 0 && 'hidden lg:block')}>
                <span className={rotulo}>Novedades: </span>
                {p.novedades.length ? (
                    p.novedades.length === 1 ? (
                        <span>{p.novedades[0]}</span>
                    ) : (
                        <ul role="list" className="grid gap-1">
                            {p.novedades.map((n) => (
                                <li key={n}>{n}</li>
                            ))}
                        </ul>
                    )
                ) : (
                    <span className="text-muted-foreground">Sin novedad</span>
                )}
            </div>
            <div className={cn('col-span-2 text-xs lg:col-span-1', p.acciones.length === 0 && 'hidden lg:block')}>
                <span className={rotulo}>Acción: </span>
                {p.acciones.length ? p.acciones.join(', ') : <span className="text-muted-foreground">—</span>}
            </div>
        </li>
    );
}
