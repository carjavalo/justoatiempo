import { CalendarRange, ChevronLeft, ChevronRight } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { aFecha, fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SEMANA = [
    ['L', 'lunes'],
    ['M', 'martes'],
    ['M', 'miércoles'],
    ['J', 'jueves'],
    ['V', 'viernes'],
    ['S', 'sábado'],
    ['D', 'domingo'],
] as const;

/** El rango más largo que acepta el tablero: 3 años (como en el servidor). */
const MAX_DIAS = 1096;

const aIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (iso: string, n: number) => {
    const d = aFecha(iso);
    return aIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
/** El primer día del mes de la fecha, corrido `meses` meses. */
const primeroDelMes = (iso: string, meses = 0) => {
    const d = aFecha(iso);
    return aIso(new Date(d.getFullYear(), d.getMonth() + meses, 1));
};
const diasEntre = (a: string, b: string) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000) + 1;
/** Lunes = 0 … domingo = 6. */
const diaSemana = (iso: string) => (aFecha(iso).getDay() + 6) % 7;
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const nombreCompleto = (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "1 oct – 15 nov 2026"; con años distintos, cada fecha con el suyo; un solo día, ese día. */
export function rangoCorto(desde: string, hasta: string) {
    if (desde === hasta) return fmt.fechaMedia(desde);
    const corta = (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
    return desde.slice(0, 4) === hasta.slice(0, 4)
        ? `${corta(desde)} – ${fmt.fechaMedia(hasta)}`
        : `${fmt.fechaMedia(desde)} – ${fmt.fechaMedia(hasta)}`;
}

/** Las semanas del mes, de lunes a domingo; los días de otros meses quedan vacíos. Siempre 6, para que no salte. */
function semanas(mes: string): (string | null)[][] {
    const inicio = aFecha(mes);
    const diasDelMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    const celdas: (string | null)[] = [
        ...Array<null>(diaSemana(mes)).fill(null),
        ...Array.from({ length: diasDelMes }, (_, i) => aIso(new Date(inicio.getFullYear(), inicio.getMonth(), i + 1))),
    ];
    while (celdas.length < 42) celdas.push(null);
    return Array.from({ length: 6 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/** Si la pantalla cumple la consulta (p. ej. ancha para dos meses), y se actualiza al cambiar. */
function useConsulta(consulta: string) {
    const [coincide, setCoincide] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const m = window.matchMedia(consulta);
        const cambiar = () => setCoincide(m.matches);
        cambiar();
        m.addEventListener('change', cambiar);
        return () => m.removeEventListener('change', cambiar);
    }, [consulta]);
    return coincide;
}

interface Props {
    desde: string;
    hasta: string;
    /** Si el rango vigente lo eligió la persona (y no un periodo de 7, 30 o 90 días). */
    activo: boolean;
    /** La primera fecha con datos: desde su año se ofrecen los años. */
    primera: string | null;
    onAplicar: (desde: string, hasta: string) => void;
}

/**
 * El rango de fechas de un tablero, en un calendario: el mes y el año se eligen en sus listas (o con las flechas), el
 * primer clic marca el primer día y el segundo el último (si va antes, se ordena solo). Atajos: este mes, el anterior,
 * este año y el anterior. Con teclado: flechas por día y semana, Re Pág / Av Pág por mes (con Mayús, por año), Inicio y
 * Fin de la semana. Los días que no han llegado no se eligen.
 */
export function RangoFechas({ desde, hasta, activo, primera, onAplicar }: Props) {
    const hoy = aIso(new Date());
    const dos = useConsulta('(min-width: 640px)');
    const [abierto, setAbierto] = useState(false);
    const [inicio, setInicio] = useState<string | null>(desde);
    const [fin, setFin] = useState<string | null>(hasta);
    const [sobre, setSobre] = useState<string | null>(null);
    const [mes, setMes] = useState(primeroDelMes(desde));
    const [foco, setFoco] = useState(desde);
    const rejilla = useRef<HTMLDivElement>(null);
    const enfocar = useRef(false);
    const id = useId();

    // Al abrir, el calendario parte del rango que se está viendo
    const abrir = (v: boolean) => {
        if (v) {
            setInicio(desde);
            setFin(hasta);
            setSobre(null);
            setMes(primeroDelMes(desde));
            setFoco(desde);
        }
        setAbierto(v);
    };

    // Tras moverse con el teclado, el foco sigue al día (aunque haya cambiado de mes)
    useEffect(() => {
        if (!enfocar.current) return;
        enfocar.current = false;
        rejilla.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
    }, [foco, mes]);

    const anioHoy = aFecha(hoy).getFullYear();
    const anioMinimo = Math.min(primera ? aFecha(primera).getFullYear() : anioHoy, anioHoy - 1, aFecha(desde).getFullYear());
    const anios = Array.from({ length: anioHoy - anioMinimo + 1 }, (_, i) => String(anioHoy - i));
    const visibles = dos ? [mes, primeroDelMes(mes, 1)] : [mes];
    const primerMes = `${anioMinimo}-01-01`;
    const ultimoMes = primeroDelMes(hoy);
    const puedeAtras = mes > primerMes;
    const puedeAdelante = visibles[visibles.length - 1] < ultimoMes;

    /** Mostrar el mes (sin pasarse del primero ni del de hoy). */
    const irA = (m: string) => {
        const tope = dos ? primeroDelMes(ultimoMes, -1) : ultimoMes;
        setMes(m < primerMes ? primerMes : m > tope ? tope : m);
    };

    const elegir = (dia: string) => {
        if (dia > hoy) return;
        setFoco(dia);
        setSobre(null);
        if (!inicio || fin) {
            setInicio(dia);
            setFin(null);
        } else if (dia < inicio) {
            setFin(inicio);
            setInicio(dia);
        } else {
            setFin(dia);
        }
    };

    const teclas = (e: KeyboardEvent, dia: string) => {
        const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        let destino: string | null = null;
        if (e.key in pasos) destino = masDias(dia, pasos[e.key]);
        else if (e.key === 'Home') destino = masDias(dia, -diaSemana(dia));
        else if (e.key === 'End') destino = masDias(dia, 6 - diaSemana(dia));
        else if (e.key === 'PageUp' || e.key === 'PageDown') {
            const d = aFecha(dia);
            const objetivo = new Date(d.getFullYear(), d.getMonth() + (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1), 1);
            const ultimo = new Date(objetivo.getFullYear(), objetivo.getMonth() + 1, 0).getDate();
            destino = aIso(new Date(objetivo.getFullYear(), objetivo.getMonth(), Math.min(d.getDate(), ultimo)));
        }
        if (!destino) return;
        e.preventDefault();
        if (destino > hoy) destino = hoy;
        if (destino < primerMes) destino = primerMes;
        // Con el primer día elegido, moverse ya muestra el rango que quedaría
        setSobre(inicio && !fin ? destino : null);
        const delDestino = primeroDelMes(destino);
        if (delDestino < visibles[0]) irA(delDestino);
        else if (delDestino > visibles[visibles.length - 1]) irA(dos ? primeroDelMes(destino, -1) : delDestino);
        enfocar.current = true;
        setFoco(destino);
    };

    // El rango que se ve: el elegido o, mientras falta el último día, hasta el día señalado
    const otroExtremo = fin ?? (inicio && sobre ? sobre : null);
    const [a, z] = inicio && otroExtremo ? (otroExtremo < inicio ? [otroExtremo, inicio] : [inicio, otroExtremo]) : [inicio, inicio];
    const focoVisible = visibles.some((m) => primeroDelMes(foco) === m) ? foco : visibles[0];

    const finElegido = fin ?? inicio;
    const dias = inicio && finElegido ? diasEntre(inicio, finElegido) : 0;
    const demasiado = dias > MAX_DIAS;

    const atajos = [
        { texto: 'Este mes', desde: primeroDelMes(hoy), hasta: hoy },
        { texto: 'Mes anterior', desde: primeroDelMes(hoy, -1), hasta: masDias(primeroDelMes(hoy), -1) },
        { texto: 'Este año', desde: `${anioHoy}-01-01`, hasta: hoy },
        { texto: 'Año anterior', desde: `${anioHoy - 1}-01-01`, hasta: `${anioHoy - 1}-12-31` },
    ];

    const mesCalendario = (m: string, i: number) => {
        const d = aFecha(m);
        const titulo = `${capital(MESES[d.getMonth()])} de ${d.getFullYear()}`;
        return (
            // La clave es la posición, no el mes: así las listas de mes y año no se vuelven a montar al cambiar de mes y
            // el foco se queda en ellas
            <div key={i} className="min-w-0">
                {/* El primer mes se elige en sus listas; el segundo dice cuál es */}
                <div className="mb-3 flex h-9 items-center gap-2">
                    {i === 0 ? (
                        <>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-9 shrink-0 rounded-lg"
                                onClick={() => irA(primeroDelMes(m, -1))}
                                disabled={!puedeAtras}
                            >
                                <ChevronLeft className="size-4" aria-hidden="true" />
                                <span className="sr-only">Mes anterior</span>
                            </Button>
                            <Selector
                                id={`${id}-mes`}
                                aria-label="Mes"
                                valor={String(d.getMonth())}
                                onCambio={(v) => irA(aIso(new Date(d.getFullYear(), Number(v), 1)))}
                                opciones={MESES.map((n, k) => ({ valor: String(k), texto: capital(n) }))}
                                className="h-9 min-w-0 flex-1"
                            />
                            <Selector
                                id={`${id}-anio`}
                                aria-label="Año"
                                valor={String(d.getFullYear())}
                                onCambio={(v) => irA(aIso(new Date(Number(v), d.getMonth(), 1)))}
                                opciones={anios.map((n) => ({ valor: n, texto: n }))}
                                className="h-9 w-[5.5rem] shrink-0"
                            />
                        </>
                    ) : (
                        <p className="flex-1 text-center text-sm font-bold" aria-hidden="true">
                            {titulo}
                        </p>
                    )}
                    {i === visibles.length - 1 && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-9 shrink-0 rounded-lg"
                            onClick={() => irA(primeroDelMes(m, i === 0 ? 1 : 0))}
                            disabled={!puedeAdelante}
                        >
                            <ChevronRight className="size-4" aria-hidden="true" />
                            <span className="sr-only">Mes siguiente</span>
                        </Button>
                    )}
                </div>

                <table role="grid" aria-label={titulo} className="w-full border-collapse">
                    <thead>
                        <tr>
                            {SEMANA.map(([letra, nombre]) => (
                                <th key={nombre} scope="col" abbr={nombre} className="text-muted-foreground h-8 text-xs font-semibold">
                                    <span aria-hidden="true">{letra}</span>
                                    <span className="sr-only">{nombre}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {semanas(m).map((fila, f) => (
                            <tr key={f}>
                                {fila.map((dia, k) => {
                                    if (!dia) return <td key={k} className="h-10 p-0" />;
                                    const enRango = !!a && !!z && dia >= a && dia <= z;
                                    const extremo = dia === a || dia === z;
                                    const futuro = dia > hoy;
                                    const estado =
                                        dia === a && dia === z
                                            ? ''
                                            : dia === a
                                              ? ', primer día'
                                              : dia === z
                                                ? ', último día'
                                                : enRango
                                                  ? ', dentro del rango'
                                                  : '';
                                    return (
                                        <td
                                            key={k}
                                            role="gridcell"
                                            aria-selected={enRango}
                                            className={cn(
                                                'h-10 p-0',
                                                // La franja del rango, de punta a punta
                                                enRango && 'bg-secondary',
                                                dia === a && 'rounded-l-lg',
                                                dia === z && 'rounded-r-lg',
                                            )}
                                        >
                                            <button
                                                type="button"
                                                data-dia={dia}
                                                tabIndex={dia === focoVisible ? 0 : -1}
                                                aria-disabled={futuro || undefined}
                                                aria-label={`${nombreCompleto(dia)}${dia === hoy ? ', hoy' : ''}${estado}${futuro ? ', aún no llega' : ''}`}
                                                onClick={() => elegir(dia)}
                                                onKeyDown={(e) => teclas(e, dia)}
                                                onMouseEnter={() => inicio && !fin && !futuro && setSobre(dia)}
                                                className={cn(
                                                    'relative mx-auto flex size-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
                                                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden',
                                                    extremo && enRango
                                                        ? 'bg-accion text-accion-foreground focus-visible:ring-anillo-accion font-bold'
                                                        : futuro
                                                          ? 'text-muted-foreground/50 cursor-not-allowed'
                                                          : 'hover:bg-muted',
                                                    // Hoy: un punto debajo del número
                                                    dia === hoy && 'after:absolute after:bottom-1.5 after:size-1 after:rounded-full after:bg-current',
                                                )}
                                            >
                                                {aFecha(dia).getDate()}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <Dialog open={abierto} onOpenChange={abrir}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'focus-visible:ring-ring inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                        activo
                            ? 'bg-accion text-accion-foreground focus-visible:ring-anillo-accion border-transparent shadow-sm'
                            : 'bg-card hover:border-primary/50',
                    )}
                >
                    <CalendarRange className="size-4 shrink-0" aria-hidden="true" />
                    {activo ? rangoCorto(desde, hasta) : 'Fechas'}
                    <span className="sr-only">{activo ? ': cambiar las fechas elegidas' : ': elegir las fechas en el calendario'}</span>
                </button>
            </DialogTrigger>
            <DialogContent className={cn('gap-5 p-5 sm:p-6', dos && 'sm:max-w-[42rem]')}>
                <div>
                    <DialogTitle className="text-lg">Elegir las fechas</DialogTitle>
                    <DialogDescription>Elige el primer día y luego el último. Los indicadores se calculan con todo el rango.</DialogDescription>
                </div>

                <div role="group" aria-label="Atajos" className="flex flex-wrap gap-2">
                    {atajos.map((t) => {
                        const elegido = inicio === t.desde && finElegido === t.hasta;
                        return (
                            <Button
                                key={t.texto}
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-pressed={elegido}
                                className={cn('rounded-lg text-xs font-semibold', elegido && 'border-accion bg-secondary')}
                                onClick={() => {
                                    setInicio(t.desde);
                                    setFin(t.hasta);
                                    setSobre(null);
                                    setFoco(t.desde);
                                    irA(primeroDelMes(t.desde));
                                }}
                            >
                                {t.texto}
                            </Button>
                        );
                    })}
                </div>

                <div ref={rejilla} className={cn('grid gap-6', dos && 'grid-cols-2')} onMouseLeave={() => setSobre(null)}>
                    {visibles.map(mesCalendario)}
                </div>

                {/* En celular, el resumen va encima de los botones (el pie del diálogo los invierte por defecto) */}
                <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
                    <p role="status" className={cn('text-sm text-pretty', demasiado ? 'text-critical font-semibold' : 'text-muted-foreground')}>
                        {!inicio
                            ? 'Elige el primer día.'
                            : !fin
                              ? `Desde el ${fmt.fechaMedia(inicio)}: elige el último día o aplica solo ese día.`
                              : `Del ${fmt.fechaMedia(inicio)} al ${fmt.fechaMedia(fin)} · ${fmt.numero(dias)} ${dias === 1 ? 'día' : 'días'}`}
                        {demasiado && ' El rango puede ser de hasta 3 años.'}
                    </p>
                    <div className="flex shrink-0 gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="flex-1 rounded-lg sm:flex-none">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            className="flex-1 rounded-lg sm:flex-none"
                            disabled={!inicio || demasiado}
                            onClick={() => {
                                if (!inicio || !finElegido) return;
                                onAplicar(inicio, finElegido);
                                setAbierto(false);
                            }}
                        >
                            Aplicar
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
