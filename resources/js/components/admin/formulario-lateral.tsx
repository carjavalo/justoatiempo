import { BotonEnviar } from '@/components/boton-enviar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type FormEventHandler, type ReactNode, useRef } from 'react';

interface Props {
    abierto: boolean;
    onCambio: (abierto: boolean) => void;
    titulo: string;
    descripcion: string;
    onEnviar: () => void;
    procesando: boolean;
    textoEnviar: string;
    /** Elemento que recibe el foco al cerrar (p. ej. el botón de acciones de la fila editada). */
    focoAlCerrar?: HTMLElement | null;
    children: ReactNode;
}

/**
 * Formulario en panel lateral: crea o edita sin perder de vista la lista.
 * Se cierra con la X, con Escape o al guardar (no hay un "Cancelar" que repita lo que hace la X).
 */
export function FormularioLateral({ abierto, onCambio, titulo, descripcion, onEnviar, procesando, textoEnviar, focoAlCerrar, children }: Props) {
    // Radix devuelve el foco a su "trigger"; aquí el panel se abre por código, así que se recuerda
    // quién tenía el foco al abrir (p. ej. "Nuevo usuario") para devolvérselo al cerrar
    const previo = useRef<HTMLElement | null>(null);
    const estabaAbierto = useRef(false);
    if (abierto && !estabaAbierto.current && typeof document !== 'undefined') {
        previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    estabaAbierto.current = abierto;

    const enviar: FormEventHandler = (e) => {
        e.preventDefault();
        if (!procesando) onEnviar();
    };

    return (
        <Sheet open={abierto} onOpenChange={onCambio}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
                onCloseAutoFocus={(e) => {
                    e.preventDefault();
                    const destino = [focoAlCerrar, previo.current, document.getElementById('contenido')].find((el) => el?.isConnected);
                    destino?.focus();
                }}
            >
                <SheetHeader className="border-b px-6 pt-6 pb-5 text-left">
                    <SheetTitle className="pr-8 text-xl font-extrabold tracking-tight">{titulo}</SheetTitle>
                    <SheetDescription>{descripcion}</SheetDescription>
                </SheetHeader>
                <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
                    <div className="grid flex-1 content-start gap-5 overflow-y-auto px-6 py-6">{children}</div>
                    <div className="bg-card flex items-center justify-between gap-3 border-t px-6 py-4">
                        <p className="text-muted-foreground text-xs">
                            <span aria-hidden="true">*</span> Obligatorio
                        </p>
                        <BotonEnviar procesando={procesando} textoProcesando="Guardando…" className="h-10 rounded-lg px-5 font-semibold">
                            {textoEnviar}
                        </BotonEnviar>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
