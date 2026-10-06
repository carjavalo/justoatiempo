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

/** Diferencia en puntos porcentuales o relativa, para los indicadores de tendencia. */
export function variacion(actual: number | null, previo: number | null, modo: 'puntos' | 'relativa' = 'relativa'): number | null {
    if (actual === null || previo === null) return null;
    if (modo === 'puntos') return actual - previo;
    return previo === 0 ? null : ((actual - previo) / previo) * 100;
}

export type NivelEstado = 'good' | 'warning' | 'critical';

/** Semáforo frente a la meta: en meta, hasta 10 pts por debajo, o crítico. */
export function nivelFrenteAMeta(valor: number | null, meta: number): NivelEstado | null {
    if (valor === null) return null;
    if (valor >= meta) return 'good';
    if (valor >= meta - 10) return 'warning';
    return 'critical';
}
