import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePuede } from '@/hooks/use-puede';
import { TIPOS_FOTO, type TipoEvidencia } from '@/lib/protocolo';
import { subirEnTandas } from '@/lib/subida';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Expand, FileText, ImagePlus, LoaderCircle, Sparkles, Trash2 } from '@/components/iconos';
import { useId, useRef, useState } from 'react';
import { type EvidenciaOrden } from './tipos';
import { SegunPuntero } from '@/components/segun-puntero';
import { Selector } from '@/components/selector';

const tamano = (bytes: number | null) => (bytes === null ? '' : bytes > 1048576 ? `${(bytes / 1048576).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const textoTipo = (t: TipoEvidencia) => TIPOS_FOTO.find((x) => x.valor === t)?.texto ?? 'Prueba de entrega (PDF)';

const ACEPTA = 'application/pdf,image/jpeg,image/png,image/webp';

/** Sube PDF o fotos a la orden abierta. */
function AgregarEvidencias({ ordenId, deshabilitado }: { ordenId: number; deshabilitado: boolean }) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [mensaje, setMensaje] = useState('');

    // En tandas: PHP descarta los archivos que pasan su límite por petición
    const subir = async (lista: FileList | null) => {
        const archivos = Array.from(lista ?? []);
        if (!archivos.length || subiendo) return;
        setSubiendo(true);
        setMensaje('');
        const r = await subirEnTandas(`/auditoria/${ordenId}/evidencias`, archivos, {}, () => {});
        setSubiendo(false);
        if (input.current) input.current.value = '';
        // Lo que se agregó y, aparte, lo que no (p. ej. el PDF de otra orden)
        const agregadas =
            r.asignados || r.repetidos || !r.errores.length
                ? `${r.asignados === 1 ? 'Se agregó 1 evidencia' : `Se agregaron ${r.asignados} evidencias`}.${r.repetidos ? ` ${r.repetidos} ya estaban cargadas.` : ''}`
                : '';
        setMensaje([agregadas, ...r.errores].filter(Boolean).join(' '));
        router.reload();
    };

    return (
        <div>
            <input ref={input} id={id} type="file" multiple accept={ACEPTA} className="peer sr-only" disabled={deshabilitado || subiendo} onChange={(e) => subir(e.target.files)} />
            <label
                htmlFor={id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (!deshabilitado) subir(e.dataTransfer.files);
                }}
                className={cn(
                    'hover:border-primary/50 hover:bg-secondary/40 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-4 text-center text-xs transition-colors peer-focus-visible:border-ring peer-focus-visible:border-solid peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/25',
                    (deshabilitado || subiendo) && 'pointer-events-none opacity-60',
                )}
            >
                {subiendo ? <LoaderCircle className="text-primary size-5 motion-safe:animate-spin" aria-hidden="true" /> : <ImagePlus className="text-primary size-5" aria-hidden="true" />}
                <span className="font-semibold">{subiendo ? 'Subiendo…' : 'Agregar PDF o fotos'}</span>
                <span className="text-muted-foreground">
                    <SegunPuntero mouse="Arrastra aquí o elige" dedo="Toca para elegir" /> · máx. 15 MB c/u
                </span>
            </label>
            <p role="status" className={cn('mt-2 text-xs font-medium', mensaje ? 'text-muted-foreground' : 'sr-only')}>
                {subiendo ? 'Subiendo evidencias…' : mensaje}
            </p>
        </div>
    );
}

function EliminarEvidencia({ evidencia, deshabilitado }: { evidencia: EvidenciaOrden; deshabilitado: boolean }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-critical size-8 rounded-lg" disabled={deshabilitado}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Eliminar {evidencia.nombre}</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>¿Eliminar esta evidencia?</DialogTitle>
                <DialogDescription>Se borra «{evidencia.nombre}» de la orden. Puedes volver a subirlo después.</DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="outline" className="rounded-lg">
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button variant="destructive" className="rounded-lg" onClick={() => router.delete(`/evidencias/${evidencia.id}`, { preserveScroll: true })}>
                        Sí, eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Si el tipo de la foto es el que propuso la IA (el auditor lo confirma o lo cambia). */
const propuestoPorIa = (foto: EvidenciaOrden) => !!foto.ia && foto.ia.tipo === foto.tipo;

/** La marca de la IA junto al tipo de la foto: un ícono, que el panel «Lo que ve la IA» explica una vez. */
function MarcaIa({ foto }: { foto: EvidenciaOrden }) {
    if (!propuestoPorIa(foto)) return null;
    return (
        <span className="text-primary flex size-6 shrink-0 items-center justify-center" title="Tipo propuesto por la IA">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Tipo propuesto por la IA</span>
        </span>
    );
}

/** El posible daño que vio la IA en la foto del producto, si sigue siendo del producto. */
function DanoIa({ foto }: { foto: EvidenciaOrden }) {
    if (foto.ia?.estado !== 'posible_dano' || (foto.tipo !== 'sellado' && foto.tipo !== 'destapado')) return null;
    return (
        <p className="text-warning flex items-start gap-1 px-2 pb-2 text-xs font-semibold">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">Posible daño{foto.ia.detalle ? `: ${foto.ia.detalle}` : ''}</span>
        </p>
    );
}

/** Clasifica una foto. En paralelo (async): una clasificación no cancela la anterior al clasificar varias seguidas. */
const clasificar = (evidencia: EvidenciaOrden, tipo: string) =>
    router.patch(`/evidencias/${evidencia.id}`, { tipo }, { preserveScroll: true, preserveState: true, async: true });

/** Selector del tipo de foto: la clasificación alimenta la lista de chequeo de órdenes aún sin auditar. */
function TipoFoto({ evidencia, deshabilitado, contexto = '' }: { evidencia: EvidenciaOrden; deshabilitado: boolean; contexto?: string }) {
    const id = `tipo-${contexto}${evidencia.id}`;
    return (
        <div>
            <label htmlFor={id} className="sr-only">
                Tipo de la foto {evidencia.nombre}
            </label>
            <Selector
                id={id}
                valor={evidencia.tipo}
                disabled={deshabilitado}
                onCambio={(v) => clasificar(evidencia, v)}
                opciones={TIPOS_FOTO.map((t) => ({ valor: t.valor, texto: t.corto }))}
                tamano="sm"
                claseValor={evidencia.tipo === 'otro' || evidencia.tipo === 'ilegible' ? 'text-warning' : undefined}
            />
        </div>
    );
}

/**
 * Foto ampliada con anterior/siguiente (flechas del teclado incluidas). Quien revisa la clasifica ahí mismo: con la
 * lista o con las teclas 1 a 8, que además pasan a la siguiente (para recorrer las fotos de un PDF de corrido).
 */
function Ampliacion({
    fotos,
    id,
    puedeClasificar,
    onCambio,
    onCerrar,
}: {
    fotos: EvidenciaOrden[];
    id: number | null;
    puedeClasificar: boolean;
    onCambio: (id: number) => void;
    onCerrar: () => void;
}) {
    const indice = fotos.findIndex((f) => f.id === id);
    const foto = indice >= 0 ? fotos[indice] : null;
    const mover = (d: number) => indice >= 0 && onCambio(fotos[(indice + d + fotos.length) % fotos.length].id);

    return (
        <Dialog open={foto !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
            <DialogContent
                className="max-w-5xl gap-3 p-4 sm:p-5"
                onKeyDown={(e) => {
                    // Las teclas dentro de la lista desplegable son de la lista
                    if (!foto || e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('[role="listbox"]')) return;
                    if (e.key === 'ArrowRight') mover(1);
                    if (e.key === 'ArrowLeft') mover(-1);
                    const tipo = /^[1-9]$/.test(e.key) ? TIPOS_FOTO[Number(e.key) - 1] : undefined;
                    if (puedeClasificar && tipo) {
                        e.preventDefault();
                        clasificar(foto, tipo.valor);
                        if (indice < fotos.length - 1) mover(1);
                    }
                }}
            >
                {foto && (
                    <>
                        <DialogTitle className="pr-8 text-base">
                            Foto {indice + 1} de {fotos.length}
                            {!puedeClasificar && <span className="text-muted-foreground text-sm font-normal"> · {textoTipo(foto.tipo)}</span>}
                        </DialogTitle>
                        <DialogDescription className="truncate">{foto.nombre}</DialogDescription>
                        {puedeClasificar && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="w-52">
                                    <TipoFoto evidencia={foto} deshabilitado={false} contexto="ampliada-" />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    <SegunPuntero
                                        mouse={
                                            <>
                                                Teclas:{' '}
                                                {TIPOS_FOTO.map((t, i) => (
                                                    <span key={t.valor} className="whitespace-nowrap">
                                                        <kbd className="bg-muted rounded border px-1 font-mono">{i + 1}</kbd> {t.corto}
                                                        {i < TIPOS_FOTO.length - 1 ? ' · ' : ''}
                                                    </span>
                                                ))}
                                            </>
                                        }
                                        dedo={null}
                                    />
                                </p>
                            </div>
                        )}
                        {(propuestoPorIa(foto) || foto.ia?.estado === 'posible_dano') && (
                            <div className="-mt-1 flex flex-wrap items-center gap-x-3">
                                {propuestoPorIa(foto) && (
                                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                        <Sparkles className="text-primary size-3.5" aria-hidden="true" />
                                        Tipo propuesto por la IA
                                    </p>
                                )}
                                <DanoIa foto={foto} />
                            </div>
                        )}
                        <img src={foto.url} alt={`${textoTipo(foto.tipo)}: ${foto.nombre ?? ''}`} className="bg-muted max-h-[65svh] w-full rounded-lg object-contain" />
                        {fotos.length > 1 && (
                            <div className="flex items-center justify-between">
                                <Button variant="outline" className="rounded-lg" onClick={() => mover(-1)} aria-keyshortcuts="ArrowLeft">
                                    <ChevronLeft className="size-4" aria-hidden="true" />
                                    Anterior
                                </Button>
                                <Button variant="outline" className="rounded-lg" onClick={() => mover(1)} aria-keyshortcuts="ArrowRight">
                                    Siguiente
                                    <ChevronRight className="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function VisorPdf({ evidencia }: { evidencia: EvidenciaOrden }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-lg">
                    <Expand className="size-3.5" aria-hidden="true" />
                    Ver PDF
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[90svh] max-w-5xl flex-col gap-3 p-4 sm:p-5">
                <DialogTitle className="pr-8 text-base">Prueba de entrega</DialogTitle>
                <DialogDescription className="truncate">{evidencia.nombre}</DialogDescription>
                <object data={evidencia.url} type="application/pdf" className="bg-muted min-h-0 w-full flex-1 rounded-lg" aria-label={`PDF ${evidencia.nombre}`}>
                    <p className="p-4 text-sm">
                        Tu navegador no muestra PDF aquí.{' '}
                        <a href={`${evidencia.url}?descargar=1`} className="text-primary font-semibold underline">
                            Descárgalo
                        </a>
                        .
                    </p>
                </object>
            </DialogContent>
        </Dialog>
    );
}

export function Evidencias({ ordenId, evidencias, deshabilitado }: { ordenId: number; evidencias: EvidenciaOrden[]; deshabilitado: boolean }) {
    // Cada acción con su permiso: clasificar es revisar; subir y eliminar evidencias, los suyos
    const puede = usePuede();
    const puedeEliminar = puede('auditoria.eliminar');
    const pdfs = evidencias.filter((e) => e.esPdf);
    // Las fotos en el orden en que llegaron (las de un PDF, en el suyo): el orden no cambia al clasificarlas. La firma
    // del cliente no es una foto del protocolo: se ve con lo que dice el PDF
    const fotos = evidencias.filter((e) => !e.esPdf && e.tipo !== 'firma').sort((a, b) => a.id - b.id);
    const [ampliada, setAmpliada] = useState<number | null>(null);
    const puedeClasificar = !deshabilitado && puede('auditoria.revisar');
    const sinClasificar = fotos.filter((f) => f.tipo === 'otro').length;

    return (
        <section aria-labelledby="titulo-evidencias">
            <h3 id="titulo-evidencias" className="text-sm font-bold">
                Evidencias <span className="text-muted-foreground font-medium">({pdfs.length + fotos.length})</span>
            </h3>
            {puedeClasificar && sinClasificar > 0 && (
                <p className="text-muted-foreground mt-1 text-xs text-pretty">
                    {sinClasificar === 1 ? '1 foto sin clasificar' : `${sinClasificar} fotos sin clasificar`}: ábrelas y elige qué muestra cada una para que
                    cuenten en la lista de chequeo.
                </p>
            )}

            <div className="mt-3 grid gap-3">
                {pdfs.map((p) => (
                    <div key={p.id} className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border p-3">
                        <span className="bg-critical-soft text-critical flex size-10 shrink-0 items-center justify-center rounded-lg">
                            <FileText className="size-5" aria-hidden="true" />
                        </span>
                        {/* En pantallas angostas, los botones bajan a otra línea antes que partir el nombre letra a letra */}
                        <div className="min-w-0 flex-1 basis-44">
                            <p className="text-sm font-semibold break-all">{p.nombre}</p>
                            <p className="text-muted-foreground text-xs">
                                {p.imagenes !== null ? `${p.imagenes} ${p.imagenes === 1 ? 'foto' : 'fotos'} en el PDF` : 'No se pudieron contar las fotos'} · {tamano(p.tamano)}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <VisorPdf evidencia={p} />
                            <Button asChild variant="ghost" size="icon" className="text-muted-foreground size-8 rounded-lg">
                                <a href={`${p.url}?descargar=1`}>
                                    <Download className="size-4" aria-hidden="true" />
                                    <span className="sr-only">Descargar {p.nombre}</span>
                                </a>
                            </Button>
                            {puedeEliminar && <EliminarEvidencia evidencia={p} deshabilitado={deshabilitado} />}
                        </div>
                    </div>
                ))}

                {fotos.length > 0 && (
                    <ul role="list" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
                        {fotos.map((f, i) => (
                            <li key={f.id} className="bg-card overflow-hidden rounded-xl border">
                                <button
                                    type="button"
                                    onClick={() => setAmpliada(f.id)}
                                    className="focus-visible:ring-ring group relative block aspect-[4/3] w-full focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                                >
                                    <img src={f.url} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                                    {/* El número con que la nombran la IA y la foto ampliada ("Foto 23") */}
                                    <span aria-hidden="true" className="absolute top-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                                        {i + 1}
                                    </span>
                                    <span className="sr-only">
                                        Ampliar la foto {i + 1}: {textoTipo(f.tipo)}, {f.nombre}
                                    </span>
                                </button>
                                <div className="flex items-center gap-1 p-2">
                                    <div className="min-w-0 flex-1">
                                        <TipoFoto evidencia={f} deshabilitado={!puedeClasificar} />
                                    </div>
                                    <MarcaIa foto={f} />
                                    {puedeEliminar && <EliminarEvidencia evidencia={f} deshabilitado={deshabilitado} />}
                                </div>
                                <DanoIa foto={f} />
                            </li>
                        ))}
                    </ul>
                )}

                {!deshabilitado && puede('auditoria.subir') && <AgregarEvidencias ordenId={ordenId} deshabilitado={deshabilitado} />}
            </div>

            <Ampliacion fotos={fotos} id={ampliada} puedeClasificar={puedeClasificar} onCambio={setAmpliada} onCerrar={() => setAmpliada(null)} />
        </section>
    );
}
