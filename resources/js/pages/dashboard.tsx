import { AccionesRecientes, InformesPendientes } from '@/components/dashboard/actividad';
import { CumplimientoProtocolo, EfectividadPorCliente, MotivosRechazo } from '@/components/dashboard/bloques-operacion';
import { GraficaTendencia } from '@/components/dashboard/grafica-tendencia';
import { HeroEfectividad, TilesKpi } from '@/components/dashboard/indicadores';
import { Segmentado } from '@/components/dashboard/piezas';
import { RankingAuxiliares } from '@/components/dashboard/ranking-auxiliares';
import { type DashboardProps } from '@/components/dashboard/tipos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, PackageSearch } from 'lucide-react';
import { useEffect, useState } from 'react';

function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard(props: DashboardProps) {
    const { auth } = usePage<SharedData>().props;
    const { filtros, vista, clientes, ultimaOperacion, meta, kpis, kpisPrevios, tendencia, motivos, porCliente, ranking, protocolo, pendientes, acciones } = props;
    const [cargando, setCargando] = useState(false);
    const gerencial = vista === 'gerencial';
    const titulo = gerencial ? 'Panel de operaciones' : 'Mi desempeño';

    useEffect(() => {
        const quitarInicio = router.on('start', () => setCargando(true));
        const quitarFin = router.on('finish', () => setCargando(false));
        return () => {
            quitarInicio();
            quitarFin();
        };
    }, []);

    const filtrar = (cambios: Partial<{ periodo: number; cliente: number | null }>) => {
        const params = { periodo: filtros.periodo ?? 30, cliente: filtros.cliente, ...cambios };
        router.get('/dashboard', Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined)), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const sinDatos = kpis.asignadas === 0;
    const clienteFiltrado = clientes.find((c) => c.id === filtros.cliente);
    // Con un solo cliente en pantalla, su panel repetiría el héroe de efectividad
    const verPorCliente = gerencial && porCliente.length > 1;
    // El chip solo aporta si el periodo no termina en la última jornada cargada
    const verUltimaJornada = ultimaOperacion !== null && ultimaOperacion.slice(0, 10) !== filtros.hasta;

    return (
        <AppLayout>
            <Head title={titulo} />

            <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
                {/* Encabezado y filtros */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-brand-coral-ink text-sm font-semibold">
                            {saludo()}, {auth.user.name.split(' ')[0]}
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-[1.75rem]">{titulo}</h1>
                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <CalendarDays className="size-4" aria-hidden="true" />
                            <span>
                                Del <strong className="text-foreground font-semibold">{fmt.fechaMedia(filtros.desde)}</strong> al{' '}
                                <strong className="text-foreground font-semibold">{fmt.fechaMedia(filtros.hasta)}</strong>
                                {!verUltimaJornada && <span className="sr-only"> (última jornada cargada)</span>}
                            </span>
                            {verUltimaJornada && (
                                <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                                    Última jornada cargada: {fmt.fechaCorta(ultimaOperacion!)}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Segmentado<number>
                            etiqueta="Periodo"
                            valor={filtros.periodo}
                            onChange={(periodo) => filtrar({ periodo })}
                            opciones={[
                                { valor: 7, texto: '7 días' },
                                { valor: 30, texto: '30 días' },
                                { valor: 90, texto: '90 días' },
                            ]}
                        />
                        {gerencial && (
                            <Select value={filtros.cliente ? String(filtros.cliente) : 'todos'} onValueChange={(v) => filtrar({ cliente: v === 'todos' ? null : Number(v) })}>
                                <SelectTrigger className="bg-card h-9 w-44 rounded-lg text-xs font-semibold" aria-label="Cliente">
                                    <SelectValue placeholder="Todos los clientes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos los clientes</SelectItem>
                                    {clientes.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {gerencial && kpis.sinAuditar > 0 && (
                    <div className="border-warning/30 bg-warning-soft flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                        <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden="true" />
                        <p>
                            <strong>{fmt.numero(kpis.sinAuditar)} entregas aprobadas</strong> aún no tienen auditoría de evidencias en este periodo.
                        </p>
                    </div>
                )}

                {/* Se anuncia al filtrar: "actualizando" y luego el periodo vigente */}
                <p role="status" className="sr-only">
                    {cargando ? 'Actualizando indicadores…' : `Indicadores del ${fmt.fechaMedia(filtros.desde)} al ${fmt.fechaMedia(filtros.hasta)}`}
                </p>

                <div aria-busy={cargando} className={cn('flex flex-col gap-6 transition-opacity duration-200', cargando && 'pointer-events-none opacity-60')}>
                    {sinDatos ? (
                        <div className="bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
                            <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                                <PackageSearch className="size-7" aria-hidden="true" />
                            </span>
                            <h2 className="mt-4 text-lg font-bold">Aún no hay entregas en este periodo</h2>
                            <p className="text-muted-foreground mt-1 max-w-md text-sm">
                                {gerencial
                                    ? 'Carga la preliquidación de Drivin desde «Cargas Drivin» para que el sistema consolide el informe diario y calcule los indicadores.'
                                    : 'Cuando se cargue la preliquidación de tus rutas verás aquí tu efectividad y tus evidencias.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Indicadores principales */}
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                                <HeroEfectividad
                                    kpis={kpis}
                                    previos={kpisPrevios}
                                    meta={meta}
                                    titulo={!gerencial ? 'Mi efectividad' : clienteFiltrado ? `Efectividad ${clienteFiltrado.nombre}` : 'Efectividad global'}
                                />
                                <TilesKpi kpis={kpis} previos={kpisPrevios} vista={vista} />
                            </div>

                            {/* Tendencia y clientes */}
                            <div className={cn('grid gap-4', verPorCliente && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
                                <GraficaTendencia datos={tendencia} meta={meta} />
                                {verPorCliente && <EfectividadPorCliente clientes={porCliente} />}
                            </div>

                            {/* Rechazos y protocolo */}
                            <div className="grid gap-4 lg:grid-cols-2">
                                <MotivosRechazo motivos={motivos} />
                                <CumplimientoProtocolo protocolo={protocolo} />
                            </div>

                            {/* Personas: el auxiliar ya ve sus cifras arriba, el ranking es solo gerencial */}
                            {gerencial && <RankingAuxiliares filas={ranking} meta={meta} />}

                            {/* Seguimiento */}
                            <div className={cn('grid gap-4', gerencial && 'lg:grid-cols-2')}>
                                {pendientes && <InformesPendientes pendientes={pendientes} />}
                                <AccionesRecientes acciones={acciones} mostrarEmpleado={gerencial} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
