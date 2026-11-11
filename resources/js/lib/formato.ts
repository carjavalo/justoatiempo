const numero = new Intl.NumberFormat('es-CO');
const porcentaje1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Las fechas llegan como "YYYY-MM-DD"; se interpretan en hora local para no correr el día. */
export function aFecha(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

export const fmt = {
    numero: (n: number) => numero.format(n),
    pct: (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${porcentaje1.format(n)}%`),
    pctEntero: (n: number) => `${Math.round(n)}%`,
    fechaCorta: (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', ''),
    fechaLarga: (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
    fechaMedia: (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', ''),
    diaSemana: (iso: string) => aFecha(iso).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
};

const relativo = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
];

/** "hace 3 horas", "ayer"… para fechas con hora (ISO 8601). */
export function haceCuanto(iso: string): string {
    const segundos = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unidad, tamano] of UNIDADES) {
        if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad);
    }
    return 'hace un momento';
}

export const fechaHoraCompleta = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });

/** Diferencia en puntos porcentuales o relativa, para los indicadores de tendencia. */
export function variacion(actual: number | null, previo: number | null, modo: 'puntos' | 'relativa' = 'relativa'): number | null {
    if (actual === null || previo === null) return null;
    if (modo === 'puntos') return actual - previo;
    return previo === 0 ? null : ((actual - previo) / previo) * 100;
}

export type NivelEstado = 'good' | 'warning' | 'critical';

/** "Buenos días", "Buenas tardes" o "Buenas noches", según la hora de quien mira. */
export function saludo(): string {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/**
 * Semáforo del Excel de la operación, de mayor a menor: desde qué porcentaje aplica cada estado. Lo usan el cálculo y
 * su leyenda (EscalaSemaforo), así que no pueden decir cosas distintas.
 */
export const ESCALA_SEMAFORO: { nivel: NivelEstado; desde: number; rango: string; texto: string }[] = [
    { nivel: 'good', desde: 100, rango: '100%', texto: 'operación completa' },
    { nivel: 'warning', desde: 80, rango: '80–99%', texto: 'revisar pendientes' },
    { nivel: 'critical', desde: -Infinity, rango: 'menos de 80%', texto: 'seguimiento inmediato' },
];

/** El estado de un porcentaje en el semáforo: "Operación completa", "Revisar pendientes" o "Seguimiento inmediato". */
export function semaforo(cumplimiento: number | null): { nivel: NivelEstado; texto: string } | null {
    if (cumplimiento === null) return null;
    const { nivel, texto } = ESCALA_SEMAFORO.find((e) => cumplimiento >= e.desde)!;
    return { nivel, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
}

/** Semáforo frente a la meta: en meta, hasta 10 pts por debajo, o crítico. */
export function nivelFrenteAMeta(valor: number | null, meta: number): NivelEstado | null {
    if (valor === null) return null;
    if (valor >= meta) return 'good';
    if (valor >= meta - 10) return 'warning';
    return 'critical';
}
