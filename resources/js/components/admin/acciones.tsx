import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { router } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Power, PowerOff } from '@/components/iconos';
import { useRef, useState } from 'react';

interface Props {
    nombre: string;
    activo: boolean;
    /** URL del PATCH que cambia el estado. Sin URL no se ofrece (p. ej. el propio usuario). */
    urlEstado?: string;
    /** Recibe el botón de acciones para devolverle el foco al cerrar el formulario. */
    onEditar: (origen: HTMLElement | null) => void;
    /** Qué pasa al desactivar y cómo revertirlo, para la confirmación. */
    consecuencia: string;
}

/**
 * Acciones de una fila: editar y activar/desactivar. Desactivar pide confirmación porque
 * cambia el acceso de otras personas; activar es inmediato.
 */
export function AccionesFila({ nombre, activo, urlEstado, onEditar, consecuencia }: Props) {
    const [confirmando, setConfirmando] = useState(false);
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
                    <DropdownMenuItem onSelect={() => onEditar(boton.current)} className="gap-2">
                        <Pencil className="size-4" aria-hidden="true" />
                        Editar
                    </DropdownMenuItem>
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
        </>
    );
}
