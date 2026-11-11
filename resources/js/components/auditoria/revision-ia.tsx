import { LoaderCircle, Sparkles } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import { usePuede } from '@/hooks/use-puede';
import { codigoCsrf } from '@/lib/sesion';
import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { ListaAvisos } from './lectura-pdf';
import { type RevisionIaOrden } from './tipos';

const esperar = (ms: number) => new Promise((listo) => window.setTimeout(listo, ms));

/**
 * La revisión de las fotos con IA (Groq): propone qué muestra cada foto, cuáles son copias y si el producto se ve bien.
 * Va por pasos, una consulta por petición, y espera cuando la IA lo pide (el plan gratis deja pocas fotos por minuto);
 * cada paso actualiza las fotos y la lista de chequeo. El auditor confirma antes de guardar.
 */
export function RevisionIa({ ordenId, ia, deshabilitado }: { ordenId: number; ia: RevisionIaOrden; deshabilitado: boolean }) {
    const puede = usePuede();
    const [estado, setEstado] = useState<{ corriendo: boolean; texto: string; error: boolean }>({ corriendo: false, texto: '', error: false });
    // Al salir de la orden, la revisión se detiene (lo que ya hizo queda guardado)
    const activa = useRef(true);
    useEffect(
        () => () => {
            activa.current = false;
        },
        [],
    );

    const puedeRevisar = ia.disponible && !deshabilitado && puede('auditoria.revisar');
    if (!ia.avisos.length && !(puedeRevisar && ia.pendientes > 0)) return null;

    const revisar = async () => {
        setEstado({ corriendo: true, texto: 'Enviando las fotos a la IA…', error: false });
        let error = '';
        for (let vuelta = 0; vuelta < 60 && activa.current; vuelta++) {
            let r: Response;
            try {
                r = await fetch(`/auditoria/${ordenId}/ia`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': codigoCsrf() ?? '' },
                });
            } catch {
                error = 'Se perdió la conexión con la plataforma.';
                break;
            }
            if (r.status === 419 || r.status === 401 || r.redirected) {
                error = 'Tu sesión expiró o se cerró. Recarga la página e inténtalo de nuevo.';
                break;
            }
            const json = await r.json().catch(() => ({}));
            if (!r.ok) {
                error = json.message ?? `La IA no pudo terminar (error ${r.status}).`;
                break;
            }
            // Cada paso deja sus fotos clasificadas: se ven de una vez
            router.reload({ only: ['seleccionada'] });
            if (json.listo) break;

            if (json.esperar) {
                // El plan gratis de Groq deja pocas fotos por minuto: se espera lo que pide, con la cuenta a la vista
                for (let s = Math.ceil(json.esperar); s > 0 && activa.current; s--) {
                    setEstado({
                        corriendo: true,
                        texto: `${json.mensaje ?? 'La IA pide esperar.'} Sigue en ${s} s (límite por minuto del plan gratis).`,
                        error: false,
                    });
                    await esperar(1000);
                }
            } else {
                setEstado({ corriendo: true, texto: `Revisando con IA… ${json.mensaje ?? ''}`, error: false });
            }
        }
        if (activa.current) setEstado({ corriendo: false, texto: error, error: !!error });
    };

    return (
        <section aria-labelledby="titulo-revision-ia" className="rounded-xl border p-3">
            <h3 id="titulo-revision-ia" className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles className="text-primary size-4" aria-hidden="true" />
                Lo que ve la IA
            </h3>

            {ia.avisos.length > 0 && (
                <>
                    <ListaAvisos avisos={ia.avisos} className="mt-2" />
                    <p className="text-muted-foreground mt-2 text-xs text-pretty">
                        Es una propuesta: confírmala con las fotos antes de guardar la auditoría. Las fotos que clasificó la IA llevan{' '}
                        <Sparkles className="text-primary inline size-3.5 align-[-2px]" aria-hidden="true" />
                        <span className="sr-only">el ícono de la IA</span> junto a su tipo.
                    </p>
                </>
            )}

            {puedeRevisar && ia.pendientes > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={revisar} disabled={estado.corriendo}>
                        {estado.corriendo ? (
                            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                        ) : (
                            <Sparkles className="size-4" aria-hidden="true" />
                        )}
                        {estado.corriendo ? 'Revisando…' : ia.avisos.length ? 'Revisar las que faltan' : 'Revisar con IA'}
                    </Button>
                    {!estado.corriendo && !estado.texto && (
                        <p className="text-muted-foreground min-w-0 flex-1 basis-56 text-xs text-pretty">
                            {ia.pendientes === 1 ? 'Clasifica 1 foto' : `Clasifica ${ia.pendientes} fotos`}, marca las copias y busca daños. Tarda
                            unos minutos.
                        </p>
                    )}
                </div>
            )}

            <p
                role="status"
                className={estado.texto ? `mt-2 text-xs ${estado.error ? 'text-critical font-semibold' : 'text-muted-foreground'}` : 'sr-only'}
            >
                {estado.texto}
            </p>
        </section>
    );
}
