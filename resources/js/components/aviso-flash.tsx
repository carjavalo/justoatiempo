import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const DURACION_MS = 7000;

/**
 * Mensajes del servidor (flash) como aviso flotante.
 * Éxito: role="status" (cortés); error: role="alert" (se anuncia de inmediato). Se cierra solo o con el botón.
 */
export function AvisoFlash() {
    const { flash } = usePage<SharedData>().props;
    const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

    // Cada respuesta trae un objeto flash nuevo: así se muestra aunque el texto se repita
    useEffect(() => {
        if (flash?.error) setAviso({ tipo: 'error', texto: flash.error });
        else if (flash?.success) setAviso({ tipo: 'success', texto: flash.success });
    }, [flash]);

    // Al iniciar otra visita el aviso anterior deja de aplicar
    useEffect(() => router.on('start', () => setAviso(null)), []);

    useEffect(() => {
        if (!aviso || aviso.tipo === 'error') return; // los errores esperan a que la persona los cierre
        const t = window.setTimeout(() => setAviso(null), DURACION_MS);
        return () => window.clearTimeout(t);
    }, [aviso]);

    const Icono = aviso?.tipo === 'error' ? XCircle : CheckCircle2;

    return (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
            <div role={aviso?.tipo === 'error' ? 'alert' : 'status'} aria-live={aviso?.tipo === 'error' ? 'assertive' : 'polite'} className="w-full sm:w-auto">
                {aviso && (
                    <div
                        className={cn(
                            'bg-popover text-popover-foreground pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-xl sm:max-w-md',
                            'motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in',
                        )}
                    >
                        <Icono className={cn('mt-0.5 size-5 shrink-0', aviso.tipo === 'error' ? 'text-critical' : 'text-good')} aria-hidden="true" />
                        <p className="flex-1 text-sm font-medium">{aviso.texto}</p>
                        <button
                            type="button"
                            onClick={() => setAviso(null)}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-1 flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                        >
                            <X className="size-4" aria-hidden="true" />
                            <span className="sr-only">Cerrar aviso</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
