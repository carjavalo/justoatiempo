import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Felicitacion, MessageCircle, ShieldAlert } from '@/components/iconos';
import { Panel, Vacio } from './piezas';
import { type AccionReciente } from './tipos';

const ACCION = {
    felicitacion: { icono: Felicitacion, clase: 'bg-good-soft text-good' },
    retroalimentacion: { icono: MessageCircle, clase: 'bg-warning-soft text-warning' },
    llamado_atencion: { icono: ShieldAlert, clase: 'bg-critical-soft text-critical' },
    llamado_escrito: { icono: ShieldAlert, clase: 'bg-critical-soft text-critical' },
} as const;

/** Últimas acciones de desempeño registradas (RF-11): no dependen del periodo; van a lo ancho, en dos columnas. */
export function AccionesRecientes({ acciones, mostrarPersona = true }: { acciones: AccionReciente[]; mostrarPersona?: boolean }) {
    return (
        <Panel
            titulo={mostrarPersona ? 'Acciones de desempeño' : 'Mis acciones de desempeño'}
            descripcion="Últimas felicitaciones, retroalimentaciones y llamados"
        >
            {acciones.length === 0 ? (
                <Vacio>Sin acciones registradas.</Vacio>
            ) : (
                <ol role="list" className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {acciones.map((a) => {
                        const { icono: Icono, clase } = ACCION[a.tipo];
                        return (
                            <li key={a.id} className="flex gap-3">
                                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', clase)}>
                                    <Icono className="size-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 pt-0.5">
                                    <p className="text-sm leading-tight">
                                        {/* En la vista del auxiliar todas las acciones son suyas: no se repite su nombre */}
                                        {mostrarPersona ? (
                                            <>
                                                <span className="font-semibold">{a.persona}</span>{' '}
                                                <span className="text-muted-foreground">· {a.tipoLabel}</span>
                                            </>
                                        ) : (
                                            <span className="font-semibold">{a.tipoLabel}</span>
                                        )}
                                    </p>
                                    <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{a.descripcion}</p>
                                    <p className="text-muted-foreground mt-0.5 text-[0.7rem] first-letter:uppercase">{fmt.fechaLarga(a.fecha)}</p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}
