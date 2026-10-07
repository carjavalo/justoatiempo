import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TIPOS_FOTO, type TipoEvidencia } from '@/lib/protocolo';
import { subirEnTandas } from '@/lib/subida';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download, Expand, FileText, ImagePlus, LoaderCircle, Trash2 } from '@/components/iconos';
import { useId, useRef, useState } from 'react';
import { type EvidenciaOrden } from './tipos';
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
        setMensaje(
            r.errores.length
                ? r.errores.join(' ')
                : `${r.asignados === 1 ? 'Se agregó 1 evidencia' : `Se agregaron ${r.asignados} evidencias`}.${r.repetidos ? ` ${r.repetidos} ya estaban cargadas.` : ''}`,
        );
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
                <span className="text-muted-foreground">Arrastra aquí o elige · máx. 15 MB c/u</span>
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

/** Selector del tipo de foto: la clasificación alimenta la lista de chequeo de órdenes aún sin auditar. */
function TipoFoto({ evidencia, deshabilitado }: { evidencia: EvidenciaOrden; deshabilitado: boolean }) {
    const id = `tipo-${evidencia.id}`;
    return (
        <div>
            <label htmlFor={id} className="sr-only">
                Tipo de la foto {evidencia.nombre}
            </label>
            <Selector
                id={id}
                valor={evidencia.tipo}
                disabled={deshabilitado}
                onCambio={(v) => router.patch(`/evidencias/${evidencia.id}`, { tipo: v }, { preserveScroll: true, preserveState: true })}
                opciones={TIPOS_FOTO.map((t) => ({ valor: t.valor, texto: t.corto }))}
                tamano="sm"
                claseValor={evidencia.tipo === 'otro' ? 'text-warning' : undefined}
            />
        </div>
    );
}

/** Foto ampliada con anterior/siguiente (flechas del teclado incluidas). */
function Ampliacion({ fotos, indice, onCambio, onCerrar }: { fotos: EvidenciaOrden[]; indice: number | null; onCambio: (i: number) => void; onCerrar: () => void }) {
    const foto = indice !== null ? fotos[indice] : null;
    const mover = (d: number) => indice !== null && onCambio((indice + d + fotos.length) % fotos.length);

    return (
        <Dialog open={foto !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
            <DialogContent
                className="max-w-5xl gap-3 p-4 sm:p-5"
                onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') mover(1);
                    if (e.key === 'ArrowLeft') mover(-1);
                }}
            >
                {foto && (
                    <>
                        <DialogTitle className="pr-8 text-base">
                            {textoTipo(foto.tipo)} <span className="text-muted-foreground text-sm font-normal">· {indice! + 1} de {fotos.length}</span>
                        </DialogTitle>
                        <DialogDescription className="truncate">{foto.nombre}</DialogDescription>
                        <img src={foto.url} alt={`${textoTipo(foto.tipo)}: ${foto.nombre ?? ''}`} className="bg-muted max-h-[70svh] w-full rounded-lg object-contain" />
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
    const pdfs = evidencias.filter((e) => e.esPdf);
    // Fotos en el orden del protocolo: fachada, sellado, destapado, remesa, rótulo y sin clasificar
    const orden = (t: string) => TIPOS_FOTO.findIndex((x) => x.valor === t);
    const fotos = evidencias.filter((e) => !e.esPdf).sort((a, b) => orden(a.tipo) - orden(b.tipo) || a.id - b.id);
    const [ampliada, setAmpliada] = useState<number | null>(null);

    return (
        <section aria-labelledby="titulo-evidencias">
            <h3 id="titulo-evidencias" className="text-sm font-bold">
                Evidencias <span className="text-muted-foreground font-medium">({evidencias.length})</span>
            </h3>

            <div className="mt-3 grid gap-3">
                {pdfs.map((p) => (
                    <div key={p.id} className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border p-3">
                        <span className="bg-critical-soft text-critical flex size-10 shrink-0 items-center justify-center rounded-lg">
                            <FileText className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
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
                            <EliminarEvidencia evidencia={p} deshabilitado={deshabilitado} />
                        </div>
                    </div>
                ))}

                {fotos.length > 0 && (
                    <ul role="list" className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                        {fotos.map((f, i) => (
                            <li key={f.id} className="bg-card overflow-hidden rounded-xl border">
                                <button
                                    type="button"
                                    onClick={() => setAmpliada(i)}
                                    className="focus-visible:ring-ring group relative block aspect-[4/3] w-full focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                                >
                                    <img src={f.url} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
                                    <span className="sr-only">
                                        Ampliar {textoTipo(f.tipo)}, {f.nombre}
                                    </span>
                                </button>
                                <div className="flex items-center gap-1 p-2">
                                    <div className="min-w-0 flex-1">
                                        <TipoFoto evidencia={f} deshabilitado={deshabilitado} />
                                    </div>
                                    <EliminarEvidencia evidencia={f} deshabilitado={deshabilitado} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {!deshabilitado && <AgregarEvidencias ordenId={ordenId} deshabilitado={deshabilitado} />}
            </div>

            <Ampliacion fotos={fotos} indice={ampliada} onCambio={setAmpliada} onCerrar={() => setAmpliada(null)} />
        </section>
    );
}
