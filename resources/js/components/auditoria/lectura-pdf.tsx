import { AlertTriangle, CheckCircle2, Info } from '@/components/iconos';
import { cn } from '@/lib/utils';
import { type AvisoPdf } from './tipos';

const NIVELES: Record<AvisoPdf['nivel'], { icono: typeof Info; clase: string; orden: number }> = {
    atencion: { icono: AlertTriangle, clase: 'text-warning', orden: 0 },
    bien: { icono: CheckCircle2, clase: 'text-good', orden: 1 },
    info: { icono: Info, clase: 'text-muted-foreground', orden: 2 },
};

/**
 * Lo que el PDF de prueba de entrega de Drivin dice de la entrega, leído al subirlo: primero lo que hay que mirar y
 * después lo que está bien. El ícono acompaña al texto; el color nunca carga el significado solo.
 */
export function LecturaPdf({ avisos }: { avisos: AvisoPdf[] }) {
    const ordenados = [...avisos].sort((a, b) => NIVELES[a.nivel].orden - NIVELES[b.nivel].orden);

    return (
        <section aria-labelledby="titulo-lectura-pdf" className="rounded-xl border p-3">
            <h3 id="titulo-lectura-pdf" className="text-sm font-bold">
                Lo que dice el PDF
            </h3>
            <ul role="list" className="mt-2 grid gap-1.5">
                {ordenados.map((a) => {
                    const { icono: Icono, clase } = NIVELES[a.nivel];
                    return (
                        <li key={a.texto} className="flex items-start gap-2 text-sm">
                            <Icono className={cn('mt-0.5 size-4 shrink-0', clase)} aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-pretty">{a.texto}</p>
                                {a.imagen && (
                                    // La firma va en negro sobre blanco: en tema oscuro también se ve sobre blanco
                                    <img src={a.imagen} alt="Firma del cliente" className="mt-1.5 h-14 w-auto rounded-md border bg-white p-1" />
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
