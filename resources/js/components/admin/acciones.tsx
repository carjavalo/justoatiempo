import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link, router } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2, type TipoIcono } from '@/components/iconos';
import { type RefObject, useRef, useState } from 'react';

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
}

/**
 * Acciones de una fila: editar, activar/desactivar y eliminar (las que el rol permite). Desactivar y eliminar piden
 * confirmación porque cambian el acceso de otras personas o no se pueden deshacer; activar es inmediato. Sin ninguna
 * acción posible no se muestra el menú.
 */
export function AccionesFila({ nombre, activo, urlEstado, onEditar, consecuencia, urlEliminar, enlaces = [] }: Props) {
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

            {urlEliminar && <ConfirmarEliminar abierto={eliminando} nombre={nombre} url={urlEliminar} onCerrar={() => setEliminando(false)} focoAlCerrar={boton} />}
        </>
    );
}

/** Confirmación antes de eliminar. La consecuencia por omisión es la de los registros que solo se eliminan sin historial. */
export function ConfirmarEliminar({
    abierto,
    nombre,
    url,
    consecuencia = 'No se puede deshacer. Solo se elimina si no tiene historial; si lo tiene, la plataforma te lo dirá y podrás desactivarlo.',
    onCerrar,
    focoAlCerrar,
}: {
    abierto: boolean;
    nombre: string;
    url: string;
    consecuencia?: string;
    onCerrar: () => void;
    focoAlCerrar?: RefObject<HTMLElement | null>;
}) {
    const [procesando, setProcesando] = useState(false);

    const eliminar = () => {
        if (procesando) return;
        router.delete(url, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcesando(true),
            onFinish: () => {
                setProcesando(false);
                onCerrar();
            },
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
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onCerrar} className="rounded-lg">
                        Cancelar
                    </Button>
                    <Button onClick={eliminar} aria-disabled={procesando || undefined} className="rounded-lg bg-[#c2352f] text-white hover:bg-[#a92c27] aria-disabled:opacity-70">
                        {procesando ? 'Eliminando…' : 'Eliminar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
