import { codigoCsrf } from '@/lib/sesion';

/**
 * Subida de muchos archivos en tandas: PHP acepta un número limitado de archivos por
 * petición (max_file_uploads, 20 por defecto) y descarta el resto sin avisar.
 */
export const TAMANO_TANDA = 15;

export interface ResultadoSubida {
    asignados: number;
    repetidos: number;
    ordenes: number[];
    sinOrden: string[];
    cerrados: string[];
    errores: string[];
}

export async function subirEnTandas(
    url: string,
    archivos: File[],
    extra: Record<string, string>,
    alAvanzar: (enviados: number, total: number) => void,
): Promise<ResultadoSubida> {
    const total: ResultadoSubida = { asignados: 0, repetidos: 0, ordenes: [], sinOrden: [], cerrados: [], errores: [] };

    for (let i = 0; i < archivos.length; i += TAMANO_TANDA) {
        const tanda = archivos.slice(i, i + TAMANO_TANDA);
        const datos = new FormData();
        tanda.forEach((a) => datos.append('archivos[]', a));
        Object.entries(extra).forEach(([k, v]) => datos.append(k, v));

        try {
            const r = await fetch(url, {
                method: 'POST',
                body: datos,
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': codigoCsrf() ?? '' },
            });
            // Sin sesión válida: el código venció (419), ya no hay sesión (401) o el servidor la cerró y llevó al
            // ingreso (una redirección, que fetch sigue y daría por buena)
            if (r.status === 419 || r.status === 401 || r.redirected) {
                total.errores.push('Tu sesión expiró o se cerró. Recarga la página e inténtalo de nuevo.');
                break;
            }
            const json = await r.json().catch(() => ({}));

            if (r.ok) {
                total.asignados += json.asignados ?? 0;
                total.repetidos += json.repetidos ?? 0;
                total.ordenes.push(...(json.ordenes ?? []));
                total.sinOrden.push(...(json.sinOrden ?? []));
                total.cerrados.push(...(json.cerrados ?? []));
            } else if (r.status === 422 && json.errors) {
                // Error de validación de una tanda: se informa y se sigue con las demás
                const mensajes = Object.values(json.errors as Record<string, string[]>).flat();
                total.errores.push(...new Set(mensajes));
            } else {
                total.errores.push(json.message ?? `No se pudo subir una tanda de archivos (error ${r.status}).`);
            }
        } catch {
            total.errores.push('Se perdió la conexión mientras se subían los archivos.');
            break;
        }

        alAvanzar(Math.min(i + TAMANO_TANDA, archivos.length), archivos.length);
    }

    total.ordenes = [...new Set(total.ordenes)];
    return total;
}
