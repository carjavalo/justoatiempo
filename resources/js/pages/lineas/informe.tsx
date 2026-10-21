import { claseTd, claseTh, Tabla } from '@/components/admin/piezas';
import { Dato, EstadoBadge as EstadoNivel, Panel } from '@/components/dashboard/piezas';
import { CalendarDays, Download, FileSpreadsheet } from '@/components/iconos';
import { DialogoDescarga } from '@/components/linea/dialogo-descarga';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { NavegadorFecha } from '@/components/linea/navegador-fecha';
import { Button } from '@/components/ui/button';
import { usePuede } from '@/hooks/use-puede';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
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
    anterior: string | null;
    siguiente: string | null;
    resumen: {
        lugares: number;
        requeridas: number;
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

const ASISTENCIA: Record<Asistencia, string> = {
    asistio: 'text-good',
    tarde: 'text-warning',
    falta: 'text-critical',
    permiso: 'text-muted-foreground',
    incapacidad: 'text-muted-foreground',
};

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;
const claseEnlace =
    'text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden';

/**
 * Informe diario de una línea: por cada lugar programado, quién fue, su asistencia, la cobertura frente a lo requerido
 * y las novedades del día. Se descarga en Excel con el formato del informe de la operación.
 */
export default function InformeLinea({ linea, fecha, anterior, siguiente, resumen, lugares }: Props) {
    const puede = usePuede();
    const [descargar, setDescargar] = useState(false);
    const nivel = resumen.programadas > resumen.sinRegistrar ? semaforo(resumen.cobertura) : null;

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
                        anterior={anterior}
                        siguiente={siguiente}
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
                <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
                    <span className="bg-secondary text-primary flex size-16 items-center justify-center rounded-2xl">
                        <FileSpreadsheet className="size-8" aria-hidden="true" />
                    </span>
                    <h2 className="mt-5 text-lg font-extrabold tracking-tight">Este día no tiene operación registrada</h2>
                    <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                        El informe se arma con la programación del día, la asistencia de cada persona y las novedades que se registren.
                    </p>
                    {puede('programacion.ver') && (
                        <Button asChild className="mt-6 h-10 rounded-lg px-4 font-semibold">
                            <Link href={route('programacion.index', { linea: linea.slug, fecha })}>Ir a la programación</Link>
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-muted-foreground -mt-2 flex items-center gap-2 text-sm">
                        <CalendarDays className="size-4" aria-hidden="true" />
                        Operación del <strong className="text-foreground font-semibold">{fmt.fechaLarga(fecha)}</strong>
                    </p>

                    <ul role="list" aria-label="Resumen de la jornada" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Dato
                            titulo="Cobertura"
                            valor={fmt.pct(resumen.cobertura)}
                            detalle={nivel ? <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel> : 'Sin asistencia registrada'}
                        />
                        <Dato
                            titulo="Asistieron"
                            valor={`${fmt.numero(resumen.presentes)} de ${fmt.numero(resumen.requeridas || resumen.programadas)}`}
                            detalle={`${plural(resumen.lugares, 'lugar programado', 'lugares programados')}`}
                        />
                        <Dato
                            titulo="No asistieron"
                            valor={fmt.numero(resumen.faltas + resumen.justificadas)}
                            detalle={
                                [
                                    resumen.justificadas && plural(resumen.justificadas, 'justificada', 'justificadas'),
                                    resumen.tarde && plural(resumen.tarde, 'llegó tarde', 'llegaron tarde'),
                                    resumen.sinRegistrar && `${fmt.numero(resumen.sinRegistrar)} sin registrar`,
                                ]
                                    .filter(Boolean)
                                    .join(' · ') || 'Asistencia completa'
                            }
                        />
                        <Dato
                            titulo="Novedades"
                            valor={fmt.numero(resumen.novedades)}
                            detalle={
                                puede('novedades.ver') ? (
                                    <Link href={route('novedades.index', linea.slug)} className={claseEnlace}>
                                        Ver novedades
                                    </Link>
                                ) : resumen.novedades ? (
                                    'Del día'
                                ) : (
                                    'Sin novedades'
                                )
                            }
                        />
                    </ul>

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

function LugarInforme({ lugar }: { lugar: Lugar }) {
    const nivel = lugar.programadas > lugar.sinRegistrar ? semaforo(lugar.cobertura) : null;

    return (
        <Panel
            titulo={lugar.lugar}
            descripcion={
                lugar.programado
                    ? `${lugar.presentes} de ${plural(lugar.requeridas || lugar.programadas, 'persona', 'personas')} asistieron · cobertura ${fmt.pct(lugar.cobertura)}`
                    : 'Sin programación este día'
            }
            acciones={nivel && <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel>}
            cuerpoClassName="flex flex-col gap-3"
        >
            {lugar.observaciones && <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">{lugar.observaciones}</p>}

            {lugar.personas.length > 0 && (
                <Tabla titulo={`Personal de ${lugar.lugar}`} minimo="min-w-[760px]" columnas={['28%', '13%', '19%', '25%', '15%']}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            <th scope="col" className={claseTh}>
                                Trabajador
                            </th>
                            <th scope="col" className={claseTh}>
                                Turno
                            </th>
                            <th scope="col" className={claseTh}>
                                Asistencia
                            </th>
                            <th scope="col" className={claseTh}>
                                Novedades
                            </th>
                            <th scope="col" className={claseTh}>
                                Acción
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {lugar.personas.map((p) => (
                            <tr key={p.id} className="align-top">
                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                    <p className="truncate font-semibold" title={p.nombre}>
                                        {p.nombre}
                                    </p>
                                    {p.cargo && <p className="text-muted-foreground truncate text-xs">{p.cargo}</p>}
                                </th>
                                <td className={cn(claseTd, 'tabular-nums')}>
                                    {p.turno ?? <span className="text-muted-foreground text-xs">Sin turno</span>}
                                </td>
                                <td className={claseTd}>
                                    <p className={cn('font-semibold', p.asistencia ? ASISTENCIA[p.asistencia] : 'text-muted-foreground font-normal')}>
                                        {p.asistenciaTexto ?? 'Sin registrar'}
                                    </p>
                                    {(p.llegada || p.observacion) && (
                                        <p className="text-muted-foreground text-xs">
                                            {[p.llegada && `Llegó ${p.llegada}`, p.observacion].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-xs')}>
                                    {p.novedades.length ? (
                                        <ul role="list" className="grid gap-1">
                                            {p.novedades.map((n) => (
                                                <li key={n}>{n}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-muted-foreground">Sin novedad</span>
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-xs')}>
                                    {p.acciones.length ? p.acciones.join(', ') : <span className="text-muted-foreground">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Tabla>
            )}

            {lugar.novedades.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold">{lugar.programado ? 'Otras novedades del lugar' : 'Novedades'}</h3>
                    <ul role="list" className="mt-2 grid gap-2">
                        {lugar.novedades.map((n) => (
                            <li key={n.id} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                                <span className="font-semibold">{n.tipo}</span>
                                {n.persona && <span className="text-muted-foreground"> · {n.persona}</span>}
                                <span className="text-muted-foreground"> · {n.estado}</span>
                                <p className="mt-0.5">{n.descripcion}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Panel>
    );
}
