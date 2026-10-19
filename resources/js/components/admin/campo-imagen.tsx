import { Campo } from '@/components/admin/campo';
import { LoaderCircle, UserRound } from '@/components/iconos';
import { propsCampo } from '@/lib/formularios';
import { pesoLegible, reducirImagen } from '@/lib/imagen';
import { quitarFondo, tieneFondo } from '@/lib/quitar-fondo';
import { cn } from '@/lib/utils';
import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const PESO_TOPE = 8 * 1024 * 1024;
const QUITANDO = 'Quitando el fondo… La primera vez tarda unos segundos mientras se descarga la herramienta.';
const SIN_CONEXION = 'No se pudo quitar el fondo (revisa la conexión a internet). La foto queda tal como está.';

const claseBoton =
    'border-input bg-background hover:bg-muted inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60';

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
    /** Texto alternativo de la imagen guardada (p. ej. "Foto de Laura Gómez"). */
    descripcion: string;
    onArchivo: (archivo: File | null) => void;
    onQuitar: (quitar: boolean) => void;
}

/**
 * Campo para la foto de un usuario (con ella se arma su carnet): vista previa redonda, recortada y con el mismo
 * fondo claro del círculo del carnet; elegir o arrastrar, cambiar y quitar. Si la foto tiene fondo de color
 * (azul, de oficina…), se le quita solo en el navegador, y se puede volver a la original con un clic. El control
 * es el selector de archivos nativo (llega con Tab y se abre con Enter o Espacio); el botón visible es su
 * etiqueta. Las fotos pesadas se reducen antes de enviarlas.
 */
export function CampoImagen({ id, etiqueta, ayuda, error, archivo, actual, quitar, descripcion, onArchivo, onQuitar }: Props) {
    const [vista, setVista] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [encima, setEncima] = useState(false);
    // Las dos versiones de la foto elegida, para pasar de una a otra sin volver a procesarla
    const [versiones, setVersiones] = useState<{ conFondo: File; sinFondo: File } | null>(null);
    // La foto ya guardada tiene fondo de color: se ofrece quitárselo
    const [guardadaConFondo, setGuardadaConFondo] = useState(false);

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

    // Otra foto (o ninguna): las versiones anteriores ya no aplican
    useEffect(() => {
        if (versiones && archivo !== versiones.conFondo && archivo !== versiones.sinFondo) setVersiones(null);
    }, [archivo, versiones]);

    useEffect(() => setGuardadaConFondo(false), [actual]);

    /** Le quita el fondo a una foto; si no se puede, avisa y devuelve null. */
    const sinFondo = async (foto: File): Promise<File | null> => {
        setTrabajando(QUITANDO);
        try {
            const recortada = await quitarFondo(foto, foto.name.replace(/\.[^.]+$/, '') || 'foto');
            setVersiones({ conFondo: foto, sinFondo: recortada });
            return recortada;
        } catch {
            setAviso(SIN_CONEXION);
            return null;
        }
    };

    const elegir = async (elegido: File | undefined) => {
        if (!elegido) return;
        if (!TIPOS.includes(elegido.type)) {
            setAviso('Elige una imagen JPG, PNG o WebP.');
            return;
        }
        setAviso(null);
        setTrabajando('Preparando la foto…');
        try {
            const reducida = await reducirImagen(elegido);
            if (reducida.size > PESO_TOPE) {
                setAviso('La imagen pesa más de 8 MB: elige una más liviana.');
                return;
            }
            const conFondo = await tieneFondo(reducida).catch(() => false);
            const final = (conFondo && (await sinFondo(reducida))) || reducida;
            onQuitar(false);
            onArchivo(final);
        } finally {
            setTrabajando(null);
        }
    };

    // La foto guardada se descarga, se le quita el fondo y queda como foto nueva por guardar
    const quitarFondoGuardada = async () => {
        if (!actual) return;
        setAviso(null);
        setTrabajando(QUITANDO);
        try {
            const respuesta = await fetch(actual, { credentials: 'same-origin' });
            if (!respuesta.ok) throw new Error();
            const blob = await respuesta.blob();
            const recortada = await sinFondo(new File([blob], 'foto', { type: blob.type }));
            if (recortada) {
                onQuitar(false);
                onArchivo(recortada);
            }
        } catch {
            setAviso(SIN_CONEXION);
        } finally {
            setTrabajando(null);
        }
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
    const peso = archivo ? pesoLegible(archivo.size) : '';
    const estado = trabajando
        ? trabajando
        : archivo && archivo === versiones?.sinFondo
          ? `Le quitamos el fondo para el carnet (${peso}). Se guardará al enviar el formulario.`
          : archivo && archivo === versiones?.conFondo
            ? `Foto con su fondo original (${peso}). Se guardará al enviar el formulario.`
            : archivo
              ? `${archivo.name} · ${peso}. Se guardará al enviar el formulario.`
              : quitar
                ? 'La foto se quitará al guardar.'
                : mostrarActual
                  ? guardadaConFondo
                      ? 'Foto guardada. Tiene fondo de color: quítaselo para que el carnet se vea mejor.'
                      : 'Foto guardada. Ábrela para verla en grande.'
                  : 'Aún no tiene foto.';

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
                        // Redonda y con el fondo claro del círculo del carnet: así se ve una foto sin fondo
                        'relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[#eceef3]',
                        !hayImagen && 'border-dashed bg-white',
                        encima && 'border-primary bg-secondary',
                    )}
                >
                    {trabajando ? (
                        <LoaderCircle className="size-6 text-[#5b6577] motion-safe:animate-spin" aria-hidden="true" />
                    ) : vista ? (
                        <img src={vista} alt={`Vista previa: ${descripcion}`} className="size-full object-cover object-[50%_20%]" />
                    ) : mostrarActual ? (
                        <a
                            href={actual}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-visible:ring-ring block size-full rounded-full focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                        >
                            <img
                                src={actual}
                                alt={descripcion}
                                onLoad={(e) => void tieneFondo(e.currentTarget).then(setGuardadaConFondo, () => setGuardadaConFondo(false))}
                                className="size-full object-cover object-[50%_20%]"
                            />
                            <span className="sr-only"> (se abre en otra pestaña)</span>
                        </a>
                    ) : (
                        <span className="text-muted-foreground flex flex-col items-center gap-1 px-2 text-center text-[0.7rem] leading-tight">
                            <UserRound className="size-7" aria-hidden="true" />
                            Arrastra la foto aquí
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
                            disabled={Boolean(trabajando)}
                            className="peer sr-only"
                        />
                        <label
                            htmlFor={id}
                            className={cn(
                                claseBoton,
                                'peer-focus-visible:ring-ring peer-focus-visible:ring-2',
                                trabajando && 'pointer-events-none opacity-60',
                            )}
                        >
                            {hayImagen ? 'Cambiar foto' : 'Elegir foto'}
                        </label>
                        {versiones && archivo === versiones.sinFondo && (
                            <button type="button" onClick={() => onArchivo(versiones.conFondo)} disabled={Boolean(trabajando)} className={claseBoton}>
                                Usar la original
                            </button>
                        )}
                        {versiones && archivo === versiones.conFondo && (
                            <button type="button" onClick={() => onArchivo(versiones.sinFondo)} disabled={Boolean(trabajando)} className={claseBoton}>
                                Quitar el fondo
                            </button>
                        )}
                        {mostrarActual && guardadaConFondo && (
                            <button type="button" onClick={() => void quitarFondoGuardada()} disabled={Boolean(trabajando)} className={claseBoton}>
                                Quitar el fondo
                            </button>
                        )}
                        {(archivo || mostrarActual) && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (archivo) onArchivo(null);
                                    else onQuitar(true);
                                }}
                                disabled={Boolean(trabajando)}
                                aria-label={archivo ? 'Quitar la foto elegida' : 'Quitar la foto guardada'}
                                className={claseBoton}
                            >
                                Quitar foto
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
