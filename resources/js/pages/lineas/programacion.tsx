import { Campo } from '@/components/admin/campo';
import { Panel } from '@/components/dashboard/piezas';
import { DialogoFormulario } from '@/components/dialogo-formulario';
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    CheckCircle2,
    ChevronDown,
    Info,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    Undo2,
    UserCheck,
    XCircle,
} from '@/components/iconos';
import InputError from '@/components/input-error';
import { fechaDia, FranjaHoy, pasosDelDia, plural } from '@/components/linea/dia';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { NavegadorFecha } from '@/components/linea/navegador-fecha';
import { type OpcionSelector, Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePuede } from '@/hooks/use-puede';
import { aFecha, fmt } from '@/lib/formato';
import { propsCampo } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

type Asistencia = 'asistio' | 'tarde' | 'falta' | 'permiso' | 'incapacidad';

interface Persona {
    id: number;
    userId: number;
    nombre: string;
    detalle: string;
    entrada: string | null;
    salida: string | null;
    vehiculoId: number | null;
    placa: string | null;
    ruta: string | null;
    asistencia: Asistencia | null;
    llegada: string | null;
    observacion: string | null;
    registradaPor: string | null;
    /** También programada ese día en otro lugar. */
    otrosLugares: string[];
}

interface Candidato {
    id: number;
    nombre: string;
    detalle: string;
    otrosLugares: string[];
    /** Dónde está su asignación (en las personas de toda la línea). */
    asignadaEn?: string;
}

interface Lugar {
    id: number;
    lugar: string;
    clave: string;
    requeridas: number;
    vehiculos: number;
    observaciones: string | null;
    presentes: number;
    personas: Persona[];
    candidatos: Candidato[];
}

interface Props {
    linea: { id: number; slug: string; nombre: string; icono: string | null; logistica: boolean };
    fecha: string;
    /** El hoy del servidor: el selector de fecha lo nombra y ofrece volver a él. */
    hoy: string;
    esFutura: boolean;
    filtros: { lugar: string };
    lugares: OpcionSelector[];
    programaciones: Lugar[];
    /** Todas las personas de la línea ese día: se pueden programar en cualquier lugar, no solo donde están asignadas. */
    personasLinea: Candidato[];
    /** Las cuentas del día con las mismas reglas del tablero y el inicio, sobre lo que se ve. */
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
        cobertura: number | null;
    };
    copiarDe: string | null;
    estados: { valor: Asistencia; texto: string }[];
    vehiculos: OpcionSelector[];
}

/** Lo que se marca de un toque; permiso e incapacidad, menos frecuentes, quedan en "Otra". Mismos colores que el resto. */
const DIRECTAS: { valor: Asistencia; texto: string; icono: typeof CheckCircle2; marcada: string }[] = [
    { valor: 'asistio', texto: 'Asistió', icono: CheckCircle2, marcada: 'bg-good-soft text-good' },
    { valor: 'tarde', texto: 'Tarde', icono: AlertTriangle, marcada: 'bg-warning-soft text-warning' },
    { valor: 'falta', texto: 'No asistió', icono: XCircle, marcada: 'bg-critical-soft text-critical' },
];
const OTRAS: Asistencia[] = ['permiso', 'incapacidad'];

/** Cómo se ve la asistencia ya registrada para quien no la registra: dibujo y texto, nunca solo color. */
const VISTA: Record<Asistencia, { icono: typeof CheckCircle2; clase: string }> = {
    asistio: { icono: CheckCircle2, clase: 'text-good' },
    tarde: { icono: AlertTriangle, clase: 'text-warning' },
    falta: { icono: XCircle, clase: 'text-critical' },
    permiso: { icono: Info, clase: 'text-muted-foreground' },
    incapacidad: { icono: Info, clase: 'text-muted-foreground' },
};

/**
 * Columnas de cada persona desde 1280 px: persona · turno · (vehículo y ruta) · asistencia (no en un día que aún no
 * llega) · quitar. Escritas enteras para que Tailwind las genere.
 */
const COLUMNAS = {
    linea: 'xl:grid-cols-[minmax(0,1fr)_8.5rem_19.5rem_2rem]',
    lineaFutura: 'xl:grid-cols-[minmax(0,1fr)_8.5rem_2rem]',
    logistica: 'xl:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,0.9fr)_19.5rem_2rem]',
    logisticaFutura: 'xl:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,0.9fr)_2rem]',
};

const turno = (p: { entrada: string | null; salida: string | null }) => (p.entrada ? `${p.entrada}${p.salida ? ` a ${p.salida}` : ''}` : null);

function sumarDias(iso: string, dias: number): string {
    const d = aFecha(iso);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Programación diaria de una línea: en cada empresa, sede o sucursal, cuántas personas se requieren, quiénes van (con
 * su turno y, en logística, su vehículo y su ruta) y si asistieron. Arriba, el día en dos pasos: completar la
 * programación y registrar la asistencia, con las mismas palabras y reglas del tablero y el inicio.
 */
export default function Programacion({
    linea,
    fecha,
    hoy,
    esFutura,
    filtros,
    lugares,
    programaciones,
    personasLinea,
    resumen,
    copiarDe,
    estados,
    vehiculos,
}: Props) {
    const puede = usePuede();
    const editar = puede('programacion.editar');
    const registrar = puede('programacion.asistencia') && !esFutura;
    const [nuevo, setNuevo] = useState<{ lugar: string } | null>(null);
    const [editando, setEditando] = useState<Lugar | null>(null);
    const [agregando, setAgregando] = useState<Lugar | null>(null);
    const [turnoDe, setTurnoDe] = useState<Persona | null>(null);
    const [detalleDe, setDetalleDe] = useState<Persona | null>(null);
    const [quitando, setQuitando] = useState<{ titulo: string; texto: string; url: string } | null>(null);
    const [moviendo, setMoviendo] = useState<{ persona: Persona; desde: Lugar } | null>(null);
    const asistencia = useColaAsistencia();

    const ir = (cambios: { fecha?: string; lugar?: string }) => {
        const params = { fecha: cambios.fecha ?? fecha, lugar: cambios.lugar !== undefined ? cambios.lugar : filtros.lugar };
        router.get(route('programacion.index', linea.slug), Object.fromEntries(Object.entries(params).filter(([, v]) => v)), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const copiar = () => copiarDe && router.post(route('programacion.copiar', linea.slug), { desde: copiarDe, fecha }, { preserveScroll: true });

    // Además de quienes trabajan en cada lugar, cualquiera de la línea que aún no esté programado allí
    const otrasDe = (l: Lugar) => personasLinea.filter((c) => !l.candidatos.some((x) => x.id === c.id) && !l.personas.some((x) => x.userId === c.id));

    const programados = new Set(programaciones.map((p) => p.clave));
    // Sin programación, los lugares que se pueden programar (el filtrado, si se eligió uno)
    const porProgramar = lugares.filter((l) => !programados.has(l.valor) && (!filtros.lugar || l.valor === filtros.lugar));

    return (
        <MarcoLinea
            slug={linea.slug}
            nombre={linea.nombre}
            icono={linea.icono}
            titulo={`Programación · ${fmt.fechaMedia(fecha)}`}
            seccion="programacion"
            pestanas
            acciones={
                <div className="flex flex-wrap items-center gap-2">
                    <NavegadorFecha
                        id="fecha-programacion"
                        etiqueta="Día"
                        fecha={fecha}
                        hoy={hoy}
                        anterior={sumarDias(fecha, -1)}
                        siguiente={sumarDias(fecha, 1)}
                        atajo={{ fecha: hoy, texto: 'Ir a hoy' }}
                        onIr={(f) => ir({ fecha: f })}
                    />
                    {lugares.length > 1 && (
                        <div className="w-full sm:w-60">
                            <label htmlFor="filtro-lugar" className="sr-only">
                                Lugar
                            </label>
                            <Selector
                                id="filtro-lugar"
                                valor={filtros.lugar}
                                onCambio={(v) => ir({ lugar: v })}
                                className="bg-card h-9 text-xs font-semibold"
                                opciones={[{ valor: '', texto: 'Todos los lugares' }, ...lugares]}
                            />
                        </div>
                    )}
                    {/* Sin programación, cada lugar se programa desde la lista del día vacío */}
                    {editar && programaciones.length > 0 && (
                        <>
                            <Button className="h-9 rounded-lg text-xs font-semibold" onClick={() => setNuevo({ lugar: '' })}>
                                <Plus className="size-4" aria-hidden="true" />
                                Programar un lugar
                            </Button>
                            <Button
                                variant="outline"
                                className="text-critical hover:text-critical h-9 rounded-lg text-xs font-semibold"
                                onClick={() =>
                                    setQuitando({
                                        titulo: `¿Quitar la programación del ${fechaDia(fecha)}?`,
                                        texto: 'Se quitan todos los lugares de este día con sus personas, para programarlo desde cero o copiar otro día. No se borra nada: la asistencia registrada queda en el historial, con quién y cuándo se quitó.',
                                        url: route('programacion.dia.destroy', { linea: linea.slug, fecha }),
                                    })
                                }
                            >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Quitar el día
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            {lugares.length === 0 ? (
                <DiaVacio
                    titulo="Aún no hay dónde programar"
                    texto="Esta línea no tiene empresas activas que la reciban dentro de lo que ves. Márcala en el formulario de la empresa."
                />
            ) : programaciones.length === 0 ? (
                <DiaVacio
                    titulo="Este día aún no tiene programación"
                    texto={
                        !editar
                            ? 'Cuando se programe, aquí verás quién va a cada lugar y su asistencia.'
                            : copiarDe
                              ? `Copia la del ${fechaDia(copiarDe)} (lugares, personas y turnos, sin la asistencia) o programa cada lugar.`
                              : 'Programa cada lugar con cuántas personas requiere; después agregas a quienes van y su turno.'
                    }
                    accion={
                        editar &&
                        copiarDe && (
                            <Button className="h-10 rounded-lg px-4 font-semibold" onClick={copiar}>
                                Copiar la del {fechaDia(copiarDe)}
                            </Button>
                        )
                    }
                    lugares={editar ? porProgramar : []}
                    onProgramar={(clave) => setNuevo({ lugar: clave })}
                />
            ) : (
                <>
                    <FranjaHoy titulo="Resumen del día" tituloOculto pasos={pasosDelDia(resumen, { futuro: esFutura })} />

                    {editar && copiarDe && lugares.some((l) => !programados.has(l.valor)) && (
                        <p className="text-muted-foreground -mt-2 text-sm">
                            ¿Faltan lugares?{' '}
                            <button
                                type="button"
                                onClick={copiar}
                                className="text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                            >
                                Copiar los del {fechaDia(copiarDe)}
                            </button>{' '}
                            (solo los que aún no están programados).
                        </p>
                    )}

                    {programaciones.map((p) => (
                        <LugarProgramado
                            key={p.id}
                            lugar={p}
                            logistica={linea.logistica}
                            estados={estados}
                            editar={editar}
                            registrar={registrar}
                            futuro={esFutura}
                            asistencia={asistencia}
                            otras={otrasDe(p).length}
                            hayOtrosLugares={programaciones.length > 1}
                            onEditar={() => setEditando(p)}
                            onAgregar={() => setAgregando(p)}
                            onTurno={setTurnoDe}
                            onDetalle={setDetalleDe}
                            onMover={(persona) => setMoviendo({ persona, desde: p })}
                            onQuitarPersona={(persona) =>
                                setQuitando({
                                    titulo: `¿Quitar a ${persona.nombre}?`,
                                    texto: `Ya no estará en la programación de ${p.lugar} este día. Si tenía asistencia, queda en el historial.`,
                                    url: route('programacion.personas.destroy', persona.id),
                                })
                            }
                            onQuitar={() =>
                                setQuitando({
                                    titulo: `¿Quitar la programación de ${p.lugar}?`,
                                    texto: 'Se quitan también las personas programadas allí este día. No se borra nada: la asistencia registrada queda en el historial.',
                                    url: route('programacion.destroy', p.id),
                                })
                            }
                        />
                    ))}
                </>
            )}

            {nuevo && (
                <DialogoLugar
                    linea={linea}
                    fecha={fecha}
                    elegido={nuevo.lugar}
                    lugares={lugares.map((l) => ({
                        ...l,
                        deshabilitada: programados.has(l.valor),
                        detalle: programados.has(l.valor) ? 'Ya está programado' : l.detalle,
                    }))}
                    onCerrar={() => setNuevo(null)}
                    // Programado el lugar, lo que sigue es elegir a quienes van
                    onProgramado={(p) => (p.candidatos.length > 0 || personasLinea.length > 0) && setAgregando(p)}
                />
            )}
            {editando && <DialogoLugar linea={linea} fecha={fecha} lugar={editando} onCerrar={() => setEditando(null)} />}
            {agregando && <DialogoPersonas lugar={agregando} otras={otrasDe(agregando)} onCerrar={() => setAgregando(null)} />}
            {moviendo && (
                <DialogoMover
                    persona={moviendo.persona}
                    desde={moviendo.desde}
                    destinos={programaciones.filter((x) => x.id !== moviendo.desde.id)}
                    onCerrar={() => setMoviendo(null)}
                />
            )}
            {turnoDe && <DialogoTurno persona={turnoDe} logistica={linea.logistica} vehiculos={vehiculos} onCerrar={() => setTurnoDe(null)} />}
            {detalleDe && <DialogoAsistencia persona={detalleDe} estados={estados} onCerrar={() => setDetalleDe(null)} />}
            {quitando && <Confirmar {...quitando} onCerrar={() => setQuitando(null)} />}
        </MarcoLinea>
    );
}

/**
 * Los registros de asistencia van uno tras otro (una visita de Inertia cancela la anterior: con varios toques seguidos
 * se perdería alguno). Mientras se guardan, cada persona muestra ya lo que se marcó.
 */
function useColaAsistencia() {
    const cola = useRef(Promise.resolve());
    const [pendientes, setPendientes] = useState<Record<number, Asistencia | ''>>({});

    const enviar = useCallback(
        (url: string, datos: Record<string, string | null>, metodo: 'patch' | 'post', marcas: Record<number, Asistencia | ''>) => {
            setPendientes((antes) => ({ ...antes, ...marcas }));
            cola.current = cola.current.then(
                () =>
                    new Promise<void>((listo) =>
                        router[metodo](url, datos, {
                            preserveScroll: true,
                            // Conserva el foco y lo abierto: se registra a una persona tras otra sin perder el sitio
                            preserveState: true,
                            onFinish: () => {
                                setPendientes((antes) => {
                                    const resto = { ...antes };
                                    Object.keys(marcas).forEach((id) => delete resto[Number(id)]);
                                    return resto;
                                });
                                listo();
                            },
                        }),
                    ),
            );
        },
        [],
    );

    return {
        pendientes,
        marcar: (p: Persona, valor: Asistencia | '') =>
            enviar(
                route('programacion.asistencia', p.id),
                { asistencia: valor || null, hora_llegada: p.llegada, observacion: p.observacion },
                'patch',
                { [p.id]: valor },
            ),
        todos: (lugar: Lugar) =>
            enviar(
                route('programacion.asistencia.todos', lugar.id),
                {},
                'post',
                Object.fromEntries(lugar.personas.filter((p) => !p.asistencia).map((p) => [p.id, 'asistio'])),
            ),
    };
}

type Cola = ReturnType<typeof useColaAsistencia>;

/** Un día sin programación: qué falta y, para quien programa, cada lugar listo para programar. Sin ícono decorativo. */
function DiaVacio({
    titulo,
    texto,
    accion,
    lugares = [],
    onProgramar,
}: {
    titulo: string;
    texto: string;
    accion?: ReactNode;
    lugares?: OpcionSelector[];
    onProgramar?: (clave: string) => void;
}) {
    return (
        <section aria-labelledby="dia-vacio" className="bg-card overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="px-5 py-6 sm:px-6">
                <h2 id="dia-vacio" className="text-lg font-extrabold tracking-tight text-balance">
                    {titulo}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-prose text-sm text-pretty">{texto}</p>
                {accion && <div className="mt-5">{accion}</div>}
            </div>
            {lugares.length > 0 && onProgramar && (
                <>
                    <h3 className="text-muted-foreground border-t px-5 pt-4 pb-1 text-xs font-semibold sm:px-6">
                        {lugares.length === 1 ? 'Lugar por programar' : `${fmt.numero(lugares.length)} lugares por programar`}
                    </h3>
                    <ul role="list" className="divide-y">
                        {lugares.map((l) => (
                            <li key={l.valor} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold" title={l.texto}>
                                        {l.texto}
                                    </span>
                                    {l.detalle && <span className="text-muted-foreground block truncate text-xs">{l.detalle}</span>}
                                </span>
                                <Button
                                    variant="outline"
                                    className="h-9 shrink-0 rounded-lg text-xs font-semibold"
                                    onClick={() => onProgramar(l.valor)}
                                >
                                    <Plus className="size-4" aria-hidden="true" />
                                    Programar
                                    <span className="sr-only"> {l.texto}</span>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

function LugarProgramado({
    lugar,
    logistica,
    estados,
    editar,
    registrar,
    futuro,
    asistencia,
    otras,
    hayOtrosLugares,
    onEditar,
    onAgregar,
    onTurno,
    onDetalle,
    onMover,
    onQuitarPersona,
    onQuitar,
}: {
    lugar: Lugar;
    /** Cuántas personas de la línea, de otros lugares, se pueden agregar. */
    otras: number;
    /** Si ese día hay otro lugar programado al que pasar a alguien. */
    hayOtrosLugares: boolean;
    onMover: (p: Persona) => void;
    logistica: boolean;
    estados: Props['estados'];
    editar: boolean;
    registrar: boolean;
    futuro: boolean;
    asistencia: Cola;
    onEditar: () => void;
    onAgregar: () => void;
    onTurno: (p: Persona) => void;
    onDetalle: (p: Persona) => void;
    onQuitarPersona: (p: Persona) => void;
    onQuitar: () => void;
}) {
    const faltan = Math.max(0, lugar.requeridas - lugar.personas.length);
    const lista = useRef<HTMLUListElement>(null);
    const sinRegistro = lugar.personas.filter((p) => !p.asistencia && asistencia.pendientes[p.id] === undefined);
    const marcarTodos = registrar && sinRegistro.length > 0;
    // El orden lo deja quien programa: se sube o se baja a una persona y se guarda el orden del lugar
    const ordenar = (desde: number, hacia: number) => {
        const ids = lugar.personas.map((p) => p.id);
        const [movida] = ids.splice(desde, 1);
        ids.splice(hacia, 0, movida);
        router.patch(route('programacion.orden', lugar.id), { personas: ids }, { preserveScroll: true, preserveState: true });
    };

    // Marcar presentes a quienes faltan por registrar: arriba desde 640 px; en el teléfono, al pie del lugar (a lo ancho
    // y a mano del pulgar, después de marcar las excepciones). Se muestra uno solo: el otro queda oculto del todo
    const botonTodos = (clase: string) => (
        <Button
            variant="outline"
            className={cn('rounded-lg text-xs font-semibold', clase)}
            onClick={() => {
                asistencia.todos(lugar);
                // Marcadas todas, el botón se va: el foco sigue en la primera persona del lugar, no se pierde
                requestAnimationFrame(() => {
                    if (document.activeElement === document.body) {
                        lista.current?.querySelector<HTMLButtonElement>('[role=toolbar] [tabindex="0"]')?.focus();
                    }
                });
            }}
        >
            <UserCheck className="size-4" aria-hidden="true" />
            {sinRegistro.length === 1
                ? `Marcar presente a ${sinRegistro[0].nombre.split(' ')[0]}`
                : `Marcar presentes a las ${fmt.numero(sinRegistro.length)} sin registrar`}
        </Button>
    );
    const columnas = COLUMNAS[`${logistica ? 'logistica' : 'linea'}${futuro ? 'Futura' : ''}`];

    return (
        <Panel
            titulo={lugar.lugar}
            descripcion={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                        {lugar.requeridas
                            ? `${lugar.personas.length} de ${plural(lugar.requeridas, 'persona requerida', 'personas requeridas')}`
                            : plural(lugar.personas.length, 'persona programada', 'personas programadas')}
                        {logistica && lugar.vehiculos > 0 && ` · ${plural(lugar.vehiculos, 'vehículo', 'vehículos')}`}
                    </span>
                    {faltan > 0 && (
                        <span className="text-warning inline-flex items-center gap-1 font-semibold">
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            {faltan === 1 ? 'Falta 1 por programar' : `Faltan ${faltan} por programar`}
                        </span>
                    )}
                </span>
            }
            acciones={
                <>
                    {marcarTodos && botonTodos('hidden h-8 sm:inline-flex')}
                    {editar && (
                        <>
                            <Button
                                variant="ghost"
                                className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                                onClick={onEditar}
                                aria-label={`Editar la programación de ${lugar.lugar}`}
                            >
                                Editar
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-critical size-8 rounded-lg"
                                onClick={onQuitar}
                                aria-label={`Quitar la programación de ${lugar.lugar}`}
                            >
                                <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                        </>
                    )}
                </>
            }
            cuerpoClassName="flex flex-col gap-4 px-0 pb-0"
        >
            {lugar.observaciones && <p className="bg-muted/50 mx-5 rounded-lg px-3 py-2 text-sm">{lugar.observaciones}</p>}

            {lugar.personas.length === 0 ? (
                <p className={cn('text-muted-foreground px-5 text-sm', !editar && 'pb-5')}>Aún no hay personas programadas aquí.</p>
            ) : (
                // A sangre dentro de la tarjeta del lugar: una lista con divisiones, no otra tarjeta
                <div className="border-t">
                    <div
                        aria-hidden="true"
                        className={cn('text-muted-foreground hidden gap-x-4 border-b px-5 py-2 text-xs font-semibold xl:grid', columnas)}
                    >
                        <span>Persona</span>
                        <span>Turno</span>
                        {logistica && <span>Vehículo y ruta</span>}
                        {!futuro && <span>Asistencia</span>}
                        <span />
                    </div>
                    <ul ref={lista} role="list" aria-label={`Personas programadas en ${lugar.lugar}`} className="divide-y">
                        {lugar.personas.map((p, i) => (
                            <FilaPersona
                                key={p.id}
                                persona={p}
                                onSubir={i > 0 ? () => ordenar(i, i - 1) : undefined}
                                onBajar={i < lugar.personas.length - 1 ? () => ordenar(i, i + 1) : undefined}
                                onMover={hayOtrosLugares ? () => onMover(p) : undefined}
                                columnas={columnas}
                                logistica={logistica}
                                estados={estados}
                                editar={editar}
                                registrar={registrar}
                                futuro={futuro}
                                asistencia={asistencia}
                                onTurno={() => onTurno(p)}
                                onDetalle={() => onDetalle(p)}
                                onQuitar={() => onQuitarPersona(p)}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {(editar || marcarTodos) && (
                <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pb-5', lugar.personas.length > 0 && 'border-t pt-4')}>
                    {marcarTodos && botonTodos('h-10 w-full sm:hidden')}
                    {editar && (
                        <Button
                            variant="outline"
                            className="h-9 rounded-lg text-xs font-semibold"
                            onClick={onAgregar}
                            disabled={lugar.candidatos.length === 0 && otras === 0}
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            Agregar personas
                        </Button>
                    )}
                    {editar && lugar.candidatos.length === 0 && otras === 0 && (
                        <span className="text-muted-foreground text-xs">Ya están aquí todas las personas de la línea.</span>
                    )}
                </div>
            )}
        </Panel>
    );
}

/**
 * Una persona programada. Desde 1280 px, una fila en columnas; debajo, apilada: nombre y turno arriba, la asistencia a
 * lo ancho (en el teléfono, sin desplazar nada de lado). El turno se cambia tocando la hora.
 */
function FilaPersona({
    persona: p,
    columnas,
    logistica,
    estados,
    editar,
    registrar,
    futuro,
    asistencia,
    onTurno,
    onDetalle,
    onQuitar,
    onSubir,
    onBajar,
    onMover,
}: {
    persona: Persona;
    /** Sin función, no se ofrece (la primera no sube, la última no baja, sin otro lugar no se mueve). */
    onSubir?: () => void;
    onBajar?: () => void;
    onMover?: () => void;
    columnas: string;
    logistica: boolean;
    estados: Props['estados'];
    editar: boolean;
    registrar: boolean;
    futuro: boolean;
    asistencia: Cola;
    onTurno: () => void;
    onDetalle: () => void;
    onQuitar: () => void;
}) {
    const horas = turno(p);
    const valor = asistencia.pendientes[p.id] !== undefined ? asistencia.pendientes[p.id] || null : p.asistencia;
    const texto = (v: Asistencia) => estados.find((e) => e.valor === v)?.texto ?? v;

    return (
        <li className={cn('grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-3 gap-y-2.5 px-5 py-3.5 xl:items-center xl:gap-x-4', columnas)}>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={p.nombre}>
                    {p.nombre}
                </p>
                {p.detalle && <p className="text-muted-foreground truncate text-xs">{p.detalle}</p>}
                {p.otrosLugares.length > 0 && (
                    <p className="text-warning mt-0.5 flex items-start gap-1 text-xs font-medium">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                        También en {p.otrosLugares.join(', ')}
                    </p>
                )}
            </div>

            <div className="justify-self-end xl:justify-self-start">
                {editar ? (
                    <button
                        type="button"
                        onClick={onTurno}
                        className="group/turno hover:bg-muted focus-visible:ring-ring -mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                    >
                        {horas ?? <span className="text-muted-foreground text-xs">Sin turno</span>}
                        <span className="sr-only">
                            : cambiar el turno{logistica ? ' y el vehículo' : ''} de {p.nombre}
                        </span>
                        {/* La hora se toca para cambiarla: el lápiz lo dice sin pesar en cada fila */}
                        <Pencil
                            className="text-muted-foreground size-3.5 shrink-0 opacity-60 transition-opacity group-hover/turno:opacity-100"
                            aria-hidden="true"
                        />
                    </button>
                ) : (
                    <span className="text-sm tabular-nums">{horas ?? <span className="text-muted-foreground text-xs">Sin turno</span>}</span>
                )}
            </div>

            {logistica && (
                <div className="col-span-3 min-w-0 xl:col-span-1">
                    {p.placa || p.ruta ? (
                        <>
                            <p className="font-mono text-sm font-semibold">{p.placa ?? 'Sin vehículo'}</p>
                            {p.ruta && (
                                <p className="text-muted-foreground truncate text-xs" title={p.ruta}>
                                    {p.ruta}
                                </p>
                            )}
                        </>
                    ) : (
                        <span className="text-muted-foreground text-xs">Sin vehículo asignado</span>
                    )}
                </div>
            )}

            {!futuro && (
                <div className="col-span-3 flex min-w-0 flex-col items-start gap-1 xl:col-span-1">
                    {registrar ? (
                        <ControlAsistencia
                            persona={p}
                            valor={valor}
                            guardando={asistencia.pendientes[p.id] !== undefined}
                            texto={texto}
                            onMarcar={(v) => asistencia.marcar(p, v)}
                            onObservacion={onDetalle}
                        />
                    ) : valor ? (
                        <EstadoAsistencia valor={valor} texto={texto(valor)} />
                    ) : (
                        <span className="text-muted-foreground text-sm">Sin registrar</span>
                    )}
                    {(p.llegada || p.observacion || (registrar && p.asistencia && p.asistencia !== 'asistio')) && (
                        <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-xs">
                            {(p.llegada || p.observacion) && (
                                <span>{[p.llegada && `Llegó ${p.llegada}`, p.observacion].filter(Boolean).join(' · ')}</span>
                            )}
                            {registrar && p.asistencia && (p.asistencia !== 'asistio' || p.llegada || p.observacion) && (
                                <button
                                    type="button"
                                    onClick={onDetalle}
                                    className="text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                >
                                    {p.llegada || p.observacion
                                        ? 'Cambiar'
                                        : p.asistencia === 'tarde'
                                          ? 'Anotar la hora de llegada'
                                          : 'Añadir una observación'}
                                    <span className="sr-only">
                                        {p.llegada || p.observacion ? ' la observación' : ''} de {p.nombre}
                                    </span>
                                </button>
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* Arriba a la derecha cuando va apilada; al final de la fila en columnas */}
            <div className="col-start-3 row-start-1 flex w-8 justify-end xl:col-start-auto xl:row-start-auto">
                {editar && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground -my-1 size-8 rounded-lg">
                                <MoreHorizontal className="size-5" aria-hidden="true" />
                                <span className="sr-only">Más acciones para {p.nombre}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                            {onSubir && (
                                <DropdownMenuItem onSelect={onSubir} className="gap-2">
                                    <ArrowUp className="size-4" aria-hidden="true" />
                                    Subir en la lista
                                </DropdownMenuItem>
                            )}
                            {onBajar && (
                                <DropdownMenuItem onSelect={onBajar} className="gap-2">
                                    <ArrowDown className="size-4" aria-hidden="true" />
                                    Bajar en la lista
                                </DropdownMenuItem>
                            )}
                            {onMover && (
                                <DropdownMenuItem onSelect={onMover} className="gap-2">
                                    <ArrowRight className="size-4" aria-hidden="true" />
                                    Pasar a otro lugar
                                </DropdownMenuItem>
                            )}
                            {(onSubir || onBajar || onMover) && <DropdownMenuSeparator />}
                            <DropdownMenuItem onSelect={onQuitar} className="text-critical focus:text-critical gap-2">
                                <Trash2 className="size-4" aria-hidden="true" />
                                Quitar de la programación
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </li>
    );
}

/**
 * La asistencia de un toque: Asistió, Tarde y No asistió a la vista; permiso e incapacidad en "Otra". Es una barra de
 * herramientas: una sola parada de tabulación por persona y las flechas recorren las opciones (sin marcar nada hasta
 * Enter o Espacio, porque cada marca se guarda).
 */
function ControlAsistencia({
    persona,
    valor,
    guardando,
    texto,
    onMarcar,
    onObservacion,
}: {
    persona: Persona;
    valor: Asistencia | null;
    guardando: boolean;
    texto: (v: Asistencia) => string;
    onMarcar: (v: Asistencia | '') => void;
    /** Abre la observación (con "Asistió" sin observación, desde el menú: no hace falta a la vista en cada fila). */
    onObservacion: () => void;
}) {
    const barra = useRef<HTMLDivElement>(null);
    const otra = valor && OTRAS.includes(valor) ? valor : null;
    const marcadaEn = valor ? (otra ? DIRECTAS.length : DIRECTAS.findIndex((d) => d.valor === valor)) : 0;
    const [enfocada, setEnfocada] = useState<number | null>(null);
    const parada = enfocada ?? marcadaEn;

    const mover = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        const botones = Array.from(barra.current?.querySelectorAll<HTMLButtonElement>('[data-opcion]') ?? []);
        const i = botones.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        const j =
            e.key === 'Home' ? 0 : e.key === 'End' ? botones.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length;
        botones[j].focus();
    };

    const boton =
        'focus-visible:ring-ring flex h-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:h-8 sm:flex-none sm:px-2.5';
    const libre = 'text-muted-foreground hover:bg-muted hover:text-foreground';
    // La marcada se distingue también sin color: relleno, borde, dibujo y negrita
    const marcada = 'font-bold ring-1 ring-current/25 ring-inset';

    return (
        <div
            ref={barra}
            role="toolbar"
            aria-label={`Asistencia de ${persona.nombre}`}
            aria-busy={guardando || undefined}
            onKeyDown={mover}
            className="bg-background flex w-full gap-0.5 rounded-lg border p-0.5 sm:w-auto xl:w-full"
        >
            {DIRECTAS.map((d, i) => (
                <button
                    key={d.valor}
                    type="button"
                    data-opcion
                    tabIndex={parada === i ? 0 : -1}
                    aria-pressed={valor === d.valor}
                    onFocus={() => setEnfocada(i)}
                    onBlur={() => setEnfocada(null)}
                    onClick={() => valor !== d.valor && onMarcar(d.valor)}
                    className={cn(boton, 'xl:flex-1', valor === d.valor ? cn(d.marcada, marcada) : libre)}
                >
                    {valor === d.valor && <d.icono className="size-3.5 shrink-0" aria-hidden="true" />}
                    {d.texto}
                </button>
            ))}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        data-opcion
                        tabIndex={parada === DIRECTAS.length ? 0 : -1}
                        onFocus={() => setEnfocada(DIRECTAS.length)}
                        onBlur={() => setEnfocada(null)}
                        className={cn(boton, 'xl:flex-1', otra ? cn('bg-secondary text-primary', marcada) : libre)}
                    >
                        {otra ? texto(otra) : 'Otra'}
                        <span className="sr-only">{otra ? ', marcada. Cambiar' : ': permiso, incapacidad y más opciones'}</span>
                        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                    {OTRAS.map((o) => (
                        <DropdownMenuItem key={o} onSelect={() => valor !== o && onMarcar(o)} className="gap-2">
                            <Info className="size-4" aria-hidden="true" />
                            {texto(o)}
                            {valor === o && <span className="text-muted-foreground ml-auto text-xs">Marcada</span>}
                        </DropdownMenuItem>
                    ))}
                    {valor === 'asistio' && !persona.observacion && (
                        <DropdownMenuItem onSelect={onObservacion} className="gap-2">
                            <Pencil className="size-4" aria-hidden="true" />
                            Añadir una observación
                        </DropdownMenuItem>
                    )}
                    {valor && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => onMarcar('')} className="gap-2">
                                <Undo2 className="size-4" aria-hidden="true" />
                                Quitar el registro
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/** La asistencia ya registrada, para quien no la registra: dibujo y texto. */
function EstadoAsistencia({ valor, texto }: { valor: Asistencia; texto: string }) {
    const { icono: Icono, clase } = VISTA[valor];
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', clase)}>
            <Icono className="size-4 shrink-0" aria-hidden="true" />
            {texto}
        </span>
    );
}

/**
 * Programar un lugar (con `lugares`; `elegido`, si se eligió en la lista del día vacío) o cambiar cuántas personas
 * requiere uno ya programado (con `lugar`). Programado uno nuevo, `onProgramado` sigue con quienes van.
 */
function DialogoLugar({
    linea,
    fecha,
    lugares,
    elegido = '',
    lugar,
    onCerrar,
    onProgramado,
}: {
    linea: Props['linea'];
    fecha: string;
    lugares?: OpcionSelector[];
    elegido?: string;
    lugar?: Lugar;
    onCerrar: () => void;
    onProgramado?: (programado: Lugar) => void;
}) {
    const form = useForm({
        fecha,
        lugar: lugar?.clave ?? elegido,
        personas_requeridas: String(lugar?.requeridas ?? ''),
        vehiculos_requeridos: String(lugar?.vehiculos ?? ''),
        observaciones: lugar?.observaciones ?? '',
    });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        if (lugar) {
            form.put(route('programacion.update', lugar.id), { preserveScroll: true, onSuccess: onCerrar });
            return;
        }
        form.post(route('programacion.store', linea.slug), {
            preserveScroll: true,
            onSuccess: (pagina) => {
                onCerrar();
                const programado = (pagina.props.programaciones as Lugar[] | undefined)?.find((p) => p.clave === form.data.lugar);
                if (programado) onProgramado?.(programado);
            },
        });
    };

    return (
        <DialogoFormulario
            titulo={lugar ? `Programación de ${lugar.lugar}` : 'Programar un lugar'}
            descripcion={`Para el ${fmt.fechaLarga(fecha)}. ${lugar ? '' : 'Después eliges a las personas que van.'}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={lugar ? 'Guardar' : 'Programar y elegir personas'}
        >
            {lugares && (
                <Campo id="lugar" etiqueta="Dónde" requerido ayuda="La empresa, o una de sus sedes o sucursales." error={form.errors.lugar}>
                    <Selector
                        {...propsCampo('lugar', form.errors.lugar, 'lugar-ayuda')}
                        valor={form.data.lugar}
                        onCambio={(v) => form.setData('lugar', v)}
                        placeholder="Elige el lugar"
                        opciones={lugares}
                    />
                </Campo>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="personas_requeridas" etiqueta="Personas requeridas" requerido error={form.errors.personas_requeridas}>
                    <Input
                        {...propsCampo('personas_requeridas', form.errors.personas_requeridas)}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={500}
                        required
                        autoFocus={Boolean(lugar || elegido)}
                        value={form.data.personas_requeridas}
                        onChange={(e) => form.setData('personas_requeridas', e.target.value)}
                        className="h-10 w-32 rounded-lg tabular-nums"
                    />
                </Campo>
                {linea.logistica && (
                    <Campo id="vehiculos_requeridos" etiqueta="Vehículos requeridos" error={form.errors.vehiculos_requeridos}>
                        <Input
                            {...propsCampo('vehiculos_requeridos', form.errors.vehiculos_requeridos)}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={200}
                            value={form.data.vehiculos_requeridos}
                            onChange={(e) => form.setData('vehiculos_requeridos', e.target.value)}
                            className="h-10 w-32 rounded-lg tabular-nums"
                        />
                    </Campo>
                )}
            </div>
            <Campo id="observaciones" etiqueta="Observaciones" ayuda="Opcional: lo que deben saber quienes van." error={form.errors.observaciones}>
                <Textarea
                    {...propsCampo('observaciones', form.errors.observaciones, 'observaciones-ayuda')}
                    rows={2}
                    maxLength={500}
                    value={form.data.observaciones}
                    onChange={(e) => form.setData('observaciones', e.target.value)}
                />
            </Campo>
        </DialogoFormulario>
    );
}

function DialogoPersonas({ lugar, otras, onCerrar }: { lugar: Lugar; otras: Candidato[]; onCerrar: () => void }) {
    const form = useForm<{ personas: number[]; hora_entrada: string; hora_salida: string }>({ personas: [], hora_entrada: '', hora_salida: '' });
    const [buscar, setBuscar] = useState('');
    const coincide = useCallback(
        (c: Candidato) => {
            const texto = buscar.trim().toLowerCase();
            return !texto || `${c.nombre} ${c.detalle} ${c.asignadaEn ?? ''}`.toLowerCase().includes(texto);
        },
        [buscar],
    );
    // Primero quienes trabajan aquí; después cualquiera de la línea (con dónde está asignada)
    const grupos = useMemo(
        () =>
            [
                { titulo: 'Trabajan en este lugar', personas: lugar.candidatos.filter(coincide) },
                { titulo: 'Otras personas de la línea', personas: otras.filter(coincide) },
            ].filter((g) => g.personas.length > 0),
        [coincide, lugar.candidatos, otras],
    );
    const total = lugar.candidatos.length + otras.length;
    const faltan = Math.max(0, lugar.requeridas - lugar.personas.length);

    const alternar = (id: number, elegido: boolean) =>
        form.setData('personas', elegido ? [...form.data.personas, id] : form.data.personas.filter((p) => p !== id));

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.post(route('programacion.personas.store', lugar.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={`Agregar personas a ${lugar.lugar}`}
            descripcion={`Primero, quienes trabajan aquí; también puedes programar a cualquiera de la línea.${faltan ? ` Faltan ${faltan} para completar las requeridas.` : ''}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={form.data.personas.length > 1 ? `Agregar ${form.data.personas.length} personas` : 'Agregar'}
            ancho="max-w-xl"
        >
            {total > 6 && (
                <div className="relative">
                    <label htmlFor="buscar-candidato" className="sr-only">
                        Buscar persona
                    </label>
                    <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden="true"
                    />
                    <Input
                        id="buscar-candidato"
                        type="search"
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar por nombre, cargo o cédula"
                        className="h-10 rounded-lg pl-9"
                        autoComplete="off"
                    />
                </div>
            )}
            <fieldset className="grid gap-1.5" aria-describedby={form.errors.personas ? 'personas-error' : undefined}>
                <legend className="sr-only">Personas</legend>
                <div className="max-h-80 overflow-y-auto rounded-xl border">
                    {grupos.map((g, gi) => (
                        <section key={g.titulo} aria-label={g.titulo} className={cn(gi > 0 && 'border-t')}>
                            <p className="bg-muted/50 text-muted-foreground border-b px-3 py-1.5 text-xs font-semibold">{g.titulo}</p>
                            <ul role="list" className="divide-y">
                                {g.personas.map((c, i) => {
                                    // La primera casilla lleva el id "personas" para recibir el foco si hay un error
                                    const id = gi === 0 && i === 0 ? 'personas' : `persona-${c.id}`;
                                    const elegido = form.data.personas.includes(c.id);
                                    return (
                                        <li key={c.id}>
                                            <label
                                                htmlFor={id}
                                                className={cn('flex cursor-pointer items-start gap-3 px-3 py-2.5', elegido && 'bg-secondary/60')}
                                            >
                                                <Checkbox
                                                    id={id}
                                                    checked={elegido}
                                                    onCheckedChange={(v) => alternar(c.id, v === true)}
                                                    className="mt-0.5"
                                                />
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                                                    {c.detalle && <span className="text-muted-foreground block truncate text-xs">{c.detalle}</span>}
                                                    {c.asignadaEn && (
                                                        <span className="text-muted-foreground block text-xs">Asignada en {c.asignadaEn}</span>
                                                    )}
                                                    {c.otrosLugares.length > 0 && (
                                                        <span className="text-warning block text-xs font-medium">
                                                            Ya está en {c.otrosLugares.join(', ')}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                    {grupos.length === 0 && <p className="text-muted-foreground px-3 py-6 text-center text-sm">Nadie coincide con la búsqueda.</p>}
                </div>
                <InputError id="personas-error" message={form.errors.personas} />
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
                <Campo id="hora_entrada" etiqueta="Entrada" error={form.errors.hora_entrada}>
                    <Input
                        {...propsCampo('hora_entrada', form.errors.hora_entrada)}
                        type="time"
                        value={form.data.hora_entrada}
                        onChange={(e) => form.setData('hora_entrada', e.target.value)}
                        className="h-10 rounded-lg tabular-nums"
                    />
                </Campo>
                <Campo id="hora_salida" etiqueta="Salida" error={form.errors.hora_salida}>
                    <Input
                        {...propsCampo('hora_salida', form.errors.hora_salida)}
                        type="time"
                        value={form.data.hora_salida}
                        onChange={(e) => form.setData('hora_salida', e.target.value)}
                        className="h-10 rounded-lg tabular-nums"
                    />
                </Campo>
            </div>
        </DialogoFormulario>
    );
}

function DialogoTurno({
    persona,
    logistica,
    vehiculos,
    onCerrar,
}: {
    persona: Persona;
    logistica: boolean;
    vehiculos: OpcionSelector[];
    onCerrar: () => void;
}) {
    const form = useForm({
        hora_entrada: persona.entrada ?? '',
        hora_salida: persona.salida ?? '',
        vehiculo_id: persona.vehiculoId ? String(persona.vehiculoId) : '',
        ruta: persona.ruta ?? '',
    });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.patch(route('programacion.personas.update', persona.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={logistica ? `Turno y vehículo de ${persona.nombre}` : `Turno de ${persona.nombre}`}
            descripcion="Las horas son opcionales."
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar="Guardar"
        >
            <div className="grid grid-cols-2 gap-4">
                <Campo id="turno_entrada" etiqueta="Entrada" error={form.errors.hora_entrada}>
                    <Input
                        {...propsCampo('turno_entrada', form.errors.hora_entrada)}
                        type="time"
                        autoFocus
                        value={form.data.hora_entrada}
                        onChange={(e) => form.setData('hora_entrada', e.target.value)}
                        className="h-10 rounded-lg tabular-nums"
                    />
                </Campo>
                <Campo id="turno_salida" etiqueta="Salida" error={form.errors.hora_salida}>
                    <Input
                        {...propsCampo('turno_salida', form.errors.hora_salida)}
                        type="time"
                        value={form.data.hora_salida}
                        onChange={(e) => form.setData('hora_salida', e.target.value)}
                        className="h-10 rounded-lg tabular-nums"
                    />
                </Campo>
            </div>
            {logistica && (
                <>
                    <Campo id="vehiculo_id" etiqueta="Vehículo" error={form.errors.vehiculo_id}>
                        <Selector
                            {...propsCampo('vehiculo_id', form.errors.vehiculo_id)}
                            valor={form.data.vehiculo_id}
                            onCambio={(v) => form.setData('vehiculo_id', v)}
                            opciones={[{ valor: '', texto: 'Sin vehículo' }, ...vehiculos]}
                        />
                    </Campo>
                    <Campo id="ruta" etiqueta="Ruta" error={form.errors.ruta}>
                        <Input
                            {...propsCampo('ruta', form.errors.ruta)}
                            maxLength={120}
                            autoComplete="off"
                            value={form.data.ruta}
                            onChange={(e) => form.setData('ruta', e.target.value)}
                            className="h-10 rounded-lg"
                        />
                    </Campo>
                </>
            )}
        </DialogoFormulario>
    );
}

function DialogoAsistencia({ persona, estados, onCerrar }: { persona: Persona; estados: Props['estados']; onCerrar: () => void }) {
    const form = useForm({ asistencia: persona.asistencia ?? '', hora_llegada: persona.llegada ?? '', observacion: persona.observacion ?? '' });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.patch(route('programacion.asistencia', persona.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={`Asistencia de ${persona.nombre}`}
            descripcion={estados.find((e) => e.valor === persona.asistencia)?.texto ?? ''}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar="Guardar"
        >
            {persona.asistencia === 'tarde' && (
                <Campo id="hora_llegada" etiqueta="Hora de llegada" error={form.errors.hora_llegada}>
                    <Input
                        {...propsCampo('hora_llegada', form.errors.hora_llegada)}
                        type="time"
                        autoFocus
                        value={form.data.hora_llegada}
                        onChange={(e) => form.setData('hora_llegada', e.target.value)}
                        className="h-10 w-40 rounded-lg tabular-nums"
                    />
                </Campo>
            )}
            <Campo
                id="observacion"
                etiqueta="Observación"
                ayuda="Opcional: por qué, quién avisó, quién lo reemplazó…"
                error={form.errors.observacion}
            >
                <Textarea
                    {...propsCampo('observacion', form.errors.observacion, 'observacion-ayuda')}
                    rows={2}
                    maxLength={255}
                    autoFocus={persona.asistencia !== 'tarde'}
                    value={form.data.observacion}
                    onChange={(e) => form.setData('observacion', e.target.value)}
                />
            </Campo>
        </DialogoFormulario>
    );
}

/** Pasa a una persona programada a otro lugar del mismo día, con su turno y su asistencia. */
function DialogoMover({ persona, desde, destinos, onCerrar }: { persona: Persona; desde: Lugar; destinos: Lugar[]; onCerrar: () => void }) {
    const form = useForm<{ programacion_id: string }>({ programacion_id: '' });
    const opciones = destinos.map((d) => {
        const yaEsta = d.personas.some((x) => x.userId === persona.userId);
        return { valor: String(d.id), texto: d.lugar, detalle: yaEsta ? 'Ya está aquí' : undefined, deshabilitada: yaEsta };
    });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.patch(route('programacion.personas.mover', persona.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={`Pasar a ${persona.nombre} a otro lugar`}
            descripcion={`Sale de ${desde.lugar} y pasa al lugar que elijas este mismo día, con su turno y su asistencia.`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar="Pasar"
        >
            <Campo id="programacion_id" etiqueta="Pasa a" requerido error={form.errors.programacion_id}>
                <Selector
                    {...propsCampo('programacion_id', form.errors.programacion_id)}
                    valor={form.data.programacion_id}
                    onCambio={(v) => form.setData('programacion_id', v)}
                    placeholder="Elige el lugar"
                    opciones={opciones}
                />
            </Campo>
        </DialogoFormulario>
    );
}

function Confirmar({ titulo, texto, url, onCerrar }: { titulo: string; texto: string; url: string; onCerrar: () => void }) {
    const [procesando, setProcesando] = useState(false);

    return (
        <Dialog open onOpenChange={(v) => !v && onCerrar()}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-lg font-extrabold">{titulo}</DialogTitle>
                    <DialogDescription>{texto}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={onCerrar} className="rounded-lg">
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={procesando}
                        className="rounded-lg"
                        onClick={() =>
                            router.delete(url, {
                                preserveScroll: true,
                                onStart: () => setProcesando(true),
                                onFinish: () => setProcesando(false),
                                onSuccess: onCerrar,
                            })
                        }
                    >
                        <Trash2 className="size-4" aria-hidden="true" />
                        {procesando ? 'Quitando…' : 'Quitar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
