import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type FormEvent, type ReactNode } from 'react';

interface Props {
    titulo: string;
    descripcion: ReactNode;
    onCerrar: () => void;
    onEnviar: (e: FormEvent) => void;
    procesando: boolean;
    textoEnviar: string;
    /** Ancho máximo del diálogo (clase de Tailwind). */
    ancho?: string;
    children: ReactNode;
}

/** Diálogo con un formulario corto: título, descripción, sus campos y los botones Cancelar y enviar. */
export function DialogoFormulario({ titulo, descripcion, onCerrar, onEnviar, procesando, textoEnviar, ancho = 'max-w-lg', children }: Props) {
    return (
        <Dialog open onOpenChange={(v) => !v && onCerrar()}>
            <DialogContent className={cn('max-h-[92vh] overflow-y-auto rounded-2xl', ancho)}>
                <form onSubmit={onEnviar} noValidate className="grid gap-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-lg font-extrabold">{titulo}</DialogTitle>
                        <DialogDescription>{descripcion}</DialogDescription>
                    </DialogHeader>
                    {children}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCerrar} className="rounded-lg">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={procesando} className="rounded-lg">
                            {procesando ? 'Guardando…' : textoEnviar}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
