import { Campo } from '@/components/admin/campo';
import { IdCard, LoaderCircle } from '@/components/iconos';
import { propsCampo } from '@/lib/formularios';
import { pesoLegible, reducirImagen } from '@/lib/imagen';
import { cn } from '@/lib/utils';
import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_TOPE = 8 * 1024 * 1024;

const claseBoton =
    'border-input bg-background hover:bg-muted inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden';

interface Props {
    id: string;
    etiqueta: string;
    ayuda: string;
    error?: string;
    /** Imagen elegida en este formulario (aún sin guardar). */
    archivo: File | null;
    /** Dirección de la imagen ya guardada, si la hay. */
    actual: string | null;
    /** La imagen guardada se quitará al guardar. */
    quitar: boolean;
    /** Texto alternativo de la imagen guardada (p. ej. "Carnet de Laura Gómez"). */
    descripcion: string;
    onArchivo: (archivo: File | null) => void;
    onQuitar: (quitar: boolean) => void;
}

/**
 * Campo para una imagen (el carnet de un usuario): vista previa, elegir o arrastrar, cambiar y quitar.
 * El control es el selector de archivos nativo (llega con Tab y se abre con Enter o Espacio); el botón
 * visible es su etiqueta, así su nombre accesible dice "Carnet, Elegir imagen". Las fotos pesadas se reducen
 * en el navegador antes de enviarlas.
 */
export function CampoImagen({ id, etiqueta, ayuda, error, archivo, actual, quitar, descripcion, onArchivo, onQuitar }: Props) {
    const [vista, setVista] = useState<string | null>(null);
    const [preparando, setPreparando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [encima, setEncima] = useState(false);

    // Si la imagen se suelta fuera del recuadro, el navegador la abriría y se perdería el formulario
    useEffect(() => {
        const evitar = (e: globalThis.DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
        };
        window.addEventListener('dragover', evitar);
        window.addEventListener('drop', evitar);
        return () => {
            window.removeEventListener('dragover', evitar);
            window.removeEventListener('drop', evitar);
        };
    }, []);

        // Vista previa de la imagen elegida; la dirección temporal se libera al cambiarla
    useEffect(() => {
        if (!archivo) return setVista(null);
        const url = URL.createObjectURL(archivo);
        setVista(url);
        return () => URL.revokeObjectURL(url);
    }, [archivo]);

    const elegir = async (elegido: File | undefined) => {
        if (!elegido) return;
        if (!TIPOS.includes(elegido.type)) {
            setAviso('Elige una imagen JPG, PNG o WebP.');
            return;
        }
        setAviso(null);
        setPreparando(true);
        const lista = await reducirImagen(elegido);
        setPreparando(false);
        if (lista.size > PESO_TOPE) {
            setAviso('La imagen pesa más de 8 MB: elige una más liviana.');
            return;
        }
        onQuitar(false);
        onArchivo(lista);
    };

    const alCambiar = (e: ChangeEvent<HTMLInputElement>) => {
        void elegir(e.target.files?.[0]);
        // Así se puede volver a elegir el mismo archivo después de quitarlo
        e.target.value = '';
    };

    const alSoltar = (e: DragEvent) => {
        e.preventDefault();
        setEncima(false);
        void elegir(e.dataTransfer.files?.[0]);
    };

    const mostrarActual = actual && !archivo && !quitar;
    const hayImagen = Boolean(vista || mostrarActual);
    const estado = preparando
        ? 'Preparando la imagen…'
        : archivo
          ? `${archivo.name} · ${pesoLegible(archivo.size)}. Se guardará al enviar el formulario.`
          : quitar
            ? 'El carnet se quitará al guardar.'
            : mostrarActual
              ? 'Carnet guardado. Ábrelo para verlo en grande.'
              : 'Aún no tiene carnet.';

    return (
        <Campo id={id} etiqueta={etiqueta} ayuda={ayuda} error={error ?? aviso ?? undefined}>
            <div className="flex items-start gap-4">
                {/* Vista previa: también recibe la imagen arrastrada */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setEncima(true);
                    }}
                    onDragLeave={() => setEncima(false)}
                    onDrop={alSoltar}
                    className={cn(
                        'bg-muted/40 relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border',
                        !hayImagen && 'border-dashed',
                        encima && 'border-primary bg-secondary',
                    )}
                >
                    {preparando ? (
                        <LoaderCircle className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
                    ) : vista ? (
                        <img src={vista} alt={`Vista previa: ${descripcion}`} className="size-full object-contain" />
                    ) : mostrarActual ? (
                        <a
                            href={actual}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-visible:ring-ring block size-full rounded-xl focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                        >
                            <img src={actual} alt={descripcion} className="size-full object-contain" />
                            <span className="sr-only"> (se abre en otra pestaña)</span>
                        </a>
                    ) : (
                        <span className="text-muted-foreground flex flex-col items-center gap-1 px-2 text-center text-[0.7rem] leading-tight">
                            <IdCard className="size-7" aria-hidden="true" />
                            Arrastra la imagen aquí
                        </span>
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                    <p role="status" className="text-muted-foreground text-xs break-words">
                        {estado}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <input
                            {...propsCampo(id, error ?? aviso ?? undefined, `${id}-ayuda`)}
                            type="file"
                            accept={TIPOS.join(',')}
                            onChange={alCambiar}
                            disabled={preparando}
                            className="peer sr-only"
                        />
                        <label
                            htmlFor={id}
                            className={cn(
                                claseBoton,
                                'peer-focus-visible:ring-ring peer-focus-visible:ring-2',
                                preparando && 'pointer-events-none opacity-60',
                            )}
                        >
                            {hayImagen ? 'Cambiar imagen' : 'Elegir imagen'}
                        </label>
                        {(archivo || mostrarActual) && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (archivo) onArchivo(null);
                                    else onQuitar(true);
                                }}
                                aria-label={archivo ? 'Quitar la imagen elegida' : 'Quitar el carnet'}
                                className={claseBoton}
                            >
                                Quitar
                            </button>
                        )}
                        {quitar && !archivo && (
                            <button type="button" onClick={() => onQuitar(false)} className={claseBoton}>
                                Deshacer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Campo>
    );
}
