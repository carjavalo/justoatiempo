import { AccionesRecientes } from '@/components/dashboard/actividad';
import { CumplimientoProtocolo, EfectividadPorSede, MotivosRechazo } from '@/components/dashboard/bloques-operacion';
import { GraficaTendencia } from '@/components/dashboard/grafica-tendencia';
import { HeroEfectividad, TilesKpi } from '@/components/dashboard/indicadores';
import { Segmentado } from '@/components/dashboard/piezas';
import { RankingAuxiliares } from '@/components/dashboard/ranking-auxiliares';
import { type DashboardProps } from '@/components/dashboard/tipos';
import { Building2, PackageSearch } from '@/components/iconos';
import { fechaDia, FranjaHoy, pasosLogistica } from '@/components/linea/dia';
import { MarcoLinea, useYaEnPantalla } from '@/components/linea/marco-linea';
import { Selector } from '@/components/selector';
import { usePuede } from '@/hooks/use-puede';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

type Props = DashboardProps & {
    linea: { slug: string; nombre: string; icono: string | null };
    /** A lo que está limitada la persona, lo más específico: "TuGo · Cali Sur", "TuGo" o "Ditransa". */
    alcanceFijo: string | null;
};

/**
 * Tablero de la línea de servicios logísticos. Arriba, el día de la línea en el orden en que pasa (la jornada que llegó
 * de Drivin, sus cargas, la auditoría y el cierre de los informes), lo mismo que su tarjeta en el inicio y cada cosa con
 * su enlace. Debajo, los indicadores del periodo con sus filtros; al final, las acciones de desempeño.
 */
export default function TableroLogistica(props: Props) {
    const { linea, alcanceFijo, filtros, vista, sedes, meta, kpis, kpisPrevios, tendencia, motivos, porSede, ranking, protocolo, dia, acciones } =
        props;
    const [cargando, setCargando] = useState(false);
    const gerencial = vista === 'gerencial';
    const puede = usePuede();
    const yaEnPantalla = useYaEnPantalla(linea.slug);

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

    // Si sus pestañas ya llevan a Cargas, Auditoría POD o Informe diario, esos pasos no repiten el enlace
    const pasos = pasosLogistica(dia, { conEfectividad: false, yaEnPantalla });
    const sinDatos = kpis.asignadas === 0;
    // Sin datos del periodo anterior, ninguna cifra tiene con qué compararse: se dice una vez, aquí
    const sinComparar = !sinDatos && kpisPrevios.asignadas === 0;
    const sedeFiltrada = sedes.find((s) => s.id === filtros.sede);
    // Con una sola sede en pantalla, su panel repetiría el héroe de efectividad
    const verPorSede = gerencial && porSede.length > 1;
    // Sin órdenes auditadas no hay protocolo que desglosar: la tarjeta POD ya lo dice
    const verProtocolo = protocolo.auditadas > 0;
    // Si la línea tiene sedes de varias empresas, cada opción dice de cuál es
    const variasEmpresas = new Set(sedes.map((s) => s.empresa)).size > 1;
    const periodo = `Del ${fechaDia(filtros.desde)} al ${fechaDia(filtros.hasta)}`;

    return (
        <MarcoLinea
            slug={linea.slug}
            nombre={linea.nombre}
            icono={linea.icono}
            titulo={gerencial ? linea.nombre : 'Mi desempeño'}
            seccion="tablero"
            pestanas
            acciones={
                alcanceFijo && (
                    <span className="bg-secondary text-secondary-foreground inline-flex h-9 items-center gap-2 self-start rounded-lg px-3 text-xs font-semibold lg:self-auto">
                        <Building2 className="size-4" aria-hidden="true" />
                        {alcanceFijo}
                    </span>
                )
            }
        >
            {pasos.length > 0 && <FranjaHoy pasos={pasos} />}

            <section aria-labelledby="titulo-indicadores" className="flex flex-col gap-4">
                {/* Los filtros, junto a lo que filtran: "Hoy" no depende de ellos */}
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                        <h2 id="titulo-indicadores" className="text-lg font-extrabold tracking-tight">
                            {gerencial ? 'Indicadores' : 'Mi desempeño'}
                        </h2>
                        <p className="text-muted-foreground text-sm text-pretty">
                            {periodo}
                            {sinComparar && ' · sin datos del periodo anterior para comparar'}
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
                    </div>
                </div>

                {/* Se anuncia al filtrar: "actualizando" y luego el periodo vigente */}
                <p role="status" className="sr-only">
                    {cargando ? 'Actualizando indicadores…' : `Indicadores: ${periodo}`}
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
                            <h3 className="mt-4 text-lg font-bold">Aún no hay entregas en este periodo</h3>
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
                                <TilesKpi kpis={kpis} previos={kpisPrevios} vista={vista} comparar={!sinComparar} />
                            </div>

                            {/* Tendencia y sedes */}
                            <div className={cn('grid gap-4', verPorSede && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')}>
                                <GraficaTendencia datos={tendencia} meta={meta} />
                                {verPorSede && <EfectividadPorSede sedes={porSede} />}
                            </div>

                            {/* Rechazos y protocolo */}
                            <div className={cn('grid gap-4', verProtocolo && 'lg:grid-cols-2')}>
                                <MotivosRechazo motivos={motivos} />
                                {verProtocolo && <CumplimientoProtocolo protocolo={protocolo} />}
                            </div>

                            {/* Personas: el auxiliar ya ve sus cifras arriba, el ranking es solo gerencial */}
                            {gerencial && <RankingAuxiliares filas={ranking} meta={meta} />}
                        </>
                    )}
                </div>
            </section>

            {/* Las últimas acciones no dependen del periodo: van fuera de los indicadores */}
            <AccionesRecientes acciones={acciones} mostrarPersona={gerencial} />
        </MarcoLinea>
    );
}
