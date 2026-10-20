import { Campo } from '@/components/admin/campo';
import { FileText, LoaderCircle } from '@/components/iconos';
import { propsCampo } from '@/lib/formularios';
import { pesoLegible, reducirImagen } from '@/lib/imagen';
import { cn } from '@/lib/utils';
import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react';

const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const PESO_TOPE = 10 * 1024 * 1024;

const claseBoton =
    'border-input bg-background hover:bg-muted inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden';

interface Props {
    id: string;
    etiqueta: string;
    ayuda: string;
    error?: string;
    /** Archivo elegido en este formulario (aún sin guardar). */
    archivo: File | null;
    /** Dirección del documento ya guardado, si lo hay. */
    actual: string | null;
    actualEsPdf: boolean;
    /** El documento guardado se quitará al guardar. */
    quitar: boolean;
    /** Cómo se nombra el documento en los mensajes (p. ej. "la ARL"). */
    nombre: string;
    onArchivo: (archivo: File | null) => void;
    onQuitar: (quitar: boolean) => void;
}

/**
 * Campo para un documento en PDF o imagen (p. ej. el certificado de ARL): elegir o arrastrar, ver el guardado,
 * cambiar y quitar. Las fotos pesadas se reducen antes de enviarlas; los PDF van tal cual.
 */
export function CampoDocumento({ id, etiqueta, ayuda, error, archivo, actual, actualEsPdf, quitar, nombre, onArchivo, onQuitar }: Props) {
    const [vista, setVista] = useState<string | null>(null);
    const [preparando, setPreparando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [encima, setEncima] = useState(false);

    // Miniatura de la imagen elegida (los PDF muestran su ícono)
    useEffect(() => {
        if (!archivo || archivo.type === 'application/pdf') return setVista(null);
        const url = URL.createObjectURL(archivo);
        setVista(url);
        return () => URL.revokeObjectURL(url);
    }, [archivo]);

    const elegir = async (elegido: File | undefined) => {
        if (!elegido) return;
        if (!TIPOS.includes(elegido.type)) {
            setAviso('Elige un PDF o una imagen JPG, PNG o WebP.');
            return;
        }
        setAviso(null);
        setPreparando(true);
        const listo = elegido.type === 'application/pdf' ? elegido : await reducirImagen(elegido);
        setPreparando(false);
        if (listo.size > PESO_TOPE) {
            setAviso('El archivo pesa más de 10 MB: elige uno más liviano.');
            return;
        }
        onQuitar(false);
        onArchivo(listo);
    };

    const alCambiar = (e: ChangeEvent<HTMLInputElement>) => {
        void elegir(e.target.files?.[0]);
        e.target.value = '';
    };

    const alSoltar = (e: DragEvent) => {
        e.preventDefault();
        setEncima(false);
        void elegir(e.dataTransfer.files?.[0]);
    };

    const mostrarActual = actual && !archivo && !quitar;
    const hayDocumento = Boolean(archivo || mostrarActual);
    const esPdf = archivo ? archivo.type === 'application/pdf' : actualEsPdf;
    const estado = preparando
        ? 'Preparando el archivo…'
        : archivo
          ? `${archivo.name} · ${pesoLegible(archivo.size)}. Se guardará al enviar el formulario.`
          : quitar
            ? `${mayuscula(nombre)} se quitará al guardar.`
            : mostrarActual
              ? `${mayuscula(nombre)} está cargada${esPdf ? ' (PDF)' : ''}.`
              : `Aún no tiene ${nombre.replace(/^(la|el) /, '')} cargada.`;

    return (
        <Campo id={id} etiqueta={etiqueta} ayuda={ayuda} error={error ?? aviso ?? undefined}>
            <div className="flex items-start gap-4">
                {/* Miniatura o ícono; también recibe el archivo arrastrado */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setEncima(true);
                    }}
                    onDragLeave={() => setEncima(false)}
                    onDrop={alSoltar}
                    className={cn(
                        'bg-muted/40 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border',
                        !hayDocumento && 'border-dashed',
                        encima && 'border-primary bg-secondary',
                    )}
                >
                    {preparando ? (
                        <LoaderCircle className="text-muted-foreground size-6 motion-safe:animate-spin" aria-hidden="true" />
                    ) : vista ? (
                        <img src={vista} alt="" className="size-full object-cover" />
                    ) : mostrarActual && !esPdf ? (
                        <img src={actual} alt="" className="size-full object-cover" />
                    ) : (
                        <span className="text-muted-foreground flex flex-col items-center gap-0.5 text-[0.65rem] font-bold">
                            <FileText className="size-7" aria-hidden="true" />
                            {hayDocumento ? (esPdf ? 'PDF' : 'Imagen') : 'Arrastra aquí'}
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
                            {hayDocumento ? 'Cambiar archivo' : 'Elegir archivo'}
                        </label>
                        {mostrarActual && (
                            <a href={actual} target="_blank" rel="noopener noreferrer" className={claseBoton}>
                                Ver<span className="sr-only"> {nombre} (se abre en otra pestaña)</span>
                            </a>
                        )}
                        {hayDocumento && (
                            <button
                                type="button"
                                onClick={() => (archivo ? onArchivo(null) : onQuitar(true))}
                                aria-label={archivo ? `Quitar el archivo elegido de ${nombre}` : `Quitar ${nombre} guardada`}
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

function mayuscula(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
