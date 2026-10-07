import { EstadoCargaBadge, type EstadoCarga } from '@/components/cargas/piezas';
import { Panel } from '@/components/dashboard/piezas';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CalendarClock, ChevronLeft, ChevronRight, FileSpreadsheet, LoaderCircle, UploadCloud, XCircle } from '@/components/iconos';
import { type DragEvent, useRef, useState } from 'react';

interface FilaCarga {
    id: number;
    archivo: string;
    fechaOperacion: string | null;
    estado: EstadoCarga;
    estadoLabel: string;
    filas: number;
    ordenes: number;
    filasError: number;
    advertencias: number;
    usuario: string | null;
    creada: string;
    duracionMs: number | null;
}

interface Paginado<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

const EXTENSIONES = '.xlsx,.xls,.csv';
const formatoFechaHora = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Cargas({ cargas, jornadaPendiente }: { cargas: Paginado<FilaCarga>; jornadaPendiente: string | null }) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [processing, setProcessing] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [arrastrando, setArrastrando] = useState(false);
    const [nombre, setNombre] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    // Elegir el archivo ya es la intención de subirlo: se envía de inmediato y se pasa a la revisión
    const subir = (archivo: File | undefined) => {
        if (!archivo) return;
        setNombre(archivo.name);
        // Se envía el archivo directamente: el estado de un formulario se actualiza tarde y saldría vacío
        router.post(
            '/cargas',
            { archivo },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => {
                    setProcessing(true);
                    setProgreso(0);
                },
                onProgress: (p) => setProgreso(p?.percentage ?? 0),
                onFinish: () => {
                    setProcessing(false);
                    if (input.current) input.current.value = '';
                },
            },
        );
    };

    const soltar = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setArrastrando(false);
        subir(e.dataTransfer.files?.[0]);
    };

    return (
        <AppLayout>
            <Head title="Cargas Drivin" />

            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">Cargas Drivin</h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                        Sube la preliquidación exportada de Drivin. El sistema la revisa contigo antes de importar y arma el informe diario de cada cliente y sede.
                    </p>
                </div>

                {jornadaPendiente && (
                    <div className="bg-secondary text-secondary-foreground flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
                        <CalendarClock className="size-5 shrink-0" aria-hidden="true" />
                        <p>
                            Falta cargar la operación del <strong className="first-letter:uppercase">{fmt.fechaLarga(jornadaPendiente)}</strong>.
                        </p>
                    </div>
                )}

                {/* Zona de carga: el input es accesible por teclado; la etiqueta es la zona visible */}
                <div>
                    <input
                        ref={input}
                        id="archivo"
                        type="file"
                        accept={EXTENSIONES}
                        className="peer sr-only"
                        disabled={processing}
                        aria-describedby="archivo-ayuda archivo-error"
                        onChange={(e) => subir(e.target.files?.[0])}
                    />
                    <label
                        htmlFor="archivo"
                        onDragOver={(e) => {
                            e.preventDefault();
                            setArrastrando(true);
                        }}
                        onDragLeave={() => setArrastrando(false)}
                        onDrop={soltar}
                        className={cn(
                            'bg-card flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                            'peer-focus-visible:border-ring peer-focus-visible:border-solid peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/25',
                            'hover:border-primary/50 hover:bg-secondary/40',
                            arrastrando && 'border-brand-coral bg-brand-coral-soft/40',
                            processing && 'pointer-events-none',
                            errors.archivo && 'border-critical/60',
                        )}
                    >
                        {processing ? (
                            <>
                                <LoaderCircle className="text-primary size-10 motion-safe:animate-spin" aria-hidden="true" />
                                <span className="text-base font-bold">Leyendo {nombre}…</span>
                                <span className="bg-muted h-1.5 w-full max-w-xs overflow-hidden rounded-full" role="progressbar" aria-label="Progreso de la subida" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
                                    <span className="bg-primary block h-full rounded-full transition-[width]" style={{ width: `${Math.max(progreso, 5)}%` }} />
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                                    <UploadCloud className="size-7" aria-hidden="true" />
                                </span>
                                <span className="text-base font-bold">
                                    Arrastra aquí la preliquidación o <span className="text-primary underline underline-offset-4">elige el archivo</span>
                                </span>
                                <span id="archivo-ayuda" className="text-muted-foreground text-xs">
                                    Excel (.xlsx, .xls) o CSV exportado de Drivin · máximo 10 MB
                                </span>
                            </>
                        )}
                    </label>
                    <div id="archivo-error" aria-live="polite">
                        {errors.archivo && (
                            <p className="text-critical mt-3 flex items-center gap-2 text-sm font-medium">
                                <XCircle className="size-4 shrink-0" aria-hidden="true" />
                                {errors.archivo}
                            </p>
                        )}
                    </div>
                </div>

                <Panel titulo="Historial de cargas" descripcion={cargas.total ? `${fmt.numero(cargas.total)} ${cargas.total === 1 ? 'carga' : 'cargas'} en total` : undefined} cuerpoClassName="px-0 pb-2">
                    {cargas.data.length === 0 ? (
                        <p className="text-muted-foreground px-5 pb-4 text-sm">Todavía no se ha subido ninguna preliquidación.</p>
                    ) : (
                        <>
                            <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label="Historial de cargas, desplazable">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <caption className="sr-only">Historial de cargas de la preliquidación</caption>
                                    <thead className="text-muted-foreground border-y text-[0.72rem] tracking-wide uppercase">
                                        <tr>
                                            <th scope="col" className="py-2.5 pl-5 font-semibold">
                                                Archivo
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                                Operación
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                                Órdenes
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                                                Filas omitidas
                                            </th>
                                            <th scope="col" className="px-3 py-2.5 font-semibold">
                                                Estado
                                            </th>
                                            <th scope="col" className="py-2.5 pr-5 pl-3 font-semibold">
                                                Subida
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {cargas.data.map((c) => (
                                            <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                                                <td className="py-3 pl-5">
                                                    <Link href={`/cargas/${c.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                                                        <FileSpreadsheet className="text-primary size-4 shrink-0" aria-hidden="true" />
                                                        <span className="max-w-72 truncate">{c.archivo}</span>
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">{c.fechaOperacion ? fmt.fechaMedia(c.fechaOperacion) : '—'}</td>
                                                <td className="tabular px-3 py-3 text-right font-semibold">{c.estado === 'en_revision' ? '—' : fmt.numero(c.ordenes)}</td>
                                                <td className={cn('tabular px-3 py-3 text-right', c.filasError > 0 && 'text-warning font-semibold')}>
                                                    {c.estado === 'en_revision' ? '—' : fmt.numero(c.filasError)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <EstadoCargaBadge estado={c.estado} texto={c.estadoLabel} />
                                                </td>
                                                <td className="text-muted-foreground py-3 pr-5 pl-3 text-xs whitespace-nowrap">
                                                    {formatoFechaHora.format(new Date(c.creada))}
                                                    {c.usuario && <> · {c.usuario}</>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {cargas.last_page > 1 && (
                                <nav aria-label="Paginación del historial" className="flex items-center justify-between border-t px-5 pt-3 text-xs">
                                    <span className="text-muted-foreground">
                                        {cargas.from}–{cargas.to} de {cargas.total}
                                    </span>
                                    <div className="flex gap-1">
                                        <PaginaLink href={cargas.prev_page_url} etiqueta="Página anterior">
                                            <ChevronLeft className="size-4" aria-hidden="true" />
                                        </PaginaLink>
                                        <PaginaLink href={cargas.next_page_url} etiqueta="Página siguiente">
                                            <ChevronRight className="size-4" aria-hidden="true" />
                                        </PaginaLink>
                                    </div>
                                </nav>
                            )}
                        </>
                    )}
                </Panel>
            </div>
        </AppLayout>
    );
}

function PaginaLink({ href, etiqueta, children }: { href: string | null; etiqueta: string; children: React.ReactNode }) {
    const clase = 'flex size-8 items-center justify-center rounded-lg border';
    if (!href) {
        return (
            <span className={cn(clase, 'text-muted-foreground/50')} aria-hidden="true">
                {children}
            </span>
        );
    }
    return (
        <Link href={href} preserveScroll className={cn(clase, 'hover:bg-muted')} aria-label={etiqueta}>
            {children}
        </Link>
    );
}
