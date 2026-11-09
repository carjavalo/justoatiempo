import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import { aFecha, fmt } from '@/lib/formato';
import { useRef } from 'react';

interface Props {
    id: string;
    /** Qué se elige ("Jornada", "Día"). */
    etiqueta: string;
    fecha: string | null;
    /** El hoy del servidor (el de los datos): con él se dice "Hoy", "Ayer" o "Mañana". */
    hoy: string;
    /** El día anterior y el siguiente a los que se puede ir (null: no hay). */
    anterior: string | null;
    siguiente: string | null;
    /** Atajo de vuelta (a hoy, o a la jornada más reciente): se ofrece solo cuando se está en otra fecha. */
    atajo?: { fecha: string; texto: string } | null;
    onIr: (fecha: string) => void;
}

const RELACION: Record<number, string> = { [-1]: 'Ayer', 0: 'Hoy', 1: 'Mañana' };

/** "lun, 9 de nov" y, si es cercano, cuál es frente a hoy; el año, solo si no es el de hoy. */
function nombreDia(iso: string, hoy: string) {
    const dia = aFecha(iso);
    const deHoy = aFecha(hoy);
    const dias = Math.round((dia.getTime() - deHoy.getTime()) / 86_400_000);
    const fecha = dia
        .toLocaleDateString('es-CO', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(dia.getFullYear() !== deHoy.getFullYear() && { year: 'numeric' }),
        })
        .replace(/\./g, '');
    return { relacion: RELACION[dias] ?? null, fecha };
}

/**
 * Moverse entre días: el anterior, el siguiente, uno elegido en el calendario o el atajo de vuelta. La fecha se lee
 * entera ("Hoy · lun, 9 de nov") en vez del campo numérico del navegador; el calendario es el del sistema.
 */
export function NavegadorFecha({ id, etiqueta, fecha, hoy, anterior, siguiente, atajo, onIr }: Props) {
    const campo = useRef<HTMLInputElement>(null);
    const nombre = fecha ? nombreDia(fecha, hoy) : null;

    const abrirCalendario = () => {
        const c = campo.current;
        if (!c) return;
        try {
            c.showPicker();
        } catch {
            // Sin showPicker (navegadores viejos): el clic del propio campo abre su calendario
            c.focus();
            c.click();
        }
    };

    return (
        <div className="flex w-full items-center gap-1 sm:w-auto">
            <Button
                variant="outline"
                size="icon"
                className="bg-card size-9 shrink-0 rounded-lg"
                disabled={!anterior}
                onClick={() => anterior && onIr(anterior)}
                aria-label={anterior ? `${etiqueta} anterior: ${fmt.fechaMedia(anterior)}` : `No hay ${etiqueta.toLowerCase()} anterior`}
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <div className="relative min-w-0 flex-1 sm:flex-none">
                <button
                    type="button"
                    onClick={abrirCalendario}
                    className="bg-card border-input hover:border-primary/50 focus-visible:ring-ring flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:w-[12.5rem]"
                >
                    <CalendarDays className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    {/* A la vista, abreviado; para el lector de pantalla, completo y con lo que hace (empieza igual) */}
                    <span className="truncate" aria-hidden="true">
                        {nombre ? (
                            <>
                                {nombre.relacion && (
                                    <>
                                        <span className="font-extrabold">{nombre.relacion}</span>
                                        <span className="text-muted-foreground" aria-hidden="true">
                                            {' · '}
                                        </span>
                                    </>
                                )}
                                {nombre.fecha}
                            </>
                        ) : (
                            'Elegir una fecha'
                        )}
                    </span>
                    <span className="sr-only">
                        {fecha && nombre
                            ? `${nombre.relacion ? `${nombre.relacion}, ` : ''}${fmt.fechaLarga(fecha)}. Elegir otra fecha`
                            : 'Elegir una fecha'}
                    </span>
                </button>
                {/* El campo del navegador solo aporta su calendario: no se ve ni recibe el foco (lo abre el botón) */}
                <input
                    ref={campo}
                    id={id}
                    type="date"
                    tabIndex={-1}
                    aria-hidden="true"
                    value={fecha ?? ''}
                    onChange={(e) => e.target.value && e.target.value !== fecha && onIr(e.target.value)}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                />
            </div>
            <Button
                variant="outline"
                size="icon"
                className="bg-card size-9 shrink-0 rounded-lg"
                disabled={!siguiente}
                onClick={() => siguiente && onIr(siguiente)}
                aria-label={siguiente ? `${etiqueta} siguiente: ${fmt.fechaMedia(siguiente)}` : `No hay ${etiqueta.toLowerCase()} siguiente`}
            >
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            {atajo && atajo.fecha !== fecha && (
                <Button variant="outline" className="bg-card h-9 shrink-0 rounded-lg px-3 text-xs font-semibold" onClick={() => onIr(atajo.fecha)}>
                    {atajo.texto}
                </Button>
            )}
        </div>
    );
}
