import { AccionesRecientes, InformesPendientes } from '@/components/dashboard/actividad';
import { CumplimientoProtocolo, EfectividadPorSede, MotivosRechazo } from '@/components/dashboard/bloques-operacion';
import { GraficaTendencia } from '@/components/dashboard/grafica-tendencia';
import { HeroEfectividad, TilesKpi } from '@/components/dashboard/indicadores';
import { Segmentado } from '@/components/dashboard/piezas';
import { RankingAuxiliares } from '@/components/dashboard/ranking-auxiliares';
import { type DashboardProps } from '@/components/dashboard/tipos';
import { AlertTriangle, Building2, CalendarDays, PackageSearch } from '@/components/iconos';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { usePuede } from '@/hooks/use-puede';
import { Selector } from '@/components/selector';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

type Props = DashboardProps & {
    linea: { slug: string; nombre: string; icono: string | null };
    /** A lo que está limitada la persona, lo más específico: "TuGo · Cali Sur", "TuGo" o "Ditransa". */
    alcanceFijo: string | null;
};

/** Tablero de la línea de servicios logísticos: la operación de cada sede (TuGo, Sodimac…) de sus empresas. */
export default function TableroLogistica(props: Props) {
    const { auth } = usePage<SharedData>().props;
    const {
        linea,
        alcanceFijo,
        filtros,
        vista,
        sedes,
        ultimaOperacion,
        meta,
        kpis,
        kpisPrevios,
        tendencia,
        motivos,
        porSede,
        ranking,
        protocolo,
        pendientes,
        acciones,
    } = props;
    const [cargando, setCargando] = useState(false);
    const gerencial = vista === 'gerencial';
    const puede = usePuede();
    // Para quien trabaja en la línea, este tablero es su inicio: se le saluda
    const esSuInicio = auth.user.inicio.url === new URL(route('lineas.show', linea.slug)).pathname;

    useEffect(() => {
        const quitarInicio = router.on('start', () => setCargando(true));
        const quitarFin = router.on('finish', () => setCargando(false));
        return () => {
            quitarInicio();
            quitarFin();
        };
    }, []);

    const filtrar = (cambios: Partial<{ periodo: number; sede: number | null }>) => {
        const params = { periodo: filtros.periodo ?? 30, sede: filtros.sede, ...cambios };
        router.get(route('lineas.show', linea.slug), Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined)), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const sinDatos = kpis.asignadas === 0;
    const sedeFiltrada = sedes.find((s) => s.id === filtros.sede);
    // Con una sola sede en pantalla, su panel repetiría el héroe de efectividad
    const verPorSede = gerencial && porSede.length > 1;
    // Si la línea tiene sedes de varias empresas, cada opción dice de cuál es
    const variasEmpresas = new Set(sedes.map((s) => s.empresa)).size > 1;
    // El chip solo aporta si el periodo no termina en la última jornada cargada
    const verUltimaJornada = ultimaOperacion !== null && ultimaOperacion.slice(0, 10) !== filtros.hasta;

    return (
        <MarcoLinea
            slug={linea.slug}
            nombre={linea.nombre}
            icono={linea.icono}
            titulo={gerencial ? linea.nombre : 'Mi desempeño'}
            seccion="tablero"
            pestanas
            antetitulo={esSuInicio ? `${saludo()}, ${auth.user.name.split(' ')[0]}` : 'Línea de servicio'}
            acciones={
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
                    {/* Con varias sedes en el alcance (todas, o las de su empresa) se puede elegir una */}
                    {gerencial && sedes.length > 1 && (
                        <div className="w-52">
                            <label htmlFor="filtro-sede" className="sr-only">
                                Sede
                            </label>
                            <Selector
                                id="filtro-sede"
                                valor={filtros.sede ? String(filtros.sede) : ''}
                                onCambio={(v) => filtrar({ sede: v ? Number(v) : null })}
                                className="bg-card h-9 text-xs font-semibold"
                                opciones={[
                                    { valor: '', texto: 'Todas las sedes' },
                                    ...sedes.map((s) => ({
                                        valor: String(s.id),
                                        texto: variasEmpresas && s.empresa ? `${s.nombre} (${s.empresa})` : s.nombre,
                                    })),
                                ]}
                            />
                        </div>
                    )}
                    {alcanceFijo && (
                        <span className="bg-secondary text-secondary-foreground inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold">
                            <Building2 className="size-4" aria-hidden="true" />
                            {alcanceFijo}
                        </span>
                    )}
                </div>
            }
        >
            <p className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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

            {gerencial && kpis.sinAuditar > 0 && (
                <div className="border-warning/30 bg-warning-soft flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                    <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden="true" />
                    <p>
                        <strong>{fmt.numero(kpis.sinAuditar)} órdenes aprobadas</strong> aún no tienen auditoría de evidencias en este periodo.
                    </p>
                </div>
            )}

            {/* Se anuncia al filtrar: "actualizando" y luego el periodo vigente */}
            <p role="status" className="sr-only">
                {cargando ? 'Actualizando indicadores…' : `Indicadores del ${fmt.fechaMedia(filtros.desde)} al ${fmt.fechaMedia(filtros.hasta)}`}
            </p>

            <div
                aria-busy={cargando}
                className={cn('flex flex-col gap-6 transition-opacity duration-200', cargando && 'pointer-events-none opacity-60')}
            >
                {sinDatos ? (
                    <div className="bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
                        <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                            <PackageSearch className="size-7" aria-hidden="true" />
                        </span>
                        <h2 className="mt-4 text-lg font-bold">Aún no hay entregas en este periodo</h2>
                        <p className="text-muted-foreground mt-1 max-w-md text-sm">
                            {puede('cargas.subir')
                                ? 'Carga la preliquidación de Drivin en «Cargas Drivin» para que el sistema consolide el informe diario y calcule los indicadores.'
                                : gerencial
                                  ? 'Cuando se cargue la preliquidación de Drivin de esta operación, verás aquí sus indicadores.'
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
                                titulo={
                                    !gerencial
                                        ? 'Mi efectividad'
                                        : sedeFiltrada && sedes.length > 1
                                          ? `Efectividad ${sedeFiltrada.nombre}`
                                          : 'Efectividad de la operación'
                                }
                            />
                            <TilesKpi kpis={kpis} previos={kpisPrevios} vista={vista} />
                        </div>

                        {/* Tendencia y sedes */}
                        <div className={cn('grid gap-4', verPorSede && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
                            <GraficaTendencia datos={tendencia} meta={meta} />
                            {verPorSede && <EfectividadPorSede sedes={porSede} />}
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
                            <AccionesRecientes acciones={acciones} mostrarPersona={gerencial} />
                        </div>
                    </>
                )}
            </div>
        </MarcoLinea>
    );
}
