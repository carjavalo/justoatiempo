import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link, router } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2, type TipoIcono } from '@/components/iconos';
import { type ReactNode, type RefObject, useRef, useState } from 'react';

interface Props {
    nombre: string;
    activo: boolean;
    /** URL del PATCH que cambia el estado. Sin URL no se ofrece (p. ej. el propio usuario, o sin permiso). */
    urlEstado?: string;
    /** Recibe el botón de acciones para devolverle el foco al cerrar el formulario. Sin él (sin permiso), no se ofrece. */
    onEditar?: (origen: HTMLElement | null) => void;
    /** Qué pasa al desactivar y cómo revertirlo, para la confirmación. */
    consecuencia: string;
    /** URL del DELETE. Sin URL no se ofrece (p. ej. sin permiso, o un registro que no se elimina nunca). */
    urlEliminar?: string;
    /** Páginas propias del registro (p. ej. el carnet de un usuario), antes de las acciones. */
    enlaces?: { texto: string; href: string; icono: TipoIcono }[];
    /** Qué pasa al eliminarlo (quién queda sin asignación, qué se conserva). */
    consecuenciaEliminar?: string;
    /** Lo que hay que elegir para eliminarlo (p. ej. a qué rol pasan sus personas), con lo que se envía. */
    camposEliminar?: CamposEliminar;
}

/** Campos de la confirmación de eliminar: lo que se elige va con la petición. */
export interface CamposEliminar {
    iniciales: Record<string, string>;
    listo: (datos: Record<string, string>) => boolean;
    render: (datos: Record<string, string>, cambiar: (clave: string, valor: string) => void, error?: string) => ReactNode;
}

/**
 * Acciones de una fila: editar, activar/desactivar y eliminar (las que el rol permite). Desactivar y eliminar piden
 * confirmación porque cambian el acceso de otras personas o no se pueden deshacer; activar es inmediato. Sin ninguna
 * acción posible no se muestra el menú.
 */
export function AccionesFila({ nombre, activo, urlEstado, onEditar, consecuencia, urlEliminar, enlaces = [], consecuenciaEliminar, camposEliminar }: Props) {
    const [confirmando, setConfirmando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [procesando, setProcesando] = useState(false);
    const boton = useRef<HTMLButtonElement>(null);

    const cambiarEstado = (nuevo: boolean) => {
        if (!urlEstado) return;
        router.patch(
            urlEstado,
            { activo: nuevo },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcesando(true),
                onFinish: () => {
                    setProcesando(false);
                    setConfirmando(false);
                },
            },
        );
    };

    if (!onEditar && !urlEstado && !urlEliminar && enlaces.length === 0) return null;

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button ref={boton} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-9 rounded-lg">
                        <MoreHorizontal className="size-5" aria-hidden="true" />
                        <span className="sr-only">Acciones para {nombre}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                    {enlaces.map(({ texto, href, icono: Icono }) => (
                        <DropdownMenuItem key={href} asChild className="gap-2">
                            <Link href={href}>
                                <Icono className="size-4" aria-hidden="true" />
                                {texto}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                    {onEditar && (
                        <DropdownMenuItem onSelect={() => onEditar(boton.current)} className="gap-2">
                            <Pencil className="size-4" aria-hidden="true" />
                            Editar
                        </DropdownMenuItem>
                    )}
                    {urlEstado &&
                        (activo ? (
                            <DropdownMenuItem onSelect={() => setConfirmando(true)} className="text-critical focus:text-critical gap-2">
                                <PowerOff className="size-4" aria-hidden="true" />
                                Desactivar
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onSelect={() => cambiarEstado(true)} className="gap-2">
                                <Power className="size-4" aria-hidden="true" />
                                Activar
                            </DropdownMenuItem>
                        ))}
                    {urlEliminar && (
                        <DropdownMenuItem onSelect={() => setEliminando(true)} className="text-critical focus:text-critical gap-2">
                            <Trash2 className="size-4" aria-hidden="true" />
                            Eliminar
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={confirmando} onOpenChange={(v) => !procesando && setConfirmando(v)}>
                <DialogContent
                    role="alertdialog"
                    sinBotonCerrar
                    className="max-w-md rounded-2xl"
                    // Se abrió desde el menú, que ya no existe: el foco vuelve al botón de acciones de la fila
                    onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        (boton.current?.isConnected ? boton.current : document.getElementById('contenido'))?.focus();
                    }}
                >
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-lg font-extrabold">¿Desactivar {nombre}?</DialogTitle>
                        <DialogDescription>{consecuencia}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setConfirmando(false)} className="rounded-lg">
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => cambiarEstado(false)}
                            aria-disabled={procesando || undefined}
                            className="rounded-lg bg-[#c2352f] text-white hover:bg-[#a92c27] aria-disabled:opacity-70"
                        >
                            {procesando ? 'Desactivando…' : 'Desactivar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {urlEliminar && (
                <ConfirmarEliminar
                    abierto={eliminando}
                    nombre={nombre}
                    url={urlEliminar}
                    consecuencia={consecuenciaEliminar}
                    campos={camposEliminar}
                    onCerrar={() => setEliminando(false)}
                    focoAlCerrar={boton}
                />
            )}
        </>
    );
}

/**
 * Confirmación antes de eliminar. Nada se borra de la base: lo eliminado deja de verse y queda en el historial (con
 * quién y cuándo). Con `campos`, se elige algo antes (p. ej. a qué rol pasan sus personas) y va con la petición; si el
 * servidor lo rechaza, el mensaje se muestra aquí y la confirmación sigue abierta.
 */
export function ConfirmarEliminar({
    abierto,
    nombre,
    url,
    consecuencia = 'Deja de verse en la plataforma. No se borra: queda en el historial, con quién y cuándo se eliminó.',
    campos,
    onCerrar,
    focoAlCerrar,
}: {
    abierto: boolean;
    nombre: string;
    url: string;
    consecuencia?: string;
    campos?: CamposEliminar;
    onCerrar: () => void;
    focoAlCerrar?: RefObject<HTMLElement | null>;
}) {
    const [procesando, setProcesando] = useState(false);
    const [datos, setDatos] = useState<Record<string, string>>(campos?.iniciales ?? {});
    const [error, setError] = useState<string | undefined>();
    const listo = !campos || campos.listo(datos);

    const eliminar = () => {
        if (procesando || !listo) return;
        setError(undefined);
        router.delete(url, {
            data: datos,
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcesando(true),
            onSuccess: () => onCerrar(),
            onError: (errores) => setError(Object.values(errores)[0]),
            onFinish: () => setProcesando(false),
        });
    };

    return (
        <Dialog open={abierto} onOpenChange={(v) => !procesando && !v && onCerrar()}>
            <DialogContent
                role="alertdialog"
                sinBotonCerrar
                className="max-w-md rounded-2xl"
                // El registro puede ya no estar en la lista: el foco vuelve a su botón o, si desapareció, al contenido
                onCloseAutoFocus={(e) => {
                    e.preventDefault();
                    (focoAlCerrar?.current?.isConnected ? focoAlCerrar.current : document.getElementById('contenido'))?.focus();
                }}
            >
                <DialogHeader className="text-left">
                    <DialogTitle className="text-lg font-extrabold">¿Eliminar {nombre}?</DialogTitle>
                    <DialogDescription>{consecuencia}</DialogDescription>
                </DialogHeader>
                {campos?.render(datos, (clave, valor) => setDatos((d) => ({ ...d, [clave]: valor })), error)}
                {!campos && error && <p className="text-critical text-sm">{error}</p>}
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onCerrar} className="rounded-lg">
                        Cancelar
                    </Button>
                    <Button
                        onClick={eliminar}
                        aria-disabled={procesando || !listo || undefined}
                        className="rounded-lg bg-[#c2352f] text-white hover:bg-[#a92c27] aria-disabled:opacity-70"
                    >
                        {procesando ? 'Eliminando…' : 'Eliminar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
