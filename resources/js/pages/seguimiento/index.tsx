import { ConfirmarEliminar } from '@/components/admin/acciones';
import { CampoBusqueda, POCOS_PARA_FILTRAR } from '@/components/admin/filtros';
import { claseTd, claseTh, DatosBloque, SinResultados, Tabla } from '@/components/admin/piezas';
import { EstadoBadge as EstadoNivel, Segmentado } from '@/components/dashboard/piezas';
import { Felicitacion, MessageCircle, MoreHorizontal, Pencil, ShieldAlert, Trash2 } from '@/components/iconos';
import InputError from '@/components/input-error';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePuede } from '@/hooks/use-puede';
import { fmt, semaforo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

interface AccionHistorial {
    id: number;
    fecha: string;
    tipo: string;
    tipoLabel: string;
    descripcion: string | null;
    efectividad: number | null;
    registradaPor: string | null;
    /** Si quien mira la puede corregir o quitar: quien la registró, y no si su informe está cerrado. */
    editable: boolean;
}

interface Persona {
    id: number;
    nombre: string;
    cedula: string | null;
    cargo: string | null;
    activo: boolean;
    jornadas: number;
    asignadas: number;
    realizadas: number;
    cumplimiento: number;
    sinEvidencia: number;
    /** Porcentaje de órdenes auditadas que cumplen el protocolo (null sin auditorías). */
    protocolo: number | null;
    ultimaJornada: string;
    conteo: Record<string, number>;
    acciones: AccionHistorial[];
}

interface Props {
    filtros: { q: string; sede: string; periodo: string };
    periodo: { desde: string; hasta: string; dias: number };
    sedes: { id: number; nombre: string }[];
    personas: Persona[];
    tiposAccion: { valor: string; texto: string }[];
}

const TIPOS: Record<string, { clase: string; icono: typeof Felicitacion; corto: string }> = {
    felicitacion: { clase: 'bg-good-soft text-good', icono: Felicitacion, corto: 'Felicitaciones' },
    retroalimentacion: { clase: 'bg-warning-soft text-warning', icono: MessageCircle, corto: 'Retroalimentaciones' },
    llamado_atencion: { clase: 'bg-critical-soft text-critical', icono: ShieldAlert, corto: 'Llamados verbales' },
    llamado_escrito: { clase: 'bg-critical-soft text-critical', icono: ShieldAlert, corto: 'Llamados escritos' },
};

const nivel = (cumplimiento: number) => semaforo(cumplimiento)!;

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

/** Hoy en el equipo de quien mira, como "AAAA-MM-DD" (para comparar con las fechas del periodo). */
const hoyIso = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

export default function Seguimiento({ filtros, periodo, sedes, personas, tiposAccion }: Props) {
    const puede = usePuede();
    const [q, setQ] = useState(filtros.q);
    const [elegida, setElegida] = useState<Persona | null>(null);
    const espera = useRef<number>(undefined);

    const filtrar = (cambios: Partial<Props['filtros']>) => {
        const valores = { ...filtros, q, ...cambios };
        router.get(route('seguimiento.index'), Object.fromEntries(Object.entries(valores).filter(([, v]) => v)), {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    useEffect(() => () => window.clearTimeout(espera.current), []);
    // Al recargar los datos, el panel abierto muestra la persona actualizada
    const abierta = elegida ? (personas.find((p) => p.id === elegida.id) ?? elegida) : null;
    // Con pocas personas caben todas a la vista: la búsqueda aparece cuando hay muchas (o si ya hay una puesta)
    const conBusqueda = personas.length > POCOS_PARA_FILTRAR || filtros.q !== '';
    const registra = puede('seguimiento.registrar');

    // Lo de cada persona: lo mismo en la tabla (desde 1024 px) y en los bloques (debajo). Solo lo que distingue:
    // las evidencias y el protocolo cuando hay algo que decir, y las acciones cuando las hubo
    const personaDe = (p: Persona) => (
        <div className="min-w-0">
            <p className="text-foreground font-semibold break-words">{p.nombre}</p>
            {p.cedula && <p className="text-muted-foreground text-xs tabular-nums">C.C. {p.cedula}</p>}
        </div>
    );
    const entregasDe = (p: Persona) => (
        <div className="tabular-nums">
            <p className="font-semibold">
                {fmt.numero(p.realizadas)} de {fmt.numero(p.asignadas)}
            </p>
            <p className="text-muted-foreground text-xs">En {plural(p.jornadas, 'jornada', 'jornadas')}</p>
        </div>
    );
    const efectividadDe = (p: Persona) => {
        const n = nivel(p.cumplimiento);
        return (
            <EstadoNivel nivel={n.nivel}>
                {fmt.pct(p.cumplimiento)}
                <span className="sr-only">: {n.texto}</span>
            </EstadoNivel>
        );
    };
    const evidenciasDe = (p: Persona) =>
        p.sinEvidencia === 0 && p.protocolo === null ? (
            <span className="text-muted-foreground text-xs">
                <span aria-hidden="true">—</span>
                <span className="sr-only">Completas y sin auditar</span>
            </span>
        ) : (
            <div className="text-xs">
                {p.sinEvidencia > 0 && (
                    <p className="text-critical font-semibold">{plural(p.sinEvidencia, 'orden sin evidencias', 'órdenes sin evidencias')}</p>
                )}
                {p.protocolo !== null && <p className="text-muted-foreground">Protocolo {fmt.pct(p.protocolo)}</p>}
            </div>
        );
    const accionesDe = (p: Persona) => {
        const hechas = Object.entries(p.conteo).filter(([, v]) => v > 0);
        return hechas.length === 0 ? (
            <span className="text-muted-foreground text-xs">
                <span aria-hidden="true">—</span>
                <span className="sr-only">Ninguna en el periodo</span>
            </span>
        ) : (
            <ul role="list" className="flex flex-wrap gap-1.5 text-xs">
                {hechas.map(([tipo, v]) => (
                    <li key={tipo} className={cn('inline-flex rounded-full px-2 py-0.5 font-semibold', TIPOS[tipo]?.clase)}>
                        {v} {TIPOS[tipo]?.corto.toLowerCase()}
                    </li>
                ))}
            </ul>
        );
    };
    const abrirDe = (p: Persona) => (
        <Button variant="outline" className="h-9 rounded-lg text-xs font-semibold" onClick={() => setElegida(p)}>
            {registra ? 'Registrar acción' : 'Ver historial'}
            <span className="sr-only">{registra ? ` para ${p.nombre}` : ` de ${p.nombre}`}</span>
        </Button>
    );

    return (
        <MarcoLinea
            slug={LINEA_LOGISTICA}
            titulo="Seguimiento y desempeño"
            seccion="seguimiento"
            pestanas
            acciones={
                <div className="flex flex-wrap items-center gap-2">
                    <Segmentado<string>
                        etiqueta="Periodo"
                        valor={filtros.periodo}
                        onChange={(v) => filtrar({ periodo: v })}
                        opciones={[
                            { valor: '7', texto: '7 días' },
                            { valor: '30', texto: '30 días' },
                            { valor: '90', texto: '90 días' },
                        ]}
                    />
                    {sedes.length > 1 && (
                        <div className="w-52">
                            <label htmlFor="filtro-sede" className="sr-only">
                                Sede
                            </label>
                            <Selector
                                id="filtro-sede"
                                valor={filtros.sede}
                                onCambio={(v) => filtrar({ sede: v })}
                                className="bg-card h-9 text-xs font-semibold"
                                opciones={[{ valor: '', texto: 'Todas las sedes' }, ...sedes.map((s) => ({ valor: String(s.id), texto: s.nombre }))]}
                            />
                        </div>
                    )}
                </div>
            }
        >
            <div className="-mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* El periodo cuenta desde la última jornada con entregas: si es anterior a hoy, se dice */}
                <p className="text-muted-foreground max-w-prose text-sm text-pretty">
                    Del <strong className="text-foreground font-semibold">{fmt.fechaMedia(periodo.desde)}</strong> al{' '}
                    <strong className="text-foreground font-semibold">{fmt.fechaMedia(periodo.hasta)}</strong>
                    {periodo.hasta < hoyIso() && ', la última jornada con entregas'} · {plural(personas.length, 'persona', 'personas')}
                </p>
                {conBusqueda && (
                    <div role="search" className="w-full lg:w-72">
                        <CampoBusqueda
                            id="buscar-personas"
                            etiqueta="Buscar personas"
                            placeholder="Buscar por nombre o cédula"
                            valor={q}
                            onCambio={(v) => {
                                setQ(v);
                                window.clearTimeout(espera.current);
                                espera.current = window.setTimeout(() => filtrar({ q: v }), 350);
                            }}
                        />
                    </div>
                )}
            </div>

            {personas.length === 0 ? (
                <SinResultados texto={filtros.q ? 'Nadie coincide con la búsqueda.' : 'Nadie tiene entregas en este periodo.'} />
            ) : (
                <>
                    {/* Desde 1024 px, la tabla; debajo, un bloque por persona (nada se desplaza de lado) */}
                    <div className="hidden lg:block">
                        <Tabla titulo="Desempeño por persona" minimo="min-w-[860px]" columnas={['25%', '13%', '12%', '17%', '19%', '14%']}>
                            <thead className="text-muted-foreground border-b">
                                <tr>
                                    {['Persona', 'Entregas', 'Efectividad', 'Evidencias', 'Acciones del periodo'].map((t) => (
                                        <th key={t} scope="col" className={claseTh}>
                                            {t}
                                        </th>
                                    ))}
                                    <th scope="col" className={claseTh}>
                                        <span className="sr-only">Seguimiento</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {personas.map((p) => (
                                    <tr
                                        key={p.id}
                                        className={cn('hover:bg-muted/40 align-top transition-colors', !p.activo && 'text-muted-foreground')}
                                    >
                                        <th scope="row" className={cn(claseTd, 'font-normal')}>
                                            {personaDe(p)}
                                        </th>
                                        <td className={claseTd}>{entregasDe(p)}</td>
                                        <td className={claseTd}>{efectividadDe(p)}</td>
                                        <td className={claseTd}>{evidenciasDe(p)}</td>
                                        <td className={claseTd}>{accionesDe(p)}</td>
                                        <td className={cn(claseTd, 'text-right')}>{abrirDe(p)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Tabla>
                    </div>
                    <ul
                        role="list"
                        aria-label="Desempeño por persona"
                        className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:hidden"
                    >
                        {personas.map((p) => (
                            <li key={p.id} className={cn('grid gap-3 px-4 py-4 sm:px-5', !p.activo && 'text-muted-foreground')}>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">{personaDe(p)}</div>
                                    {abrirDe(p)}
                                </div>
                                <DatosBloque
                                    datos={[
                                        ['Entregas', entregasDe(p)],
                                        ['Efectividad', efectividadDe(p)],
                                        ['Evidencias', evidenciasDe(p)],
                                        ['Acciones', accionesDe(p)],
                                    ]}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <Sheet open={abierta !== null} onOpenChange={(v) => !v && setElegida(null)}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
                    {abierta && <DetallePersona key={abierta.id} persona={abierta} tiposAccion={tiposAccion} />}
                </SheetContent>
            </Sheet>
        </MarcoLinea>
    );
}

function DetallePersona({ persona, tiposAccion }: { persona: Persona; tiposAccion: Props['tiposAccion'] }) {
    const puede = usePuede();
    const form = useForm({ user_id: persona.id, informe_id: null as number | null, tipo: '', descripcion: '' });
    // La acción que se está corrigiendo: el mismo formulario se llena con ella
    const [corrigiendo, setCorrigiendo] = useState<AccionHistorial | null>(null);
    const [quitando, setQuitando] = useState<AccionHistorial | null>(null);
    const historial = useRef<HTMLHeadingElement>(null);

    const corregir = (a: AccionHistorial) => {
        setCorrigiendo(a);
        form.clearErrors();
        form.setData((d) => ({ ...d, tipo: a.tipo, descripcion: a.descripcion ?? '' }));
        // El menú se cierra y el foco va a la opción marcada del formulario, que ahora muestra la acción
        window.setTimeout(() => document.getElementById(`tipo-${a.tipo}`)?.focus(), 0);
    };
    const terminar = () => {
        setCorrigiendo(null);
        form.reset('tipo', 'descripcion');
        form.clearErrors();
    };

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: terminar };
        if (corrigiendo) form.put(route('seguimiento.actualizar', corrigiendo.id), opciones);
        else form.post(route('seguimiento.registrar'), opciones);
    };

    return (
        <>
            <SheetHeader className="border-b px-6 pt-6 pb-5 text-left">
                <SheetTitle className="pr-8 text-xl font-extrabold tracking-tight">{persona.nombre}</SheetTitle>
                <SheetDescription>
                    {fmt.numero(persona.realizadas)} de {fmt.numero(persona.asignadas)} entregas ({fmt.pct(persona.cumplimiento)}) en{' '}
                    {plural(persona.jornadas, 'jornada', 'jornadas')}
                    {persona.sinEvidencia > 0 && ` · ${plural(persona.sinEvidencia, 'orden sin evidencias', 'órdenes sin evidencias')}`}.
                </SheetDescription>
            </SheetHeader>

            <div className="grid flex-1 content-start overflow-y-auto">
                {puede('seguimiento.registrar') && (
                    <form
                        onSubmit={enviar}
                        noValidate
                        className={cn('grid gap-4 border-b px-6 py-6', corrigiendo && 'bg-secondary/50 dark:bg-primary/5')}
                    >
                        <fieldset className="grid gap-2" aria-describedby={form.errors.tipo ? 'tipo-error' : undefined}>
                            <legend className="mb-1 text-sm font-semibold">
                                {corrigiendo ? `Corregir la acción del ${fmt.fechaMedia(corrigiendo.fecha)}` : 'Registrar una acción'}
                            </legend>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                                {tiposAccion.map((t) => {
                                    const id = `tipo-${t.valor}`;
                                    const elegido = form.data.tipo === t.valor;
                                    return (
                                        <label
                                            key={t.valor}
                                            htmlFor={id}
                                            className={cn(
                                                'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 bg-background flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                                elegido ? 'border-primary bg-secondary font-semibold' : 'hover:bg-muted/60',
                                            )}
                                        >
                                            <input
                                                id={id}
                                                type="radio"
                                                name="tipo"
                                                checked={elegido}
                                                onChange={() => form.setData('tipo', t.valor)}
                                                className="accent-primary size-4 shrink-0 outline-hidden"
                                            />
                                            {t.texto}
                                        </label>
                                    );
                                })}
                            </div>
                            <InputError id="tipo-error" message={form.errors.tipo} />
                        </fieldset>
                        <div className="grid gap-1.5">
                            <label htmlFor="detalle-accion" className="text-sm font-medium">
                                Detalle
                            </label>
                            <textarea
                                id="detalle-accion"
                                rows={3}
                                maxLength={500}
                                value={form.data.descripcion}
                                onChange={(e) => form.setData('descripcion', e.target.value)}
                                aria-describedby={form.errors.descripcion ? 'detalle-accion-error' : undefined}
                                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed transition-[color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-hidden"
                            />
                            <InputError id="detalle-accion-error" message={form.errors.descripcion} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" disabled={form.processing} className="h-10 w-fit rounded-lg px-4 font-semibold">
                                {form.processing ? 'Guardando…' : corrigiendo ? 'Guardar cambios' : 'Registrar acción'}
                            </Button>
                            {corrigiendo && (
                                <Button type="button" variant="ghost" onClick={terminar} className="h-10 rounded-lg px-3 font-semibold">
                                    Cancelar
                                </Button>
                            )}
                        </div>
                    </form>
                )}

                <section aria-labelledby="titulo-historial" className="px-6 py-6">
                    {/* Recibe el foco al eliminar una acción: la lista cambia y el foco no se pierde */}
                    <h3 id="titulo-historial" ref={historial} tabIndex={-1} className="text-sm font-semibold outline-hidden">
                        Acciones del periodo
                    </h3>
                    {persona.acciones.length === 0 ? (
                        <p className="text-muted-foreground mt-3 text-sm">Aún no tiene acciones en este periodo.</p>
                    ) : (
                        <ol role="list" className="mt-3 grid gap-3">
                            {persona.acciones.map((a) => {
                                const Icono = TIPOS[a.tipo]?.icono ?? MessageCircle;
                                return (
                                    <li key={a.id} className={cn('flex gap-3', corrigiendo?.id === a.id && 'opacity-60')}>
                                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', TIPOS[a.tipo]?.clase)}>
                                            <Icono className="size-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0 flex-1 text-sm">
                                            <p className="font-semibold">{a.tipoLabel}</p>
                                            {a.descripcion && <p className="break-words">{a.descripcion}</p>}
                                            <p className="text-muted-foreground text-xs">
                                                {fmt.fechaMedia(a.fecha)}
                                                {a.efectividad !== null && ` · efectividad del día ${fmt.pct(a.efectividad)}`}
                                                {a.registradaPor && ` · ${a.registradaPor}`}
                                            </p>
                                        </div>
                                        {a.editable && puede('seguimiento.registrar') && (
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-foreground -mt-1 size-9 shrink-0 rounded-lg"
                                                    >
                                                        <MoreHorizontal className="size-5" aria-hidden="true" />
                                                        <span className="sr-only">
                                                            Más acciones para {a.tipoLabel} del {fmt.fechaMedia(a.fecha)}
                                                        </span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-40">
                                                    <DropdownMenuItem onSelect={() => corregir(a)} className="gap-2">
                                                        <Pencil className="size-4" aria-hidden="true" />
                                                        Corregir
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={() => setQuitando(a)}
                                                        className="text-critical focus:text-critical gap-2"
                                                    >
                                                        <Trash2 className="size-4" aria-hidden="true" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>
            {quitando && (
                <ConfirmarEliminar
                    abierto
                    nombre={`esta acción (${quitando.tipoLabel} del ${fmt.fechaMedia(quitando.fecha)})`}
                    url={route('seguimiento.eliminar', quitando.id)}
                    consecuencia="Deja de contar en el seguimiento de la persona. No se borra: queda en el historial, con quién y cuándo se eliminó."
                    onCerrar={() => setQuitando(null)}
                    focoAlCerrar={historial}
                />
            )}
        </>
    );
}
