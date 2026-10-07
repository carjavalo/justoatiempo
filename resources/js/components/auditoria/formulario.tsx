import { BotonEnviar } from '@/components/boton-enviar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { evaluar, MIN_DESTAPADO, MIN_SELLADO, type Checklist } from '@/lib/protocolo';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Lock, Minus, Plus, XCircle } from '@/components/iconos';
import { type FormEventHandler, type ReactNode, useEffect, useMemo, useState } from 'react';
import { consultaFiltros } from './cola';
import { type FiltrosAuditoria, type OrdenDetalle, type TipoNovedad } from './tipos';
import { Selector } from '@/components/selector';

const claseCampo = 'border-input bg-background w-full rounded-lg border px-3 text-sm transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-60';

function Indicador({ ok, texto }: { ok: boolean; texto: string }) {
    const Icono = ok ? CheckCircle2 : XCircle;
    return (
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', ok ? 'text-good' : 'text-critical')}>
            <Icono className="size-4" aria-hidden="true" />
            {texto}
        </span>
    );
}

/** Fila de la lista de chequeo: número, nombre, control y si cumple. */
function Item({ numero, titulo, detalle, estado, children }: { numero: number; titulo: string; detalle: string; estado: ReactNode; children: ReactNode }) {
    return (
        <li className="grid gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex gap-3">
                <span className="bg-secondary text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">
                    {numero}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-semibold">{titulo}</p>
                        {estado}
                    </div>
                    <p className="text-muted-foreground text-xs">{detalle}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pl-10">{children}</div>
        </li>
    );
}

/** Contador de fotos: campo numérico con botones − / + (teclado y lector incluidos). */
function Contador({ id, etiqueta, valor, onChange, deshabilitado }: { id: string; etiqueta: string; valor: number; onChange: (n: number) => void; deshabilitado: boolean }) {
    const fijar = (n: number) => onChange(Math.max(0, Math.min(50, Number.isFinite(n) ? n : 0)));
    const boton = 'border-input hover:bg-muted flex size-9 items-center justify-center rounded-lg border transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-50';
    return (
        <div className="flex items-center gap-1.5">
            <button type="button" className={boton} onClick={() => fijar(valor - 1)} disabled={deshabilitado || valor <= 0} aria-label={`Restar una foto de ${etiqueta}`}>
                <Minus className="size-4" aria-hidden="true" />
            </button>
            <label htmlFor={id} className="sr-only">
                {etiqueta}
            </label>
            <input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                value={valor}
                disabled={deshabilitado}
                onChange={(e) => fijar(parseInt(e.target.value, 10))}
                className={cn(claseCampo, 'tabular h-9 w-14 text-center font-bold')}
            />
            <button type="button" className={boton} onClick={() => fijar(valor + 1)} disabled={deshabilitado || valor >= 50} aria-label={`Sumar una foto de ${etiqueta}`}>
                <Plus className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

function Interruptor({ id, etiqueta, valor, onChange, deshabilitado }: { id: string; etiqueta: string; valor: boolean; onChange: (v: boolean) => void; deshabilitado: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <Checkbox id={id} checked={valor} disabled={deshabilitado} onCheckedChange={(v) => onChange(v === true)} />
            <Label htmlFor={id} className="text-sm font-medium">
                {etiqueta}
            </Label>
        </div>
    );
}

export function FormularioAuditoria({
    orden,
    tiposNovedad,
    siguiente,
    filtros,
}: {
    orden: OrdenDetalle;
    tiposNovedad: TipoNovedad[];
    siguiente: { id: number; codigo: string } | null;
    filtros: FiltrosAuditoria;
}) {
    const a = orden.auditoria;
    const idNovedad = (nombre: string) => tiposNovedad.find((t) => t.nombre === nombre)?.id ?? null;

    const { data, setData, transform, post, processing, errors } = useForm({
        foto_fachada: a.foto_fachada,
        fotos_sellado: a.fotos_sellado,
        fotos_destapado: a.fotos_destapado,
        foto_remesa: a.foto_remesa,
        foto_rotulo: a.foto_rotulo,
        recibe_sin_destapar: a.recibe_sin_destapar,
        sin_evidencia: a.sin_evidencia,
        tipo_novedad_id: a.tipo_novedad_id ?? idNovedad(orden.sugerencia.novedad),
        concepto: a.concepto ?? orden.sugerencia.concepto,
    });

    // Mientras la persona no los edite, novedad y concepto siguen a la lista de chequeo
    const [editado, setEditado] = useState({ novedad: a.auditada, concepto: a.auditada });
    const evaluacion = useMemo(() => evaluar(data as Checklist), [data]);

    useEffect(() => {
        if (!editado.novedad) setData('tipo_novedad_id', idNovedad(evaluacion.novedad));
        if (!editado.concepto) setData('concepto', evaluacion.concepto);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [evaluacion.novedad, evaluacion.concepto]);

    const bloqueado = orden.informeCerrado;
    const sinEvidencia = data.sin_evidencia;
    const cambiar = <K extends keyof Checklist>(campo: K, valor: Checklist[K]) => setData(campo, valor as never);

    transform((d) => ({ ...d, siguiente: siguiente?.id ?? null }));

    const guardar: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing || bloqueado) return;
        const query = new URLSearchParams(consultaFiltros(filtros)).toString();
        post(`/auditoria/${orden.id}?${query}`, { preserveScroll: false });
    };

    const textoGuardar = siguiente ? `Guardar y seguir con ${siguiente.codigo}` : 'Guardar auditoría';
    const sugerenciaDistinta = editado.concepto && data.concepto !== evaluacion.concepto;

    return (
        <form
            onSubmit={guardar}
            onKeyDown={(e) => {
                // Ctrl/Cmd + Enter guarda desde cualquier campo (para auditar muchas órdenes seguidas)
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar(e);
            }}
            aria-labelledby="titulo-chequeo"
        >
            {bloqueado && (
                <p className="bg-muted text-muted-foreground mb-4 flex items-center gap-2 rounded-lg p-3 text-sm">
                    <Lock className="size-4 shrink-0" aria-hidden="true" />
                    El informe de esta jornada ya está cerrado: la auditoría es de solo lectura.
                </p>
            )}

            <fieldset disabled={bloqueado} className="min-w-0">
                <legend id="titulo-chequeo" className="text-sm font-bold">
                    Lista de chequeo del protocolo
                </legend>

                <div className="bg-muted/40 mt-3 rounded-xl border p-3">
                    <Interruptor id="sin-evidencia" etiqueta="La entrega no tiene evidencias" valor={sinEvidencia} onChange={(v) => cambiar('sin_evidencia', v)} deshabilitado={bloqueado} />
                </div>

                <ol role="list" className={cn('mt-4 divide-y', sinEvidencia && 'opacity-50')} aria-disabled={sinEvidencia || undefined}>
                    <Item numero={1} titulo="Foto de fachada" detalle="Certifica la dirección de entrega" estado={<Indicador ok={data.foto_fachada} texto={data.foto_fachada ? 'Cumple' : 'Falta'} />}>
                        <Interruptor id="foto-fachada" etiqueta="Tiene foto de fachada" valor={data.foto_fachada} onChange={(v) => cambiar('foto_fachada', v)} deshabilitado={bloqueado || sinEvidencia} />
                    </Item>
                    <Item
                        numero={2}
                        titulo="Producto sellado"
                        detalle={`Mínimo ${MIN_SELLADO} fotos desde todos los ángulos, en su empaque`}
                        estado={<Indicador ok={data.fotos_sellado >= MIN_SELLADO} texto={`${data.fotos_sellado} de ${MIN_SELLADO}`} />}
                    >
                        <Contador id="fotos-sellado" etiqueta="producto sellado" valor={data.fotos_sellado} onChange={(n) => cambiar('fotos_sellado', n)} deshabilitado={bloqueado || sinEvidencia} />
                    </Item>
                    <Item
                        numero={3}
                        titulo="Producto destapado"
                        detalle={`Mínimo ${MIN_DESTAPADO} fotos en perfecto estado, o la nota firmada en la remesa`}
                        estado={
                            data.recibe_sin_destapar ? (
                                <Indicador ok texto="Exento: recibe sin destapar" />
                            ) : (
                                <Indicador ok={data.fotos_destapado >= MIN_DESTAPADO} texto={`${data.fotos_destapado} de ${MIN_DESTAPADO}`} />
                            )
                        }
                    >
                        <Contador
                            id="fotos-destapado"
                            etiqueta="producto destapado"
                            valor={data.fotos_destapado}
                            onChange={(n) => cambiar('fotos_destapado', n)}
                            deshabilitado={bloqueado || sinEvidencia || data.recibe_sin_destapar}
                        />
                        <Interruptor
                            id="sin-destapar"
                            etiqueta="«Recibe sin destapar a conformidad»"
                            valor={data.recibe_sin_destapar}
                            onChange={(v) => cambiar('recibe_sin_destapar', v)}
                            deshabilitado={bloqueado || sinEvidencia}
                        />
                    </Item>
                    <Item numero={4} titulo="Remesa o factura firmada" detalle="Constancia de recibido del cliente; el rótulo es opcional" estado={<Indicador ok={data.foto_remesa} texto={data.foto_remesa ? 'Cumple' : 'Falta'} />}>
                        <Interruptor id="foto-remesa" etiqueta="Remesa firmada" valor={data.foto_remesa} onChange={(v) => cambiar('foto_remesa', v)} deshabilitado={bloqueado || sinEvidencia} />
                        <Interruptor id="foto-rotulo" etiqueta="Rótulo" valor={data.foto_rotulo} onChange={(v) => cambiar('foto_rotulo', v)} deshabilitado={bloqueado || sinEvidencia} />
                    </Item>
                </ol>

                {/* Resultado en vivo */}
                <div
                    role="status"
                    className={cn('mt-5 flex items-start gap-3 rounded-xl p-4 text-sm', evaluacion.cumple ? 'bg-good-soft text-good' : 'bg-critical-soft text-critical')}
                >
                    {evaluacion.cumple ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
                    <p>
                        <strong className="font-bold">{evaluacion.cumple ? 'Cumple el protocolo de entrega.' : 'No cumple el protocolo.'}</strong>{' '}
                        {!evaluacion.cumple && <span className="font-medium">Falta: {evaluacion.faltantes.join(', ')}.</span>}
                    </p>
                </div>

                <div className="mt-5 grid gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="novedad">Novedad principal</Label>
                        <Selector
                            id="novedad"
                            valor={data.tipo_novedad_id ? String(data.tipo_novedad_id) : ''}
                            onCambio={(v) => {
                                setEditado((x) => ({ ...x, novedad: true }));
                                setData('tipo_novedad_id', v ? Number(v) : null);
                            }}
                            aria-describedby={errors.tipo_novedad_id ? 'novedad-error' : undefined}
                            opciones={[{ valor: '', texto: 'Sin novedad registrada' }, ...tiposNovedad.map((t) => ({ valor: String(t.id), texto: t.nombre }))]}
                        />
                        {errors.tipo_novedad_id && (
                            <p id="novedad-error" className="text-critical text-sm">
                                {errors.tipo_novedad_id}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="concepto">Concepto</Label>
                            {sugerenciaDistinta && !bloqueado && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditado({ novedad: false, concepto: false });
                                        setData((d) => ({ ...d, concepto: evaluacion.concepto, tipo_novedad_id: idNovedad(evaluacion.novedad) }));
                                    }}
                                    className="text-primary text-xs font-semibold hover:underline"
                                >
                                    Usar el texto sugerido
                                </button>
                            )}
                        </div>
                        <textarea
                            id="concepto"
                            rows={3}
                            maxLength={500}
                            value={data.concepto ?? ''}
                            onChange={(e) => {
                                setEditado((x) => ({ ...x, concepto: true }));
                                setData('concepto', e.target.value);
                            }}
                            aria-describedby="concepto-ayuda"
                            className={cn(claseCampo, 'py-2 leading-relaxed')}
                        />
                        <p id="concepto-ayuda" className="text-muted-foreground text-xs">
                            Se sugiere según la lista de chequeo. Queda en el informe diario como novedad del auxiliar.
                        </p>
                    </div>
                </div>
            </fieldset>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-muted-foreground text-xs">
                    {a.auditada && a.auditadaEn ? (
                        <>
                            Auditada por {a.auditor ?? '—'} el{' '}
                            {new Date(a.auditadaEn).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </>
                    ) : (
                        <>
                            Atajo: <kbd className="bg-muted rounded border px-1 font-mono">Ctrl</kbd> + <kbd className="bg-muted rounded border px-1 font-mono">Enter</kbd>
                        </>
                    )}
                </p>
                {!bloqueado && (
                    <BotonEnviar procesando={processing} textoProcesando="Guardando auditoría…" className="h-10 rounded-lg px-5 font-semibold" aria-keyshortcuts="Control+Enter Meta+Enter">
                        {textoGuardar}
                    </BotonEnviar>
                )}
            </div>
        </form>
    );
}
