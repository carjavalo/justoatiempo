import { claseTd, claseTh, Tabla } from '@/components/admin/piezas';
import { Dato, EstadoBadge as EstadoNivel, Panel } from '@/components/dashboard/piezas';
import {
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    Download,
    EnRevision,
    FileSpreadsheet,
    Lock,
    MessageCircle,
    Pencil,
    Plus,
    Trash2,
    Undo2,
} from '@/components/iconos';
import InputError from '@/components/input-error';
import { DialogoDescarga } from '@/components/linea/dialogo-descarga';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { NavegadorFecha } from '@/components/linea/navegador-fecha';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePuede } from '@/hooks/use-puede';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';

interface Accion {
    id: number;
    tipo: string;
    tipoLabel: string;
    descripcion: string | null;
    registradaPor: string | null;
}

interface Fila {
    id: number;
    auxiliar: string;
    auxiliarId: number | null;
    cedula: string | null;
    ruta: string | null;
    placa: string | null;
    asignadas: number;
    realizadas: number;
    pendientes: number;
    cumplimiento: number;
    /** En cuántas órdenes (paradas) iban las entregas, que se cuentan por producto. */
    ordenes: number;
    novedades: string;
    observacion: string | null;
    averias: number;
    devoluciones: number;
    faltantes: number;
    sinEvidencia: number;
    /** Evidencias completas (sí), con faltas (no) o sin información todavía (null). */
    pod: boolean | null;
    acciones: Accion[];
    /** Lo que sugieren los umbrales de Parámetros. */
    sugerencia: string | null;
}

interface Informe {
    id: number;
    empresa: string | null;
    sede: string | null;
    sucursal: string | null;
    ciudad: string | null;
    color: string | null;
    meta: number;
    estado: 'borrador' | 'seguimiento' | 'cerrado';
    estadoLabel: string;
    cerradoPor: string | null;
    cerradoEn: string | null;
    observaciones: string | null;
    sinAuditar: number;
    lineas: Fila[];
}

interface Resumen {
    registros: number;
    asignadas: number;
    realizadas: number;
    pendientes: number;
    cumplimiento: number | null;
    conNovedad: number;
    averias: number;
    devoluciones: number;
    faltantes: number;
    sinEvidencia: number;
    abiertos: number;
}

interface Props {
    fecha: string | null;
    anterior: string | null;
    siguiente: string | null;
    sede: number | null;
    sedes: { id: number; nombre: string; empresa: string | null }[];
    informes: Informe[];
    resumen: Resumen;
    porCiudad: {
        ciudad: string;
        registros: number;
        asignadas: number;
        realizadas: number;
        pendientes: number;
        conNovedad: number;
        cumplimiento: number | null;
    }[];
    tiposAccion: { valor: string; texto: string }[];
    umbrales: { felicitacion: number; llamado: number };
}

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

export default function Informes({ fecha, anterior, siguiente, sede, sedes, informes, resumen, porCiudad, tiposAccion, umbrales }: Props) {
    const puede = usePuede();
    const [descargar, setDescargar] = useState(false);
    const [accion, setAccion] = useState<{ informe: Informe; fila: Fila } | null>(null);
    const [observacion, setObservacion] = useState<Fila | null>(null);

    const ir = (cambios: { fecha?: string | null; sede?: number | null }) => {
        const params = { fecha: cambios.fecha !== undefined ? cambios.fecha : fecha, sede: cambios.sede !== undefined ? cambios.sede : sede };
        router.get(route('informes.index'), Object.fromEntries(Object.entries(params).filter(([, v]) => v)), {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const nivelDia = semaforo(resumen.cumplimiento);

    return (
        <MarcoLinea
            slug={LINEA_LOGISTICA}
            titulo={fecha ? `Informe diario · ${fmt.fechaMedia(fecha)}` : 'Informe diario'}
            seccion="informes"
            pestanas
            acciones={
                <div className="flex flex-wrap items-center gap-2">
                    {/* Moverse entre jornadas con informe */}
                    <NavegadorFecha
                        id="fecha-informe"
                        etiqueta="Jornada"
                        fecha={fecha}
                        anterior={anterior}
                        siguiente={siguiente}
                        onIr={(f) => ir({ fecha: f })}
                    />
                    {sedes.length > 1 && (
                        <div className="w-52">
                            <label htmlFor="filtro-sede" className="sr-only">
                                Sede
                            </label>
                            <Selector
                                id="filtro-sede"
                                valor={sede ? String(sede) : ''}
                                onCambio={(v) => ir({ sede: v ? Number(v) : null })}
                                className="bg-card h-9 text-xs font-semibold"
                                opciones={[
                                    { valor: '', texto: 'Todas las sedes' },
                                    ...sedes.map((s) => ({ valor: String(s.id), texto: s.nombre, detalle: s.empresa ?? undefined })),
                                ]}
                            />
                        </div>
                    )}
                    {puede('informes.descargar') && (
                        <Button variant="outline" className="bg-card h-9 rounded-lg text-xs font-semibold" onClick={() => setDescargar(true)}>
                            <Download className="size-4" aria-hidden="true" />
                            Descargar Excel
                        </Button>
                    )}
                </div>
            }
        >
            {!fecha || informes.length === 0 ? (
                <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
                    <span className="bg-secondary text-primary flex size-16 items-center justify-center rounded-2xl">
                        <FileSpreadsheet className="size-8" aria-hidden="true" />
                    </span>
                    <h2 className="mt-5 text-lg font-extrabold tracking-tight">
                        {fecha ? 'No hay informe para esta jornada' : 'Aún no hay informes'}
                    </h2>
                    <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
                        El informe de cada sede y sucursal se arma solo al confirmar la preliquidación de Drivin de esa jornada.
                    </p>
                    {puede('cargas.subir') && (
                        <Button asChild className="mt-6 h-10 rounded-lg px-4 font-semibold">
                            <Link href={route('cargas.index')}>Ir a Cargas Drivin</Link>
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-muted-foreground -mt-2 flex items-center gap-2 text-sm">
                        <CalendarDays className="size-4" aria-hidden="true" />
                        Operación del <strong className="text-foreground font-semibold">{fmt.fechaLarga(fecha)}</strong>
                    </p>

                    {/* Como la hoja "Dashboard Gerencial" */}
                    <ul role="list" aria-label="Resumen de la jornada" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Dato
                            titulo="Cumplimiento"
                            valor={fmt.pct(resumen.cumplimiento)}
                            detalle={nivelDia && <EstadoNivel nivel={nivelDia.nivel}>{nivelDia.texto}</EstadoNivel>}
                        />
                        <Dato
                            titulo="Entregas"
                            valor={`${fmt.numero(resumen.realizadas)} de ${fmt.numero(resumen.asignadas)}`}
                            detalle={`${plural(resumen.pendientes, 'pendiente', 'pendientes')}`}
                        />
                        <Dato
                            titulo="Auxiliares"
                            valor={fmt.numero(resumen.registros)}
                            detalle={`${plural(resumen.conNovedad, 'con novedad', 'con novedad')}`}
                        />
                        <Dato
                            titulo="Novedades"
                            valor={fmt.numero(resumen.devoluciones)}
                            detalle={`${resumen.devoluciones === 1 ? 'devolución' : 'devoluciones'} · ${plural(resumen.averias, 'avería', 'averías')} · ${plural(resumen.faltantes, 'faltante', 'faltantes')}`}
                        />
                    </ul>

                    {informes.map((informe) => (
                        <InformeSede
                            key={informe.id}
                            informe={informe}
                            onAccion={(fila) => setAccion({ informe, fila })}
                            onObservacion={setObservacion}
                        />
                    ))}

                    {porCiudad.length > 0 && (
                        <Panel titulo="Resumen por ciudad" descripcion="Como la hoja del Excel de la operación" cuerpoClassName="px-0 pb-2">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <caption className="sr-only">Resumen de la jornada por ciudad</caption>
                                    <thead className="text-muted-foreground border-y">
                                        <tr>
                                            {['Ciudad', 'Auxiliares', 'Asignadas', 'Realizadas', 'Pendientes', 'Con novedad', 'Cumplimiento'].map(
                                                (t) => (
                                                    <th key={t} scope="col" className={claseTh}>
                                                        {t}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {porCiudad.map((c) => (
                                            <tr key={c.ciudad}>
                                                <th scope="row" className={cn(claseTd, 'font-semibold')}>
                                                    {c.ciudad}
                                                </th>
                                                <td className={cn(claseTd, 'tabular-nums')}>{c.registros}</td>
                                                <td className={cn(claseTd, 'tabular-nums')}>{c.asignadas}</td>
                                                <td className={cn(claseTd, 'tabular-nums')}>{c.realizadas}</td>
                                                <td className={cn(claseTd, 'tabular-nums')}>{c.pendientes}</td>
                                                <td className={cn(claseTd, 'tabular-nums')}>{c.conNovedad}</td>
                                                <td className={cn(claseTd, 'font-semibold tabular-nums')}>{fmt.pct(c.cumplimiento)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    )}
                </>
            )}

            {descargar && (
                <DialogoDescarga
                    descripcion="Con las hojas Informe Diario, Seguimiento, Resumen por ciudad y Dashboard Gerencial."
                    fecha={fecha}
                    url={(desde, hasta) => route('informes.descargar', { desde, hasta, ...(sede ? { sede } : {}) })}
                    onCerrar={() => setDescargar(false)}
                />
            )}
            {accion && <DialogoAccion {...accion} tiposAccion={tiposAccion} umbrales={umbrales} onCerrar={() => setAccion(null)} />}
            {observacion && <DialogoObservacion fila={observacion} onCerrar={() => setObservacion(null)} />}
        </MarcoLinea>
    );
}

function InformeSede({ informe, onAccion, onObservacion }: { informe: Informe; onAccion: (f: Fila) => void; onObservacion: (f: Fila) => void }) {
    const puede = usePuede();
    const cerrado = informe.estado === 'cerrado';
    const [procesando, setProcesando] = useState(false);
    const titulo = [informe.sede, informe.sucursal].filter(Boolean).join(' · ') || 'Sin sede';
    const asignadas = informe.lineas.reduce((s, l) => s + l.asignadas, 0);
    const realizadas = informe.lineas.reduce((s, l) => s + l.realizadas, 0);
    const cumplimiento = asignadas ? (realizadas / asignadas) * 100 : null;
    const nivel = semaforo(cumplimiento);

    const cambiarEstado = (estado: 'seguimiento' | 'cerrado') =>
        router.patch(
            route('informes.estado', informe.id),
            { estado },
            { preserveScroll: true, onStart: () => setProcesando(true), onFinish: () => setProcesando(false) },
        );

    return (
        <Panel
            titulo={
                <span className="flex flex-wrap items-center gap-2">
                    {informe.color && <span className="size-2.5 rounded-full" style={{ backgroundColor: informe.color }} aria-hidden="true" />}
                    {titulo}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold',
                            cerrado
                                ? 'bg-muted text-muted-foreground'
                                : informe.estado === 'seguimiento'
                                  ? 'bg-warning-soft text-warning'
                                  : 'bg-secondary text-secondary-foreground',
                        )}
                    >
                        {cerrado ? <Lock className="size-3.5" aria-hidden="true" /> : <EnRevision className="size-3.5" aria-hidden="true" />}
                        {informe.estadoLabel}
                    </span>
                </span>
            }
            descripcion={
                <>
                    {[informe.empresa, informe.ciudad].filter(Boolean).join(' · ')}
                    {cumplimiento !== null && (
                        <>
                            {' · '}Cumplimiento <strong className="text-foreground">{fmt.pct(cumplimiento)}</strong> (meta{' '}
                            {fmt.pctEntero(informe.meta)}){nivel && <span className="sr-only">: {nivel.texto}</span>}
                        </>
                    )}
                    {cerrado && informe.cerradoPor && <> · Cerrado por {informe.cerradoPor}</>}
                </>
            }
            acciones={
                puede('informes.cerrar') && (
                    <div className="flex flex-wrap gap-2">
                        {informe.estado === 'borrador' && (
                            <Button
                                variant="outline"
                                className="h-8 rounded-lg text-xs"
                                disabled={procesando}
                                onClick={() => cambiarEstado('seguimiento')}
                            >
                                <EnRevision className="size-3.5" aria-hidden="true" />
                                Pasar a seguimiento
                            </Button>
                        )}
                        {cerrado ? (
                            <Button
                                variant="outline"
                                className="h-8 rounded-lg text-xs"
                                disabled={procesando}
                                onClick={() => cambiarEstado('seguimiento')}
                            >
                                <Undo2 className="size-3.5" aria-hidden="true" />
                                Reabrir
                            </Button>
                        ) : (
                            <Button className="h-8 rounded-lg text-xs" disabled={procesando} onClick={() => cambiarEstado('cerrado')}>
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                Cerrar informe
                            </Button>
                        )}
                    </div>
                )
            }
            cuerpoClassName="px-0 pb-0"
        >
            {informe.sinAuditar > 0 && !cerrado && (
                <p className="bg-warning-soft/60 text-warning mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium">
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    {plural(informe.sinAuditar, 'orden aprobada sin auditar', 'órdenes aprobadas sin auditar')}.
                    {puede('auditoria.ver') && (
                        <Link href={route('auditoria.index')} className="underline underline-offset-4">
                            Ir a Auditoría POD
                        </Link>
                    )}
                </p>
            )}

            <Tabla titulo={`Informe de ${titulo}`} minimo="min-w-[1020px]" columnas={['18%', '11%', '13%', '11%', '19%', '10%', '8%', '15%']}>
                <thead className="text-muted-foreground border-y">
                    <tr>
                        {[
                            'Trabajador',
                            'Operación',
                            'Entregas',
                            'Cumplimiento',
                            'Novedades',
                            'Incidencias',
                            'Evidencias',
                            'Acción / Seguimiento',
                        ].map((t) => (
                            <th key={t} scope="col" className={claseTh}>
                                {t}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {informe.lineas.map((l) => {
                        const nivelFila = semaforo(l.cumplimiento);
                        return (
                            <tr key={l.id} className="align-top">
                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                    <p className="font-semibold break-words">{l.auxiliar}</p>
                                    <p className="text-muted-foreground text-xs tabular-nums">
                                        {l.cedula ? `C.C. ${l.cedula}` : 'No está en Usuarios'}
                                    </p>
                                </th>
                                <td className={cn(claseTd, 'text-xs')}>
                                    <p className="font-semibold">RUTA{l.placa && ` / ${l.placa}`}</p>
                                </td>
                                {/* Asignadas, realizadas y pendientes (por producto), con las órdenes en que iban */}
                                <td className={cn(claseTd, 'tabular-nums')}>
                                    <p className="font-semibold">
                                        {l.realizadas} de {l.asignadas}
                                    </p>
                                    <p className={cn('text-xs', l.pendientes > 0 ? 'text-warning font-medium' : 'text-muted-foreground')}>
                                        {l.pendientes === 0 ? 'Sin pendientes' : plural(l.pendientes, 'pendiente', 'pendientes')}
                                    </p>
                                    {l.ordenes > 0 && (
                                        <p className="text-muted-foreground text-[0.7rem]">En {plural(l.ordenes, 'orden', 'órdenes')}</p>
                                    )}
                                </td>
                                <td className={claseTd}>
                                    {nivelFila ? (
                                        <EstadoNivel nivel={nivelFila.nivel}>
                                            {fmt.pct(l.cumplimiento)}
                                            <span className="sr-only">: {nivelFila.texto}</span>
                                        </EstadoNivel>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-xs leading-relaxed')}>
                                    <p className={cn(l.novedades === 'Sin novedad' && 'text-muted-foreground')}>{l.novedades}</p>
                                    {l.observacion && (
                                        <p className="mt-1 flex items-start gap-1.5">
                                            <MessageCircle className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                            <span>
                                                <span className="sr-only">Observación: </span>
                                                {l.observacion}
                                            </span>
                                        </p>
                                    )}
                                    {!cerrado && puede('informes.editar') && (
                                        <button
                                            type="button"
                                            onClick={() => onObservacion(l)}
                                            className="text-primary focus-visible:ring-ring mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                        >
                                            <Pencil className="size-3" aria-hidden="true" />
                                            {l.observacion ? 'Editar observación' : 'Agregar observación'}
                                            <span className="sr-only"> de {l.auxiliar}</span>
                                        </button>
                                    )}
                                </td>
                                {/* Averías, devoluciones y faltantes: solo las que hubo */}
                                <td className={cn(claseTd, 'text-xs')}>
                                    {l.averias + l.devoluciones + l.faltantes === 0 ? (
                                        <span className="text-muted-foreground">Ninguna</span>
                                    ) : (
                                        <ul role="list" className="grid gap-0.5">
                                            {l.devoluciones > 0 && (
                                                <li className="font-semibold">{plural(l.devoluciones, 'devolución', 'devoluciones')}</li>
                                            )}
                                            {l.averias > 0 && (
                                                <li className="text-critical font-semibold">{plural(l.averias, 'avería', 'averías')}</li>
                                            )}
                                            {l.faltantes > 0 && (
                                                <li className="text-warning font-semibold">{plural(l.faltantes, 'faltante', 'faltantes')}</li>
                                            )}
                                        </ul>
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-xs')}>
                                    {l.pod === true ? (
                                        <span className="text-good font-semibold">Sí</span>
                                    ) : l.pod === false ? (
                                        <span className="text-critical font-semibold">
                                            No
                                            {l.sinEvidencia > 0 && (
                                                <span className="text-muted-foreground block font-normal">
                                                    {plural(l.sinEvidencia, 'orden sin fotos', 'órdenes sin fotos')}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">Sin auditar</span>
                                    )}
                                </td>
                                <td className={cn(claseTd, 'text-xs')}>
                                    <ul role="list" className="grid gap-1.5">
                                        {l.acciones.map((a) => (
                                            <AccionRegistrada key={a.id} accion={a} editable={!cerrado} />
                                        ))}
                                    </ul>
                                    {!cerrado && l.auxiliarId && puede('seguimiento.registrar') && (
                                        <button
                                            type="button"
                                            onClick={() => onAccion(l)}
                                            className="text-primary focus-visible:ring-ring mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                        >
                                            <Plus className="size-3" aria-hidden="true" />
                                            Registrar acción
                                            <span className="sr-only"> para {l.auxiliar}</span>
                                        </button>
                                    )}
                                    {l.acciones.length === 0 && (cerrado || !l.auxiliarId || !puede('seguimiento.registrar')) && (
                                        <span className="text-muted-foreground">Sin acción</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </Tabla>

            <ObservacionesInforme informe={informe} />
        </Panel>
    );
}

const COLOR_ACCION: Record<string, string> = {
    felicitacion: 'bg-good-soft text-good',
    retroalimentacion: 'bg-warning-soft text-warning',
    llamado_atencion: 'bg-critical-soft text-critical',
    llamado_escrito: 'bg-critical-soft text-critical',
};

function AccionRegistrada({ accion, editable }: { accion: Accion; editable: boolean }) {
    const puede = usePuede();
    return (
        <li className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1">
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', COLOR_ACCION[accion.tipo])}>
                    {accion.tipoLabel}
                </span>
                {accion.descripcion && <span className="mt-0.5 block break-words">{accion.descripcion}</span>}
            </span>
            {editable && puede('seguimiento.registrar') && (
                <button
                    type="button"
                    onClick={() => router.delete(route('seguimiento.eliminar', accion.id), { preserveScroll: true })}
                    className="text-muted-foreground hover:text-critical focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-hidden"
                >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Quitar {accion.tipoLabel}</span>
                </button>
            )}
        </li>
    );
}

function ObservacionesInforme({ informe }: { informe: Informe }) {
    const puede = usePuede();
    const editable = informe.estado !== 'cerrado' && puede('informes.editar');
    const form = useForm({ observaciones: informe.observaciones ?? '' });

    if (!editable) {
        return informe.observaciones ? (
            <p className="border-t px-5 py-4 text-sm">
                <span className="font-semibold">Observaciones:</span> {informe.observaciones}
            </p>
        ) : null;
    }

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        form.patch(route('informes.observaciones', informe.id), { preserveScroll: true });
    };

    const id = `observaciones-${informe.id}`;
    return (
        <form onSubmit={guardar} className="grid gap-2 border-t px-5 py-4">
            <label htmlFor={id} className="text-sm font-semibold">
                Observaciones del informe
            </label>
            <textarea
                id={id}
                rows={2}
                maxLength={1000}
                value={form.data.observaciones}
                onChange={(e) => form.setData('observaciones', e.target.value)}
                aria-describedby={form.errors.observaciones ? `${id}-error` : undefined}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed transition-[color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-hidden"
            />
            <InputError id={`${id}-error`} message={form.errors.observaciones} />
            {form.isDirty && (
                <Button type="submit" variant="outline" className="h-8 w-fit rounded-lg text-xs" disabled={form.processing}>
                    {form.processing ? 'Guardando…' : 'Guardar observaciones'}
                </Button>
            )}
        </form>
    );
}

function DialogoAccion({
    informe,
    fila,
    tiposAccion,
    umbrales,
    onCerrar,
}: {
    informe: Informe;
    fila: Fila;
    tiposAccion: Props['tiposAccion'];
    umbrales: Props['umbrales'];
    onCerrar: () => void;
}) {
    const form = useForm({ user_id: fila.auxiliarId, informe_id: informe.id, tipo: fila.sugerencia ?? '', descripcion: '' });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('seguimiento.registrar'), { preserveScroll: true, onSuccess: onCerrar });
    };

    const porQue =
        fila.sugerencia === 'felicitacion'
            ? `Cumplimiento del ${fmt.pct(fila.cumplimiento)} y sin novedades.`
            : fila.sugerencia === 'llamado_atencion'
              ? `Cumplimiento por debajo del ${fmt.pctEntero(umbrales.llamado)}.`
              : fila.sugerencia === 'retroalimentacion'
                ? fila.novedades && fila.novedades !== 'Sin novedad'
                    ? `Novedades del día: ${fila.novedades}.`
                    : `Cumplimiento del ${fmt.pct(fila.cumplimiento)}, por debajo del ${fmt.pctEntero(umbrales.felicitacion)} de la felicitación.`
                : null;

    return (
        <Dialog open onOpenChange={(v) => !v && onCerrar()}>
            <DialogContent className="max-w-lg rounded-2xl">
                <form onSubmit={enviar} className="grid gap-5">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-lg font-extrabold">Acción para {fila.auxiliar}</DialogTitle>
                        <DialogDescription>
                            {[informe.sede, informe.sucursal].filter(Boolean).join(' · ')} · {fmt.numero(fila.realizadas)} de{' '}
                            {fmt.numero(fila.asignadas)} entregas ({fmt.pct(fila.cumplimiento)}). {fila.novedades}.
                        </DialogDescription>
                    </DialogHeader>

                    <fieldset className="grid gap-2" aria-describedby={form.errors.tipo ? 'tipo-error' : porQue ? 'tipo-sugerencia' : undefined}>
                        <legend className="mb-1 text-sm font-medium">
                            Qué se hace <span aria-hidden="true">*</span>
                        </legend>
                        {porQue && (
                            <p id="tipo-sugerencia" className="text-muted-foreground -mt-1 mb-1 text-xs">
                                Sugerida por los umbrales de Parámetros: {porQue}
                            </p>
                        )}
                        <div className="grid gap-1.5 sm:grid-cols-2">
                            {tiposAccion.map((t) => {
                                const elegido = form.data.tipo === t.valor;
                                const id = `tipo-${t.valor}`;
                                return (
                                    <label
                                        key={t.valor}
                                        htmlFor={id}
                                        className={cn(
                                            'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                            elegido ? 'border-primary bg-secondary font-semibold' : 'hover:bg-muted/60',
                                        )}
                                    >
                                        <input
                                            id={id}
                                            type="radio"
                                            name="tipo"
                                            value={t.valor}
                                            checked={elegido}
                                            onChange={() => form.setData('tipo', t.valor)}
                                            className="accent-primary size-4 shrink-0 outline-hidden"
                                        />
                                        <span className="flex-1">{t.texto}</span>
                                        {fila.sugerencia === t.valor && (
                                            <span className="bg-brand-coral-soft text-brand-coral-ink rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold">
                                                Sugerida
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                        <InputError id="tipo-error" message={form.errors.tipo} />
                    </fieldset>

                    <div className="grid gap-1.5">
                        <label htmlFor="descripcion-accion" className="text-sm font-medium">
                            Detalle
                        </label>
                        <textarea
                            id="descripcion-accion"
                            rows={3}
                            maxLength={500}
                            placeholder="Ej.: Se le recuerda tomar la foto de la fachada y de la remesa firmada."
                            value={form.data.descripcion}
                            onChange={(e) => form.setData('descripcion', e.target.value)}
                            aria-describedby={form.errors.descripcion ? 'descripcion-accion-error' : undefined}
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed transition-[color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-hidden"
                        />
                        <InputError id="descripcion-accion-error" message={form.errors.descripcion} />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCerrar} className="rounded-lg">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing} className="rounded-lg">
                            {form.processing ? 'Registrando…' : 'Registrar acción'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DialogoObservacion({ fila, onCerrar }: { fila: Fila; onCerrar: () => void }) {
    const form = useForm({ observacion: fila.observacion ?? '' });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        form.patch(route('informes.observacion', fila.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onCerrar()}>
            <DialogContent className="max-w-lg rounded-2xl">
                <form onSubmit={enviar} className="grid gap-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-lg font-extrabold">Observación sobre {fila.auxiliar}</DialogTitle>
                        <DialogDescription>
                            Se suma a las novedades de su fila en el informe y en el Excel. Se conserva aunque el informe se recalcule.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-1.5">
                        <label htmlFor="observacion-fila" className="text-sm font-medium">
                            Observación
                        </label>
                        <textarea
                            id="observacion-fila"
                            rows={3}
                            maxLength={500}
                            autoFocus
                            value={form.data.observacion}
                            onChange={(e) => form.setData('observacion', e.target.value)}
                            aria-describedby={form.errors.observacion ? 'observacion-fila-error' : undefined}
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed transition-[color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-hidden"
                        />
                        <InputError id="observacion-fila-error" message={form.errors.observacion} />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCerrar} className="rounded-lg">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing} className="rounded-lg">
                            {form.processing ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
