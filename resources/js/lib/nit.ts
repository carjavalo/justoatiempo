/**
 * NIT colombiano en el navegador: mismo cálculo del dígito de verificación (DV) que hace el
 * servidor (App\Support\Nit), para mostrarlo mientras se escribe.
 */
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function partesNit(texto: string): { numero: string; dv: number | null } | null {
    const limpio = texto.trim().replace(/[\s.]/g, '');
    const m = /^(\d{6,15})(?:-(\d))?$/.exec(limpio);
    if (!m) return null;
    return { numero: m[1].replace(/^0+(?=\d)/, ''), dv: m[2] !== undefined ? Number(m[2]) : null };
}

export function digitoVerificacion(numero: string): number {
    const suma = [...numero].reverse().reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);
    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
}

/** "900123456-8" → "900.123.456-8" */
export function formatearNit(nit: string | null): string {
    if (!nit) return '';
    const [numero, dv] = nit.split('-');
    const conPuntos = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dv !== undefined ? `${conPuntos}-${dv}` : conPuntos;
}
