import { Cifra, ListaAdvertencias, Pasos, TablaErrores, type Advertencia, type ErrorFila } from '@/components/cargas/piezas';
import { BarraProgreso, Panel } from '@/components/dashboard/piezas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, FileSpreadsheet, LoaderCircle, Trash2, XCircle } from '@/components/iconos';
import { useEffect, useId, useState } from 'react';
import { Selector } from '@/components/selector';

interface Columna {
    indice: number;
    encabezado: string;
    muestra: string | null;
}

interface Campo {
    clave: string;
    etiqueta: string;
    obligatorio: boolean;
    columna: number | null;
}

interface Grupo {
    fecha: string;
    cliente: string;
    sede: string | null;
    ruta: string | null;
    placa: string | null;
    vehiculoRegistrado: boolean;
    auxiliar: string | null;
    auxiliarReconocido: boolean;
    asignadas: number;
    aprobadas: number;
    rechazadas: number;
    faltantes: number;
    averias: number;
    efectividad: number;
}

interface Analisis {
    columnasFaltantes: string[];
    filasLeidas: number;
    errores: ErrorFila[];
    totalErrores: number;
    filasConError: number;
    advertencias: Advertencia[];
    totalAdvertencias: number;
    fechas: Record<string, number>;
    grupos: Grupo[];
    totales: { ordenes: number; aprobadas: number; rechazadas: number; pendientes: number; faltantes: number; averias: number; efectividad: number };
}

interface Props {
    carga: { id: number; archivo: string; usuario: string | null; creada: string; opciones?: { cliente_id: number | null; sede_id: number | null } };
    errorLectura?: string;
    lectura?: { hojas: { nombre: string; puntaje: number; filas: number }[]; hoja: string; filaEncabezados: number; columnas: Columna[] };
    campos?: Campo[];
    analisis?: Analisis;
    clientes?: { id: number; nombre: string; sedes: { id: number; nombre: string }[] }[];
}

export default function Revision({ carga, errorLectura, lectura, campos, analisis, clientes }: Props) {
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        const a = router.on('start', () => setGuardando(true));
        const b = router.on('finish', () => setGuardando(false));
        return () => {
            a();
            b();
        };
    }, []);

    const ajustar = (datos: Record<string, unknown>) => router.patch(`/cargas/${carga.id}`, datos as never, { preserveScroll: true, preserveState: true });

    return (
        <AppLayout>
            <Head title={`Revisión · ${carga.archivo}`} />

            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 pb-32 md:p-6 md:pb-32 lg:p-8 lg:pb-32">
                <header className="flex flex-col gap-3">
                    <Pasos actual={2} />
                    <div>
                        <p className="text-brand-coral-ink text-xs font-bold tracking-[0.14em] uppercase">Revisión de la preliquidación</p>
                        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight break-all md:text-[1.6rem]">
                            <FileSpreadsheet className="text-primary size-6 shrink-0" aria-hidden="true" />
                            {carga.archivo}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Nada se ha guardado todavía. Revisa lo que el sistema entendió del archivo y confirma la importación.
                        </p>
                    </div>
                </header>

                {errorLectura || !lectura || !campos || !analisis ? (
                    <div role="alert" className="bg-critical-soft text-critical flex items-start gap-3 rounded-xl p-4 text-sm">
                        <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <p>{errorLectura ?? 'No se pudo leer el archivo.'}</p>
                    </div>
                ) : (
                    <div aria-busy={guardando} className={cn('flex flex-col gap-6 transition-opacity', guardando && 'opacity-60')}>
                        <p role="status" className="sr-only">
                            {guardando
                                ? 'Actualizando la revisión…'
                                : `${analisis.totales.ordenes} órdenes válidas, ${analisis.filasConError} filas con error.`}
                        </p>
                        <Resumen analisis={analisis} />

                        {analisis.columnasFaltantes.length > 0 && (
                            <div role="alert" className="bg-critical-soft text-critical flex items-start gap-3 rounded-xl p-4 text-sm">
                                <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                                <p>
                                    <strong>Faltan columnas obligatorias.</strong> Asigna en «Columnas del archivo» la columna que corresponde a:{' '}
                                    {campos
                                        .filter((c) => analisis.columnasFaltantes.includes(c.clave))
                                        .map((c) => c.etiqueta.toLowerCase())
                                        .join(', ')}
                                    .
                                </p>
                            </div>
                        )}

                        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
                            <MapeoColumnas lectura={lectura} campos={campos} faltantes={analisis.columnasFaltantes} disabled={guardando} onCambio={(mapeo) => ajustar({ mapeo })} onHoja={(hoja) => ajustar({ hoja })} />
                            <ClientePorDefecto
                                clientes={clientes ?? []}
                                opciones={carga.opciones ?? { cliente_id: null, sede_id: null }}
                                disabled={guardando}
                                onCambio={(cliente_id, sede_id) => ajustar({ cliente_id, sede_id })}
                            />
                        </div>

                        <VistaPrevia grupos={analisis.grupos} totales={analisis.totales} />
                        <TablaErrores errores={analisis.errores} total={analisis.totalErrores} />
                        <ListaAdvertencias advertencias={analisis.advertencias} />
                    </div>
                )}
            </div>

            <BarraAcciones cargaId={carga.id} analisis={analisis} guardando={guardando} />
        </AppLayout>
    );
}

function Resumen({ analisis }: { analisis: Analisis }) {
    const fechas = Object.keys(analisis.fechas);
    return (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cifra etiqueta="Órdenes a importar" valor={fmt.numero(analisis.totales.ordenes)} detalle={`de ${fmt.numero(analisis.filasLeidas)} filas leídas`} />
            <Cifra
                etiqueta="Jornada"
                valor={<span className="text-lg first-letter:uppercase">{fechas.length === 1 ? fmt.fechaMedia(fechas[0]) : fechas.length > 1 ? `${fechas.length} fechas` : '—'}</span>}
                detalle={fechas.length > 1 ? fechas.map(fmt.fechaCorta).join(' · ') : 'Fecha de operación'}
            />
            <Cifra
                etiqueta="Filas que se omiten"
                valor={fmt.numero(analisis.filasConError)}
                detalle={analisis.filasConError ? 'Ver el detalle abajo' : 'Todas las filas son válidas'}
                tono={analisis.filasConError ? 'critical' : 'good'}
            />
            <Cifra
                etiqueta="Efectividad prevista"
                valor={analisis.totales.ordenes ? fmt.pct(analisis.totales.efectividad) : '—'}
                detalle={`${fmt.numero(analisis.totales.aprobadas)} aprobadas · ${fmt.numero(analisis.totales.rechazadas)} rechazadas`}
            />
        </dl>
    );
}

function MapeoColumnas({
    lectura,
    campos,
    faltantes,
    disabled,
    onCambio,
    onHoja,
}: {
    lectura: NonNullable<Props['lectura']>;
    campos: Campo[];
    faltantes: string[];
    disabled: boolean;
    onCambio: (mapeo: Record<string, number | null>) => void;
    onHoja: (hoja: string) => void;
}) {
    const idHoja = useId();
    const opcionales = campos.filter((c) => !c.obligatorio);
    const asignadosOpcionales = opcionales.filter((c) => c.columna !== null).length;
    const [verOpcionales, setVerOpcionales] = useState(false);
    const actual = Object.fromEntries(campos.map((c) => [c.clave, c.columna]));

    const cambiar = (clave: string, valor: string) => onCambio({ ...actual, [clave]: valor === '' ? null : Number(valor) });

    const fila = (c: Campo) => {
        const id = `campo-${c.clave}`;
        const falta = faltantes.includes(c.clave);
        const muestra = c.columna !== null ? lectura.columnas.find((col) => col.indice === c.columna)?.muestra : null;
        return (
            <div key={c.clave} className="grid gap-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
                <label htmlFor={id} className="text-sm font-semibold">
                    {c.etiqueta}
                    {c.obligatorio && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(obligatorio)</span>}
                </label>
                <div>
                    <Selector
                        id={id}
                        valor={c.columna !== null ? String(c.columna) : ''}
                        disabled={disabled}
                        onCambio={(v) => cambiar(c.clave, v)}
                        aria-invalid={falta || undefined}
                        aria-describedby={muestra ? `${id}-muestra` : undefined}
                        className="h-9"
                        opciones={[{ valor: '', texto: 'Sin asignar' }, ...lectura.columnas.map((col) => ({ valor: String(col.indice), texto: col.encabezado || `Columna ${col.indice + 1}` }))]}
                    />
                    {muestra && (
                        <p id={`${id}-muestra`} className="text-muted-foreground mt-1 truncate text-xs">
                            Ejemplo: <span className="text-foreground font-mono">{muestra}</span>
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Panel titulo="Columnas del archivo" descripcion={`Encabezados en la fila ${lectura.filaEncabezados}. Corrige cualquier columna mal reconocida; se recordará para la próxima carga.`}>
            {lectura.hojas.length > 1 && (
                <div className="mb-2 grid gap-1.5 border-b pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
                    <label htmlFor={idHoja} className="text-sm font-semibold">
                        Hoja con los datos
                    </label>
                    <Selector
                        id={idHoja}
                        valor={lectura.hoja}
                        disabled={disabled}
                        onCambio={onHoja}
                        className="h-9"
                        opciones={lectura.hojas.map((h) => ({ valor: h.nombre, texto: `${h.nombre} (${fmt.numero(h.filas)} filas)` }))}
                    />
                </div>
            )}

            <div className="divide-y">{campos.filter((c) => c.obligatorio).map(fila)}</div>

            <button
                type="button"
                onClick={() => setVerOpcionales((v) => !v)}
                aria-expanded={verOpcionales}
                aria-controls="campos-opcionales"
                className="text-primary mt-2 flex items-center gap-1 text-xs font-semibold hover:underline"
            >
                <ChevronDown className={cn('size-4 transition-transform', verOpcionales && 'rotate-180')} aria-hidden="true" />
                Campos complementarios ({asignadosOpcionales} de {opcionales.length} reconocidos)
            </button>
            <div id="campos-opcionales" hidden={!verOpcionales} className="divide-y">
                {opcionales.map(fila)}
            </div>
        </Panel>
    );
}

function ClientePorDefecto({
    clientes,
    opciones,
    disabled,
    onCambio,
}: {
    clientes: NonNullable<Props['clientes']>;
    opciones: { cliente_id: number | null; sede_id: number | null };
    disabled: boolean;
    onCambio: (clienteId: number | null, sedeId: number | null) => void;
}) {
    const sedes = clientes.find((c) => c.id === opciones.cliente_id)?.sedes ?? [];

    return (
        <Panel titulo="Cliente por defecto" descripcion="Se usa solo para las órdenes cuyo plan o cliente no se reconoce. Las demás se asignan por el nombre del plan.">
            <div className="grid gap-4">
                <div className="grid gap-1.5">
                    <label htmlFor="cliente-defecto" className="text-sm font-semibold">
                        Cliente
                    </label>
                    <Selector
                        id="cliente-defecto"
                        valor={opciones.cliente_id ? String(opciones.cliente_id) : ''}
                        disabled={disabled}
                        onCambio={(v) => onCambio(v ? Number(v) : null, null)}
                        className="h-9"
                        opciones={[{ valor: '', texto: 'Ninguno (marcar como error)' }, ...clientes.map((c) => ({ valor: String(c.id), texto: c.nombre }))]}
                    />
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="sede-defecto" className="text-sm font-semibold">
                        Sede
                    </label>
                    <Selector
                        id="sede-defecto"
                        valor={opciones.sede_id ? String(opciones.sede_id) : ''}
                        disabled={disabled || !opciones.cliente_id}
                        onCambio={(v) => onCambio(opciones.cliente_id, v ? Number(v) : null)}
                        className="h-9"
                        opciones={[{ valor: '', texto: 'Sin sede' }, ...sedes.map((s) => ({ valor: String(s.id), texto: s.nombre }))]}
                    />
                </div>
            </div>
        </Panel>
    );
}

function Marca({ ok, texto }: { ok: boolean; texto: string }) {
    if (ok) return null;
    return (
        <span className="text-warning ml-1.5 inline-flex align-middle" title={texto}>
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            <span className="sr-only">({texto})</span>
        </span>
    );
}

/** Así quedará el informe diario: fecha > cliente > sede > ruta > placa > auxiliar (RF-05). */
function VistaPrevia({ grupos, totales }: { grupos: Grupo[]; totales: Analisis['totales'] }) {
    return (
        <Panel titulo="Vista previa del informe" descripcion="Así quedará el informe diario con las órdenes válidas del archivo." cuerpoClassName="px-0 pb-2">
            {grupos.length === 0 ? (
                <p className="text-muted-foreground px-5 pb-4 text-sm">No hay órdenes válidas para mostrar.</p>
            ) : (
                <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label="Vista previa del informe, desplazable">
                    <table className="w-full min-w-[1040px] text-left text-sm">
                        <caption className="sr-only">Vista previa del informe diario por cliente, sede, ruta, placa y auxiliar</caption>
                        <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                            <tr>
                                <th scope="col" className="py-2.5 pl-5 font-semibold">
                                    Cliente · sede
                                </th>
                                <th scope="col" className="px-3 py-2.5 font-semibold">
                                    Ruta
                                </th>
                                <th scope="col" className="px-3 py-2.5 font-semibold">
                                    Placa
                                </th>
                                <th scope="col" className="px-3 py-2.5 font-semibold">
                                    Auxiliar
                                </th>
                                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                    Asignadas
                                </th>
                                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                    Aprobadas
                                </th>
                                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                    Devoluciones
                                </th>
                                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                    Faltantes
                                </th>
                                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                    Averías
                                </th>
                                <th scope="col" className="w-44 py-2.5 pr-5 pl-3 font-semibold">
                                    Efectividad
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {grupos.map((g, i) => (
                                <tr key={i}>
                                    <td className="py-3 pl-5 whitespace-nowrap">
                                        <p className="font-semibold">{g.cliente}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {g.sede ?? 'Sin sede'} · {fmt.fechaCorta(g.fecha)}
                                        </p>
                                    </td>
                                    <td className="max-w-48 truncate px-3 py-3 text-xs" title={g.ruta ?? undefined}>
                                        {g.ruta ?? '—'}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                                        {g.placa ?? '—'}
                                        {g.placa && <Marca ok={g.vehiculoRegistrado} texto="vehículo no registrado" />}
                                    </td>
                                    <td className="min-w-44 px-3 py-3 text-xs">
                                        {g.auxiliar ?? '—'}
                                        {g.auxiliar && <Marca ok={g.auxiliarReconocido} texto="auxiliar no reconocido" />}
                                    </td>
                                    <td className="tabular px-3 py-3 text-right">{g.asignadas}</td>
                                    <td className="tabular px-3 py-3 text-right font-semibold">{g.aprobadas}</td>
                                    <td className="tabular px-3 py-3 text-right">{g.rechazadas}</td>
                                    <td className="tabular px-3 py-3 text-right">{g.faltantes}</td>
                                    <td className="tabular px-3 py-3 text-right">{g.averias}</td>
                                    <td className="py-3 pr-5 pl-3">
                                        <div className="flex items-center gap-2">
                                            <BarraProgreso valor={g.efectividad} etiqueta={`Efectividad de ${g.auxiliar ?? 'la ruta'}`} className="h-1.5 min-w-16 flex-1" />
                                            <span className="tabular w-12 text-right text-xs font-bold">{fmt.pctEntero(g.efectividad)}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 font-bold">
                            <tr>
                                <th scope="row" colSpan={4} className="py-3 pl-5 text-left">
                                    Total
                                </th>
                                <td className="tabular px-3 py-3 text-right">{fmt.numero(totales.ordenes)}</td>
                                <td className="tabular px-3 py-3 text-right">{fmt.numero(totales.aprobadas)}</td>
                                <td className="tabular px-3 py-3 text-right">{fmt.numero(totales.rechazadas)}</td>
                                <td className="tabular px-3 py-3 text-right">{fmt.numero(totales.faltantes)}</td>
                                <td className="tabular px-3 py-3 text-right">{fmt.numero(totales.averias)}</td>
                                <td className="tabular py-3 pr-5 pl-3 text-right">{fmt.pct(totales.efectividad)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </Panel>
    );
}

/** Acciones fijas al pie: el resumen de lo que va a pasar junto al botón que lo hace. */
function BarraAcciones({ cargaId, analisis, guardando }: { cargaId: number; analisis?: Analisis; guardando: boolean }) {
    const [importando, setImportando] = useState(false);
    const ordenes = analisis?.totales.ordenes ?? 0;
    const omitidas = analisis?.filasConError ?? 0;
    const bloqueado = !analisis || ordenes === 0 || analisis.columnasFaltantes.length > 0;

    const importar = () => router.post(`/cargas/${cargaId}/confirmar`, {}, { onStart: () => setImportando(true), onFinish: () => setImportando(false) });
    const descartar = () => router.delete(`/cargas/${cargaId}`);

    const textoImportar = `Importar ${fmt.numero(ordenes)} ${ordenes === 1 ? 'orden' : 'órdenes'}`;

    return (
        <div className="bg-card/95 sticky bottom-0 z-10 mt-auto border-t px-4 py-3 backdrop-blur-md md:rounded-b-xl md:px-8">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm" aria-live="polite">
                    {analisis ? (
                        <>
                            Se importarán <strong className="text-foreground">{fmt.numero(ordenes)}</strong> {ordenes === 1 ? 'orden' : 'órdenes'}
                            {omitidas > 0 && (
                                <>
                                    {' '}
                                    y se omitirán <strong className="text-critical">{fmt.numero(omitidas)}</strong> {omitidas === 1 ? 'fila' : 'filas'}
                                </>
                            )}
                            .
                        </>
                    ) : (
                        'No se puede importar este archivo.'
                    )}
                </p>
                <div className="flex items-center gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="text-critical hover:bg-critical-soft hover:text-critical rounded-lg font-semibold" disabled={importando}>
                                <Trash2 className="size-4" aria-hidden="true" />
                                Descartar
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogTitle>¿Descartar esta carga?</DialogTitle>
                            <DialogDescription>Se borra el archivo subido y no se importa ninguna orden. Puedes volver a subirlo cuando quieras.</DialogDescription>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="outline" className="rounded-lg">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button variant="destructive" className="rounded-lg" onClick={descartar}>
                                    Sí, descartar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {omitidas > 0 && !bloqueado ? (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="h-10 rounded-lg px-5 font-semibold" disabled={guardando || importando}>
                                    {importando && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                                    {textoImportar}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogTitle>¿Importar sin las filas con error?</DialogTitle>
                                <DialogDescription>
                                    {fmt.numero(omitidas)} {omitidas === 1 ? 'fila no se importará' : 'filas no se importarán'}. Si son órdenes reales, corrígelas en Drivin y súbelas en un archivo
                                    aparte: el sistema no duplica las órdenes que ya existan.
                                </DialogDescription>
                                <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                        <Button variant="outline" className="rounded-lg">
                                            Seguir revisando
                                        </Button>
                                    </DialogClose>
                                    <Button className="rounded-lg" onClick={importar}>
                                        {textoImportar}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <Button className="h-10 rounded-lg px-5 font-semibold" disabled={bloqueado || guardando || importando} onClick={importar}>
                            {importando && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
                            {textoImportar}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
