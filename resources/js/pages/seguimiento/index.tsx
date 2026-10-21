import { CampoBusqueda } from '@/components/admin/filtros';
import { claseTd, claseTh, Iniciales, SinResultados, Tabla } from '@/components/admin/piezas';
import { EstadoBadge as EstadoNivel, Segmentado } from '@/components/dashboard/piezas';
import { CalendarDays, Felicitacion, MessageCircle, Plus, ShieldAlert, Target } from '@/components/iconos';
import InputError from '@/components/input-error';
import { LINEA_LOGISTICA, MarcoLinea } from '@/components/linea/marco-linea';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePuede } from '@/hooks/use-puede';
import { fmt, type NivelEstado } from '@/lib/formato';
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
    /** Porcentaje de entregas auditadas que cumplen el protocolo (null sin auditorías). */
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

function nivel(cumplimiento: number): { nivel: NivelEstado; texto: string } {
    if (cumplimiento >= 100) return { nivel: 'good', texto: 'Operación completa' };
    if (cumplimiento >= 80) return { nivel: 'warning', texto: 'Revisar pendientes' };
    return { nivel: 'critical', texto: 'Seguimiento inmediato' };
}

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

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
            <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Del <strong className="text-foreground font-semibold">{fmt.fechaMedia(periodo.desde)}</strong> al{' '}
                    <strong className="text-foreground font-semibold">{fmt.fechaMedia(periodo.hasta)}</strong> ·{' '}
                    {plural(personas.length, 'persona con entregas', 'personas con entregas')}
                </p>
                <div className="w-full sm:w-72">
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
            </div>

            {personas.length === 0 ? (
                <SinResultados texto={filtros.q ? 'Nadie coincide con la búsqueda.' : 'Nadie tiene entregas en este periodo.'} />
            ) : (
                <Tabla titulo="Desempeño por persona" minimo="min-w-[980px]" columnas={['26%', '8%', '12%', '13%', '10%', '10%', '21%']}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            {['Persona', 'Jornadas', 'Entregas', 'Cumplimiento', 'Sin evidencias', 'Protocolo', 'Acciones del periodo'].map((t) => (
                                <th key={t} scope="col" className={claseTh}>
                                    {t}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {personas.map((p) => {
                            const n = nivel(p.cumplimiento);
                            const total = Object.values(p.conteo).reduce((s, v) => s + v, 0);
                            return (
                                <tr key={p.id} className={cn('hover:bg-muted/40 align-top transition-colors', !p.activo && 'text-muted-foreground')}>
                                    <th scope="row" className={cn(claseTd, 'font-normal')}>
                                        <div className="flex items-center gap-3">
                                            <Iniciales texto={p.nombre} />
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setElegida(p)}
                                                    className="text-foreground focus-visible:ring-ring block max-w-full truncate rounded-sm text-left font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                                    title={p.nombre}
                                                >
                                                    {p.nombre}
                                                </button>
                                                <p className="text-muted-foreground truncate text-xs">
                                                    {[p.cedula && `C.C. ${p.cedula}`, p.cargo].filter(Boolean).join(' · ')}
                                                </p>
                                            </div>
                                        </div>
                                    </th>
                                    <td className={cn(claseTd, 'tabular-nums')}>{p.jornadas}</td>
                                    <td className={cn(claseTd, 'tabular-nums')}>
                                        {fmt.numero(p.realizadas)} de {fmt.numero(p.asignadas)}
                                    </td>
                                    <td className={claseTd}>
                                        <EstadoNivel nivel={n.nivel}>
                                            {fmt.pct(p.cumplimiento)}
                                            <span className="sr-only">: {n.texto}</span>
                                        </EstadoNivel>
                                    </td>
                                    <td className={cn(claseTd, 'tabular-nums', p.sinEvidencia > 0 && 'text-critical font-semibold')}>
                                        {p.sinEvidencia}
                                    </td>
                                    <td className={cn(claseTd, 'tabular-nums')}>
                                        {p.protocolo === null ? (
                                            <span className="text-muted-foreground text-xs">Sin auditar</span>
                                        ) : (
                                            fmt.pct(p.protocolo)
                                        )}
                                    </td>
                                    <td className={cn(claseTd, 'text-xs')}>
                                        {total === 0 ? (
                                            <span className="text-muted-foreground">Ninguna</span>
                                        ) : (
                                            <ul role="list" className="flex flex-wrap gap-1.5">
                                                {Object.entries(p.conteo)
                                                    .filter(([, v]) => v > 0)
                                                    .map(([tipo, v]) => (
                                                        <li
                                                            key={tipo}
                                                            className={cn('inline-flex rounded-full px-2 py-0.5 font-semibold', TIPOS[tipo]?.clase)}
                                                        >
                                                            {v} {TIPOS[tipo]?.corto.toLowerCase()}
                                                        </li>
                                                    ))}
                                            </ul>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setElegida(p)}
                                            className="text-primary focus-visible:ring-ring mt-1.5 inline-flex items-center gap-1 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                                        >
                                            {puede('seguimiento.registrar') ? (
                                                <>
                                                    <Plus className="size-3" aria-hidden="true" />
                                                    Registrar o ver historial
                                                </>
                                            ) : (
                                                'Ver historial'
                                            )}
                                            <span className="sr-only"> de {p.nombre}</span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Tabla>
            )}

            <Sheet open={abierta !== null} onOpenChange={(v) => !v && setElegida(null)}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
                    {abierta && <DetallePersona persona={abierta} tiposAccion={tiposAccion} />}
                </SheetContent>
            </Sheet>
        </MarcoLinea>
    );
}

function DetallePersona({ persona, tiposAccion }: { persona: Persona; tiposAccion: Props['tiposAccion'] }) {
    const puede = usePuede();
    const form = useForm({ user_id: persona.id, informe_id: null as number | null, tipo: '', descripcion: '' });

    const registrar = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('seguimiento.registrar'), { preserveScroll: true, preserveState: true, onSuccess: () => form.reset('tipo', 'descripcion') });
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

            <div className="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-6">
                {puede('seguimiento.registrar') && (
                    <form onSubmit={registrar} className="grid gap-4 rounded-xl border p-4">
                        <fieldset className="grid gap-2" aria-describedby={form.errors.tipo ? 'tipo-error' : undefined}>
                            <legend className="mb-1 text-sm font-semibold">Registrar una acción</legend>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                                {tiposAccion.map((t) => {
                                    const id = `tipo-${t.valor}`;
                                    const elegido = form.data.tipo === t.valor;
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
                        <Button type="submit" disabled={form.processing} className="h-10 w-fit rounded-lg px-4 font-semibold">
                            {form.processing ? 'Registrando…' : 'Registrar acción'}
                        </Button>
                    </form>
                )}

                <section aria-labelledby="titulo-historial">
                    <h3 id="titulo-historial" className="flex items-center gap-2 text-sm font-bold">
                        <Target className="text-primary size-4" aria-hidden="true" />
                        Acciones recientes
                    </h3>
                    {persona.acciones.length === 0 ? (
                        <p className="text-muted-foreground mt-3 text-sm">Aún no tiene acciones en este periodo.</p>
                    ) : (
                        <ol role="list" className="mt-3 grid gap-3">
                            {persona.acciones.map((a) => {
                                const Icono = TIPOS[a.tipo]?.icono ?? MessageCircle;
                                return (
                                    <li key={a.id} className="flex gap-3">
                                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', TIPOS[a.tipo]?.clase)}>
                                            <Icono className="size-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0 text-sm">
                                            <p className="font-semibold">{a.tipoLabel}</p>
                                            {a.descripcion && <p className="break-words">{a.descripcion}</p>}
                                            <p className="text-muted-foreground text-xs">
                                                {fmt.fechaMedia(a.fecha)}
                                                {a.efectividad !== null && ` · cumplimiento del día ${fmt.pct(a.efectividad)}`}
                                                {a.registradaPor && ` · ${a.registradaPor}`}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>
        </>
    );
}
