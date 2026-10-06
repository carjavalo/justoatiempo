import { Cifra, EstadoCargaBadge, ListaAdvertencias, Pasos, TablaErrores, type Advertencia, type ErrorFila, type EstadoCarga } from '@/components/cargas/piezas';
import { BarraProgreso, Panel } from '@/components/dashboard/piezas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { Head, router } from '@inertiajs/react';
import { Ban, FileSpreadsheet, Undo2 } from 'lucide-react';
import { useState } from 'react';

interface Informe {
    id: number;
    fecha: string;
    cliente: string | null;
    sede: string | null;
    estado: string;
    estadoLabel: string;
    asignadas: number;
    aprobadas: number;
    efectividad: number;
}

interface Props {
    carga: {
        id: number;
        archivo: string;
        estado: EstadoCarga;
        estadoLabel: string;
        usuario: string | null;
        fechaOperacion: string | null;
        hoja: string | null;
        filas: number;
        filasError: number;
        ordenes: number;
        duracionMs: number | null;
        procesada: string | null;
        anuladaPor: string | null;
        anulada: string | null;
    };
    totales: { ordenes: number; aprobadas: number; rechazadas: number; faltantes: number; averias: number; efectividad: number } | null;
    advertencias: Advertencia[];
    errores: ErrorFila[];
    informes: Informe[];
    puedeAnular: boolean;
}

const fechaHora = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

export default function Resultado({ carga, totales, advertencias, errores, informes, puedeAnular }: Props) {
    const anulada = carga.estado === 'anulada';
    const [anulando, setAnulando] = useState(false);

    return (
        <AppLayout>
            <Head title={carga.archivo} />

            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
                <header className="flex flex-col gap-3">
                    {!anulada && <Pasos actual={4} />}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-brand-coral-ink text-xs font-bold tracking-[0.14em] uppercase">{anulada ? 'Carga anulada' : 'Carga importada'}</p>
                            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight break-all md:text-[1.6rem]">
                                <FileSpreadsheet className="text-primary size-6 shrink-0" aria-hidden="true" />
                                {carga.archivo}
                            </h1>
                            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                                <EstadoCargaBadge estado={carga.estado} texto={carga.estadoLabel} />
                                {carga.procesada && (
                                    <span>
                                        {fechaHora.format(new Date(carga.procesada))}
                                        {carga.usuario && <> · {carga.usuario}</>}
                                    </span>
                                )}
                            </p>
                        </div>

                        {puedeAnular && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="text-critical hover:bg-critical-soft hover:text-critical rounded-lg font-semibold">
                                        <Undo2 className="size-4" aria-hidden="true" />
                                        Anular carga
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogTitle>¿Anular esta carga?</DialogTitle>
                                    <DialogDescription>
                                        Se retiran sus {fmt.numero(carga.ordenes)} órdenes y se recalculan los informes diarios afectados. Úsalo si subiste el archivo equivocado; después
                                        podrás subir el correcto.
                                    </DialogDescription>
                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button variant="outline" className="rounded-lg">
                                                Cancelar
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            variant="destructive"
                                            className="rounded-lg"
                                            disabled={anulando}
                                            onClick={() => router.post(`/cargas/${carga.id}/anular`, {}, { onStart: () => setAnulando(true), onFinish: () => setAnulando(false) })}
                                        >
                                            Sí, anular
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </header>

                {anulada && (
                    <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-xl p-4 text-sm">
                        <Ban className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <p>
                            Esta carga se anuló{carga.anulada && <> el {fechaHora.format(new Date(carga.anulada))}</>}
                            {carga.anuladaPor && <> por {carga.anuladaPor}</>}. Sus órdenes ya no forman parte de los informes.
                        </p>
                    </div>
                )}

                <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Cifra etiqueta={anulada ? 'Órdenes retiradas' : 'Órdenes importadas'} valor={fmt.numero(carga.ordenes)} detalle={`de ${fmt.numero(carga.filas)} filas del archivo`} />
                    <Cifra etiqueta="Jornada" valor={<span className="text-lg">{carga.fechaOperacion ? fmt.fechaMedia(carga.fechaOperacion) : '—'}</span>} detalle={carga.hoja ? `Hoja ${carga.hoja}` : undefined} />
                    <Cifra etiqueta="Filas omitidas" valor={fmt.numero(carga.filasError)} tono={carga.filasError ? 'warning' : 'good'} detalle={carga.filasError ? 'Ver el detalle abajo' : 'Ninguna'} />
                    <Cifra
                        etiqueta="Tiempo de proceso"
                        valor={carga.duracionMs !== null ? `${(carga.duracionMs / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s` : '—'}
                        detalle={totales ? `Efectividad ${fmt.pct(totales.efectividad)}` : undefined}
                    />
                </dl>

                {!anulada && (
                    <Panel titulo="Informes diarios actualizados" descripcion="Quedan en borrador hasta auditar las evidencias y cerrarlos." cuerpoClassName="px-0 pb-2">
                        {informes.length === 0 ? (
                            <p className="text-muted-foreground px-5 pb-4 text-sm">Esta carga no generó informes.</p>
                        ) : (
                            <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label="Informes diarios actualizados, desplazable">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <caption className="sr-only">Informes diarios actualizados por esta carga</caption>
                                    <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                                        <tr>
                                            <th scope="col" className="py-2.5 pl-5 font-semibold">
                                                Cliente · sede
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                                Fecha
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                                Entregas
                                            </th>
                                            <th scope="col" className="w-52 px-3 py-2.5 font-semibold">
                                                Efectividad
                                            </th>
                                            <th scope="col" className="py-2.5 pr-5 pl-3 font-semibold">
                                                Estado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {informes.map((i) => (
                                            <tr key={i.id}>
                                                <td className="py-3 pl-5 font-semibold">
                                                    {i.cliente} <span className="text-muted-foreground font-normal">· {i.sede ?? 'Sin sede'}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">{fmt.fechaMedia(i.fecha)}</td>
                                                <td className="tabular px-3 py-3 text-right">
                                                    <span className="font-semibold">{i.aprobadas}</span>
                                                    <span className="text-muted-foreground"> / {i.asignadas}</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <BarraProgreso valor={i.efectividad} etiqueta={`Efectividad ${i.cliente} ${i.sede ?? ''}`} className="h-1.5 flex-1" />
                                                        <span className="tabular w-14 text-right text-xs font-bold">{fmt.pct(i.efectividad)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-muted-foreground py-3 pr-5 pl-3 text-xs">{i.estadoLabel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                )}

                <TablaErrores errores={errores} total={errores.length} titulo="Filas que no se importaron" />
                {!anulada && <ListaAdvertencias advertencias={advertencias} />}
            </div>
        </AppLayout>
    );
}
