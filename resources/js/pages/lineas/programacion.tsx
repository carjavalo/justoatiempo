import { Campo } from '@/components/admin/campo';
import { claseTd, claseTh, Tabla } from '@/components/admin/piezas';
import { Dato, EstadoBadge as EstadoNivel, Panel } from '@/components/dashboard/piezas';
import { DialogoFormulario } from '@/components/dialogo-formulario';
import { AlertTriangle, CalendarClock, CheckCircle2, Pencil, Plus, Search, Trash2, UserCheck } from '@/components/iconos';
import InputError from '@/components/input-error';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { NavegadorFecha } from '@/components/linea/navegador-fecha';
import { type OpcionSelector, Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePuede } from '@/hooks/use-puede';
import { aFecha, fmt, semaforo } from '@/lib/formato';
import { propsCampo } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

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
    esFutura: boolean;
    filtros: { lugar: string };
    lugares: OpcionSelector[];
    programaciones: Lugar[];
    resumen: {
        requeridas: number;
        programadas: number;
        presentes: number;
        tarde: number;
        faltas: number;
        justificadas: number;
        sinRegistrar: number;
        /** Asistieron frente a las requeridas (o a las programadas, donde no se dijo cuántas). */
        cobertura: number | null;
    };
    copiarDe: string | null;
    estados: { valor: Asistencia; texto: string }[];
    vehiculos: OpcionSelector[];
}

const ESTADO: Record<Asistencia, string> = {
    asistio: 'text-good',
    tarde: 'text-warning',
    falta: 'text-critical',
    permiso: 'text-muted-foreground',
    incapacidad: 'text-muted-foreground',
};

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;
const turno = (p: { entrada: string | null; salida: string | null }) => (p.entrada ? `${p.entrada}${p.salida ? ` a ${p.salida}` : ''}` : null);

function sumarDias(iso: string, dias: number): string {
    const d = aFecha(iso);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Programación diaria de una línea: en cada empresa, sede o sucursal, cuántas personas se requieren, quiénes van (con
 * su turno y, en logística, su vehículo y su ruta) y si asistieron.
 */
export default function Programacion({ linea, fecha, esFutura, filtros, lugares, programaciones, resumen, copiarDe, estados, vehiculos }: Props) {
    const puede = usePuede();
    const editar = puede('programacion.editar');
    const registrar = puede('programacion.asistencia') && !esFutura;
    const [nuevo, setNuevo] = useState(false);
    const [editando, setEditando] = useState<Lugar | null>(null);
    const [agregando, setAgregando] = useState<Lugar | null>(null);
    const [turnoDe, setTurnoDe] = useState<Persona | null>(null);
    const [detalleDe, setDetalleDe] = useState<Persona | null>(null);
    const [quitando, setQuitando] = useState<{ titulo: string; texto: string; url: string } | null>(null);

    const ir = (cambios: { fecha?: string; lugar?: string }) => {
        const params = { fecha: cambios.fecha ?? fecha, lugar: cambios.lugar !== undefined ? cambios.lugar : filtros.lugar };
        router.get(route('programacion.index', linea.slug), Object.fromEntries(Object.entries(params).filter(([, v]) => v)), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const copiar = () => copiarDe && router.post(route('programacion.copiar', linea.slug), { desde: copiarDe, fecha }, { preserveScroll: true });

    // La cobertura y su semáforo, solo cuando ya hay asistencia registrada
    const conAsistencia = !esFutura && resumen.programadas > resumen.sinRegistrar;
    const nivel = conAsistencia ? semaforo(resumen.cobertura) : null;
    const programados = new Set(programaciones.map((p) => p.clave));

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
                        anterior={sumarDias(fecha, -1)}
                        siguiente={sumarDias(fecha, 1)}
                        onIr={(f) => ir({ fecha: f })}
                    />
                    {lugares.length > 1 && (
                        <div className="w-60">
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
                    {/* Sin programación, el botón está en el aviso del día vacío */}
                    {editar && programaciones.length > 0 && (
                        <Button className="h-9 rounded-lg text-xs font-semibold" onClick={() => setNuevo(true)}>
                            <Plus className="size-4" aria-hidden="true" />
                            Programar un lugar
                        </Button>
                    )}
                </div>
            }
        >
            <p className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <CalendarClock className="size-4" aria-hidden="true" />
                Programación del <strong className="text-foreground font-semibold">{fmt.fechaLarga(fecha)}</strong>
                {esFutura && <span>· la asistencia se registra ese día.</span>}
            </p>

            {lugares.length === 0 ? (
                <Vacio
                    titulo="Aún no hay dónde programar"
                    texto="Esta línea no tiene empresas activas que la reciban dentro de lo que ves. Márcala en el formulario de la empresa."
                />
            ) : programaciones.length === 0 ? (
                <Vacio
                    titulo="Este día aún no tiene programación"
                    texto={
                        editar
                            ? 'Programa cada lugar con las personas que van y su turno.'
                            : 'Cuando se programe, aquí verás quién va a cada lugar y su asistencia.'
                    }
                    acciones={
                        editar && (
                            <>
                                <Button className="h-10 rounded-lg px-4 font-semibold" onClick={() => setNuevo(true)}>
                                    <Plus className="size-4" aria-hidden="true" />
                                    Programar un lugar
                                </Button>
                                {copiarDe && (
                                    <Button variant="outline" className="h-10 rounded-lg px-4 font-semibold" onClick={copiar}>
                                        Copiar la del {fmt.fechaMedia(copiarDe)}
                                    </Button>
                                )}
                            </>
                        )
                    }
                />
            ) : (
                <>
                    <ul role="list" aria-label="Resumen del día" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Dato
                            titulo="Cobertura"
                            valor={conAsistencia ? fmt.pct(resumen.cobertura) : '—'}
                            detalle={nivel ? <EstadoNivel nivel={nivel.nivel}>{nivel.texto}</EstadoNivel> : 'Se calcula con la asistencia'}
                        />
                        <Dato
                            titulo="Programadas"
                            valor={fmt.numero(resumen.programadas)}
                            detalle={resumen.requeridas ? `De ${plural(resumen.requeridas, 'requerida', 'requeridas')}` : 'Sin un número requerido'}
                        />
                        <Dato
                            titulo="Asistieron"
                            valor={conAsistencia ? fmt.numero(resumen.presentes) : '—'}
                            detalle={
                                !conAsistencia
                                    ? 'Aún sin registrar'
                                    : resumen.tarde
                                      ? plural(resumen.tarde, 'llegó tarde', 'llegaron tarde')
                                      : 'Nadie llegó tarde'
                            }
                        />
                        <Dato
                            titulo="No asistieron"
                            valor={conAsistencia ? fmt.numero(resumen.faltas + resumen.justificadas) : '—'}
                            detalle={
                                resumen.programadas === 0
                                    ? 'Sin personas programadas'
                                    : resumen.sinRegistrar
                                      ? `${plural(resumen.sinRegistrar, 'persona', 'personas')} sin registrar`
                                      : resumen.justificadas
                                        ? `${plural(resumen.justificadas, 'justificada', 'justificadas')}`
                                        : 'Asistencia completa'
                            }
                        />
                    </ul>

                    {editar && copiarDe && lugares.some((l) => !programados.has(l.valor)) && (
                        <p className="text-muted-foreground -mt-2 text-sm">
                            ¿Faltan lugares?{' '}
                            <button
                                type="button"
                                onClick={copiar}
                                className="text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                            >
                                Copiar los del {fmt.fechaMedia(copiarDe)}
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
                            onEditar={() => setEditando(p)}
                            onAgregar={() => setAgregando(p)}
                            onTurno={setTurnoDe}
                            onDetalle={setDetalleDe}
                            onQuitarPersona={(persona) =>
                                setQuitando({
                                    titulo: `¿Quitar a ${persona.nombre}?`,
                                    texto: `Ya no estará en la programación de ${p.lugar} este día.`,
                                    url: route('programacion.personas.destroy', persona.id),
                                })
                            }
                            onQuitar={() =>
                                setQuitando({
                                    titulo: `¿Quitar la programación de ${p.lugar}?`,
                                    texto: 'Se quitan también las personas programadas allí este día.',
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
                    lugares={lugares.map((l) => ({
                        ...l,
                        deshabilitada: programados.has(l.valor),
                        detalle: programados.has(l.valor) ? 'Ya está programado' : l.detalle,
                    }))}
                    onCerrar={() => setNuevo(false)}
                />
            )}
            {editando && <DialogoLugar linea={linea} fecha={fecha} lugar={editando} onCerrar={() => setEditando(null)} />}
            {agregando && <DialogoPersonas lugar={agregando} onCerrar={() => setAgregando(null)} />}
            {turnoDe && <DialogoTurno persona={turnoDe} logistica={linea.logistica} vehiculos={vehiculos} onCerrar={() => setTurnoDe(null)} />}
            {detalleDe && <DialogoAsistencia persona={detalleDe} estados={estados} onCerrar={() => setDetalleDe(null)} />}
            {quitando && <Confirmar {...quitando} onCerrar={() => setQuitando(null)} />}
        </MarcoLinea>
    );
}

function Vacio({ titulo, texto, acciones }: { titulo: string; texto: string; acciones?: ReactNode }) {
    return (
        <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
            <span className="bg-secondary text-primary flex size-16 items-center justify-center rounded-2xl">
                <CalendarClock className="size-8" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-extrabold tracking-tight">{titulo}</h2>
            <p className="text-muted-foreground mt-1.5 max-w-md text-sm">{texto}</p>
            {acciones && <div className="mt-6 flex flex-wrap justify-center gap-2">{acciones}</div>}
        </div>
    );
}

function LugarProgramado({
    lugar,
    logistica,
    estados,
    editar,
    registrar,
    onEditar,
    onAgregar,
    onTurno,
    onDetalle,
    onQuitarPersona,
    onQuitar,
}: {
    lugar: Lugar;
    logistica: boolean;
    estados: Props['estados'];
    editar: boolean;
    registrar: boolean;
    onEditar: () => void;
    onAgregar: () => void;
    onTurno: (p: Persona) => void;
    onDetalle: (p: Persona) => void;
    onQuitarPersona: (p: Persona) => void;
    onQuitar: () => void;
}) {
    const [guardando, setGuardando] = useState<number | null>(null);
    const faltan = Math.max(0, lugar.requeridas - lugar.personas.length);
    const sinRegistrar = lugar.personas.filter((p) => !p.asistencia).length;
    const conAsistencia = lugar.personas.length - sinRegistrar;

    const marcar = (persona: Persona, asistencia: string) =>
        router.patch(
            route('programacion.asistencia', persona.id),
            { asistencia: asistencia || null, hora_llegada: persona.llegada, observacion: persona.observacion },
            { preserveScroll: true, onStart: () => setGuardando(persona.id), onFinish: () => setGuardando(null) },
        );

    const columnas = logistica ? ['30%', '13%', '19%', '24%', '6.5rem'] : ['40%', '16%', '28%', '6.5rem'];

    return (
        <Panel
            titulo={lugar.lugar}
            descripcion={
                <>
                    {lugar.requeridas
                        ? `${lugar.personas.length} de ${plural(lugar.requeridas, 'persona requerida', 'personas requeridas')}`
                        : plural(lugar.personas.length, 'persona programada', 'personas programadas')}
                    {logistica && lugar.vehiculos > 0 && ` · ${plural(lugar.vehiculos, 'vehículo', 'vehículos')}`}
                    {faltan > 0 && (
                        <span className="text-warning ml-1 inline-flex items-center gap-1 font-semibold">
                            · <AlertTriangle className="size-3.5" aria-hidden="true" />
                            {faltan === 1 ? 'falta 1 por programar' : `faltan ${faltan} por programar`}
                        </span>
                    )}
                </>
            }
            acciones={
                <>
                    {registrar && sinRegistrar > 0 && (
                        <Button
                            variant="outline"
                            className="h-8 rounded-lg text-xs font-semibold"
                            onClick={() => router.post(route('programacion.asistencia.todos', lugar.id), {}, { preserveScroll: true })}
                        >
                            <UserCheck className="size-4" aria-hidden="true" />
                            {conAsistencia ? 'Los demás asistieron' : 'Todos asistieron'}
                        </Button>
                    )}
                    {editar && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg"
                                onClick={onEditar}
                                aria-label={`Editar la programación de ${lugar.lugar}`}
                            >
                                <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            {conAsistencia === 0 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-critical size-8 rounded-lg"
                                    onClick={onQuitar}
                                    aria-label={`Quitar la programación de ${lugar.lugar}`}
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                            )}
                        </>
                    )}
                </>
            }
            cuerpoClassName="flex flex-col gap-3"
        >
            {lugar.observaciones && <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">{lugar.observaciones}</p>}

            {lugar.personas.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aún no hay personas programadas aquí.</p>
            ) : (
                <Tabla titulo={`Personas programadas en ${lugar.lugar}`} minimo={logistica ? 'min-w-[820px]' : 'min-w-[620px]'} columnas={columnas}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            <th scope="col" className={claseTh}>
                                Persona
                            </th>
                            <th scope="col" className={claseTh}>
                                Turno
                            </th>
                            {logistica && (
                                <th scope="col" className={claseTh}>
                                    Vehículo y ruta
                                </th>
                            )}
                            <th scope="col" className={claseTh}>
                                Asistencia
                            </th>
                            <th scope="col" className={claseTh}>
                                <span className="sr-only">Acciones</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {lugar.personas.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/40 align-top transition-colors">
                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                    <p className="truncate font-semibold" title={p.nombre}>
                                        {p.nombre}
                                    </p>
                                    {p.detalle && <p className="text-muted-foreground truncate text-xs">{p.detalle}</p>}
                                    {p.otrosLugares.length > 0 && (
                                        <p className="text-warning mt-0.5 text-xs font-medium">También en {p.otrosLugares.join(', ')}</p>
                                    )}
                                </th>
                                <td className={cn(claseTd, 'tabular-nums')}>
                                    {turno(p) ?? <span className="text-muted-foreground text-xs">Sin turno</span>}
                                </td>
                                {logistica && (
                                    <td className={claseTd}>
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
                                            <span className="text-muted-foreground text-xs">Sin asignar</span>
                                        )}
                                    </td>
                                )}
                                <td className={claseTd}>
                                    {registrar ? (
                                        <>
                                            <label htmlFor={`asistencia-${p.id}`} className="sr-only">
                                                Asistencia de {p.nombre}
                                            </label>
                                            <Selector
                                                id={`asistencia-${p.id}`}
                                                tamano="sm"
                                                valor={p.asistencia ?? ''}
                                                onCambio={(v) => marcar(p, v)}
                                                disabled={guardando === p.id}
                                                placeholder="Sin registrar"
                                                claseValor={p.asistencia ? cn('font-semibold', ESTADO[p.asistencia]) : undefined}
                                                opciones={[...(p.asistencia ? [{ valor: '', texto: 'Quitar el registro' }] : []), ...estados]}
                                            />
                                        </>
                                    ) : (
                                        <p
                                            className={cn(
                                                'text-sm font-semibold',
                                                p.asistencia ? ESTADO[p.asistencia] : 'text-muted-foreground font-normal',
                                            )}
                                        >
                                            {p.asistencia ? estados.find((e) => e.valor === p.asistencia)?.texto : 'Sin registrar'}
                                        </p>
                                    )}
                                    {(p.llegada || p.observacion) && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {[p.llegada && `Llegó ${p.llegada}`, p.observacion].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                    {registrar && p.asistencia && (
                                        <button
                                            type="button"
                                            onClick={() => onDetalle(p)}
                                            className="text-primary focus-visible:ring-ring mt-1 rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                        >
                                            {p.asistencia === 'tarde' ? 'Hora de llegada y observación' : 'Observación'}
                                            <span className="sr-only"> de {p.nombre}</span>
                                        </button>
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-right')}>
                                    {editar && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 rounded-lg"
                                                onClick={() => onTurno(p)}
                                                aria-label={`Cambiar el turno de ${p.nombre}`}
                                            >
                                                <Pencil className="size-4" aria-hidden="true" />
                                            </Button>
                                            {!p.asistencia && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-critical size-8 rounded-lg"
                                                    onClick={() => onQuitarPersona(p)}
                                                    aria-label={`Quitar a ${p.nombre} de la programación`}
                                                >
                                                    <Trash2 className="size-4" aria-hidden="true" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Tabla>
            )}

            {editar && (
                <div>
                    <Button
                        variant="outline"
                        className="h-9 rounded-lg text-xs font-semibold"
                        onClick={onAgregar}
                        disabled={lugar.candidatos.length === 0}
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        Agregar personas
                    </Button>
                    {lugar.candidatos.length === 0 && (
                        <span className="text-muted-foreground ml-3 text-xs">Ya están todas las personas asignadas a este lugar en la línea.</span>
                    )}
                </div>
            )}
        </Panel>
    );
}

/** Programar un lugar (con `lugares`) o cambiar cuántas personas requiere uno ya programado (con `lugar`). */
function DialogoLugar({
    linea,
    fecha,
    lugares,
    lugar,
    onCerrar,
}: {
    linea: Props['linea'];
    fecha: string;
    lugares?: OpcionSelector[];
    lugar?: Lugar;
    onCerrar: () => void;
}) {
    const form = useForm({
        fecha,
        lugar: lugar?.clave ?? '',
        personas_requeridas: String(lugar?.requeridas ?? ''),
        vehiculos_requeridos: String(lugar?.vehiculos ?? ''),
        observaciones: lugar?.observaciones ?? '',
    });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        const opciones = { preserveScroll: true, onSuccess: onCerrar };
        if (lugar) form.put(route('programacion.update', lugar.id), opciones);
        else form.post(route('programacion.store', linea.slug), opciones);
    };

    return (
        <DialogoFormulario
            titulo={lugar ? `Programación de ${lugar.lugar}` : 'Programar un lugar'}
            descripcion={`Para el ${fmt.fechaLarga(fecha)}. ${lugar ? '' : 'Después agregas a las personas que van.'}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={lugar ? 'Guardar' : 'Programar'}
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
                        autoFocus={Boolean(lugar)}
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

function DialogoPersonas({ lugar, onCerrar }: { lugar: Lugar; onCerrar: () => void }) {
    const form = useForm<{ personas: number[]; hora_entrada: string; hora_salida: string }>({ personas: [], hora_entrada: '', hora_salida: '' });
    const [buscar, setBuscar] = useState('');
    const visibles = useMemo(() => {
        const texto = buscar.trim().toLowerCase();
        return texto ? lugar.candidatos.filter((c) => `${c.nombre} ${c.detalle}`.toLowerCase().includes(texto)) : lugar.candidatos;
    }, [buscar, lugar.candidatos]);
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
            descripcion={`Quienes trabajan en la línea en este lugar.${faltan ? ` Faltan ${faltan} para completar las requeridas.` : ''}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={form.data.personas.length > 1 ? `Agregar ${form.data.personas.length} personas` : 'Agregar'}
            ancho="max-w-xl"
        >
            {lugar.candidatos.length > 6 && (
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
                <ul role="list" className="max-h-72 divide-y overflow-y-auto rounded-xl border">
                    {visibles.map((c, i) => {
                        const id = i === 0 ? 'personas' : `persona-${c.id}`;
                        const elegido = form.data.personas.includes(c.id);
                        return (
                            <li key={c.id}>
                                <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 px-3 py-2.5', elegido && 'bg-secondary/60')}>
                                    <Checkbox id={id} checked={elegido} onCheckedChange={(v) => alternar(c.id, v === true)} className="mt-0.5" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                                        {c.detalle && <span className="text-muted-foreground block truncate text-xs">{c.detalle}</span>}
                                        {c.otrosLugares.length > 0 && (
                                            <span className="text-warning block text-xs font-medium">Ya está en {c.otrosLugares.join(', ')}</span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                    {visibles.length === 0 && (
                        <li className="text-muted-foreground px-3 py-6 text-center text-sm">Nadie coincide con la búsqueda.</li>
                    )}
                </ul>
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
            titulo={`Turno de ${persona.nombre}`}
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
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        {procesando ? 'Quitando…' : 'Quitar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
