import { subirEnTandas, type ResultadoSubida } from '@/lib/subida';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, FolderUp, LoaderCircle, X } from '@/components/iconos';
import { useRef, useState } from 'react';

/**
 * Carga masiva de evidencias: los PDF de prueba de entrega que descarga Drivin
 * (POD_PDVT…pdf) o fotos con el código en el nombre se asignan solos a su orden.
 * Sin límite práctico de archivos: se envían en tandas y se resume al final.
 */
export function CargaLote({ fecha }: { fecha: string }) {
    const input = useRef<HTMLInputElement>(null);
    const [avance, setAvance] = useState<{ enviados: number; total: number } | null>(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoSubida | null>(null);

    const subir = async (lista: FileList | null) => {
        const archivos = Array.from(lista ?? []);
        if (!archivos.length || avance) return;

        setResultado(null);
        setAvance({ enviados: 0, total: archivos.length });
        const r = await subirEnTandas('/auditoria/lote', archivos, { fecha }, (enviados, total) => setAvance({ enviados, total }));
        setAvance(null);
        setResultado(r);
        if (input.current) input.current.value = '';
        // La cola y la orden abierta reflejan las evidencias nuevas
        router.reload();
    };

    const noAsignados = resultado ? [...resultado.sinOrden.map((n) => ({ n, motivo: 'sin código de orden reconocible' })), ...resultado.cerrados.map((n) => ({ n, motivo: 'su informe ya está cerrado' }))] : [];

    return (
        <section aria-labelledby="titulo-lote">
            <input
                ref={input}
                id="archivos-lote"
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="peer sr-only"
                disabled={avance !== null}
                aria-describedby="ayuda-lote"
                onChange={(e) => subir(e.target.files)}
            />
            <label
                htmlFor="archivos-lote"
                onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                    subir(e.dataTransfer.files);
                }}
                className={cn(
                    'bg-card hover:border-primary/50 flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition-colors peer-focus-visible:border-ring peer-focus-visible:border-solid peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/25',
                    arrastrando && 'border-brand-coral bg-brand-coral-soft/40',
                    avance !== null && 'pointer-events-none',
                )}
            >
                <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    {avance ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : <FolderUp className="size-5" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span id="titulo-lote" className="block text-sm font-bold">
                        {avance ? `Asignando archivos: ${avance.enviados} de ${avance.total}` : 'Carga masiva de evidencias'}
                    </span>
                    {avance ? (
                        <span className="bg-muted mt-1.5 block h-1.5 w-full max-w-md overflow-hidden rounded-full" aria-hidden="true">
                            <span className="bg-primary block h-full rounded-full transition-[width]" style={{ width: `${Math.max(4, (avance.enviados / avance.total) * 100)}%` }} />
                        </span>
                    ) : (
                        <span id="ayuda-lote" className="text-muted-foreground block text-xs">
                            Arrastra aquí los PDF de prueba de entrega de Drivin o fotos: cada archivo se asigna a su orden por el código del nombre (p. ej. POD_PDVT000228311.pdf).
                        </span>
                    )}
                </span>
                {!avance && <span className="text-primary text-xs font-semibold underline underline-offset-4">Elegir archivos</span>}
            </label>

            {/* Resultado de la carga, anunciado al terminar */}
            <div role="status" aria-live="polite">
                {resultado && (
                    <div className="bg-card mt-3 rounded-xl border p-3 text-sm">
                        <div className="flex items-start gap-2">
                            {resultado.asignados + resultado.repetidos > 0 ? (
                                <CheckCircle2 className="text-good mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            ) : (
                                <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            )}
                            <p className="flex-1">
                                <strong>
                                    {resultado.asignados === 1 ? 'Se asignó 1 archivo' : `Se asignaron ${resultado.asignados} archivos`} a {resultado.ordenes.length}{' '}
                                    {resultado.ordenes.length === 1 ? 'orden' : 'órdenes'}.
                                </strong>
                                {resultado.repetidos > 0 && <span className="text-muted-foreground"> {resultado.repetidos} ya estaban cargados.</span>}
                            </p>
                            <button
                                type="button"
                                onClick={() => setResultado(null)}
                                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-1 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                            >
                                <X className="size-4" aria-hidden="true" />
                                <span className="sr-only">Cerrar resumen de la carga</span>
                            </button>
                        </div>

                        {(noAsignados.length > 0 || resultado.errores.length > 0) && (
                            <div className="bg-warning-soft mt-3 rounded-lg p-3">
                                {resultado.errores.map((e) => (
                                    <p key={e} className="text-critical text-xs font-semibold">
                                        {e}
                                    </p>
                                ))}
                                {noAsignados.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold">{noAsignados.length === 1 ? 'Un archivo no se asignó:' : `${noAsignados.length} archivos no se asignaron:`}</p>
                                        <ul role="list" className="mt-1.5 space-y-0.5 text-xs">
                                            {noAsignados.slice(0, 8).map((a) => (
                                                <li key={a.n} className="break-all">
                                                    <span className="font-mono">{a.n}</span> <span className="text-muted-foreground">— {a.motivo}</span>
                                                </li>
                                            ))}
                                            {noAsignados.length > 8 && <li className="text-muted-foreground">y {noAsignados.length - 8} más</li>}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
