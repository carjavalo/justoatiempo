import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Award, Clock3, FileSpreadsheet, MessageCircle, ShieldAlert } from '@/components/iconos';
import { Panel, Vacio } from './piezas';
import { type AccionReciente, type Pendientes } from './tipos';

/** Informes que siguen abiertos (estado "Seguimiento") y la última preliquidación cargada. */
export function InformesPendientes({ pendientes }: { pendientes: Pendientes }) {
    const { informes, ultimaCarga } = pendientes;

    return (
        <Panel titulo="Pendientes de cierre" descripcion="Informes en seguimiento mientras se aclaran novedades">
            {informes.length === 0 ? (
                <Vacio>Todos los informes están cerrados.</Vacio>
            ) : (
                <ul role="list" className="divide-y">
                    {informes.map((i) => (
                        <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                            <span className="bg-warning-soft text-warning flex size-9 shrink-0 items-center justify-center rounded-lg">
                                <Clock3 className="size-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold break-words">
                                    {i.cliente} <span className="text-muted-foreground font-normal">· {i.sede}</span>
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {fmt.fechaMedia(i.fecha)} · {i.estadoLabel}
                                    {i.sinAuditar > 0 && <> · {i.sinAuditar} por auditar</>}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{fmt.pct(i.efectividad)}</p>
                                <p className="text-muted-foreground tabular text-[0.7rem]">{i.asignadas} entregas</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {ultimaCarga && (
                <div className="bg-muted/60 mt-4 flex items-center gap-3 rounded-xl border p-3">
                    <span className="bg-card text-primary flex size-9 shrink-0 items-center justify-center rounded-lg border">
                        <FileSpreadsheet className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">Última carga Drivin</p>
                        <p className="text-xs font-semibold break-all">{ultimaCarga.archivo_nombre}</p>
                    </div>
                    <span className="tabular text-muted-foreground shrink-0 text-xs">{fmt.numero(ultimaCarga.total_filas)} filas</span>
                </div>
            )}
        </Panel>
    );
}

const ACCION = {
    felicitacion: { icono: Award, clase: 'bg-good-soft text-good' },
    retroalimentacion: { icono: MessageCircle, clase: 'bg-warning-soft text-warning' },
    llamado_atencion: { icono: ShieldAlert, clase: 'bg-critical-soft text-critical' },
} as const;

/** Últimas acciones de desempeño registradas (RF-11). */
export function AccionesRecientes({ acciones, mostrarEmpleado = true }: { acciones: AccionReciente[]; mostrarEmpleado?: boolean }) {
    return (
        <Panel
            titulo={mostrarEmpleado ? 'Acciones de desempeño' : 'Mis acciones de desempeño'}
            descripcion="Últimas felicitaciones, retroalimentaciones y llamados"
        >
            {acciones.length === 0 ? (
                <Vacio>Sin acciones registradas.</Vacio>
            ) : (
                <ol role="list" className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-[var(--border)]">
                    {acciones.map((a) => {
                        const { icono: Icono, clase } = ACCION[a.tipo];
                        return (
                            <li key={a.id} className="relative flex gap-3">
                                <span className={cn('ring-card relative flex size-9 shrink-0 items-center justify-center rounded-full ring-4', clase)}>
                                    <Icono className="size-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 pt-0.5">
                                    <p className="text-sm leading-tight">
                                        {/* En la vista del auxiliar todas las acciones son suyas: no se repite su nombre */}
                                        {mostrarEmpleado ? (
                                            <>
                                                <span className="font-semibold">{a.empleado}</span>{' '}
                                                <span className="text-muted-foreground">· {a.tipoLabel}</span>
                                            </>
                                        ) : (
                                            <span className="font-semibold">{a.tipoLabel}</span>
                                        )}
                                    </p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">{a.descripcion}</p>
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
