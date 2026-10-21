/**
 * Reglas del protocolo de prueba de entrega (RF-09 y RF-10), igual que en el servidor
 * (app/Services/Pod/EvaluadorProtocolo.php), para mostrar el resultado en vivo mientras se audita.
 */
export const MIN_SELLADO = 4;
export const MIN_DESTAPADO = 4;

export interface Checklist {
    foto_fachada: boolean;
    fotos_sellado: number;
    fotos_destapado: number;
    /** Borrosas o ilegibles: no cuentan en sellado ni destapado, pero dejan su novedad. */
    fotos_ilegibles: number;
    foto_remesa: boolean;
    foto_rotulo: boolean;
    recibe_sin_destapar: boolean;
    sin_evidencia: boolean;
}

export interface Evaluacion {
    cumple: boolean;
    faltantes: string[];
    novedad: string;
    concepto: string;
}

const enumerar = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);

export function evaluar(c: Checklist): Evaluacion {
    if (c.sin_evidencia) {
        return { cumple: false, faltantes: ['todas las evidencias'], novedad: 'Sin evidencia', concepto: 'La entrega no tiene evidencias cargadas.' };
    }

    const ilegibles = c.fotos_ilegibles ?? 0;
    const notaIlegibles =
        ilegibles > 0 ? ` ${ilegibles === 1 ? '1 foto borrosa o ilegible no se tuvo' : `${ilegibles} fotos borrosas o ilegibles no se tuvieron`} en cuenta.` : '';
    const faltaFachada = !c.foto_fachada;
    const faltaRemesa = !c.foto_remesa;
    const faltaSellado = c.fotos_sellado < MIN_SELLADO;
    const faltaDestapado = !c.recibe_sin_destapar && c.fotos_destapado < MIN_DESTAPADO;

    const faltantes = [
        faltaFachada && 'foto de fachada',
        faltaSellado && `fotos del producto sellado (${c.fotos_sellado} de ${MIN_SELLADO})`,
        faltaDestapado && `fotos del producto destapado (${c.fotos_destapado} de ${MIN_DESTAPADO})`,
        faltaRemesa && 'remesa firmada',
    ].filter(Boolean) as string[];

    if (faltantes.length === 0) {
        // Cumple con las que se ven bien, pero hubo fotos que no sirvieron
        const novedad =
            ilegibles > 0 ? 'Buen protocolo de entrega pero puede mejorar' : c.recibe_sin_destapar ? 'Entregado sin destapar con nota en remesa' : 'Buen protocolo de entrega';
        const concepto = c.recibe_sin_destapar
            ? 'Buen protocolo: fachada, producto sellado y remesa con la nota "Recibe sin destapar a conformidad".'
            : 'Buen protocolo de entrega: fachada, producto sellado y destapado, y remesa firmada.';
        return { cumple: true, faltantes, novedad, concepto: concepto + notaIlegibles };
    }

    // Si lo que falta son fotos del producto y hubo fotos que no se pudieron ver, la causa son esas fotos
    const novedad =
        faltaFachada && faltaRemesa
            ? 'Falta foto de fachada y remesa firmada'
            : faltaRemesa
              ? 'Falta remesa firmada'
              : faltaFachada
                ? 'Falta foto de fachada'
                : ilegibles > 0
                  ? 'Fotos borrosas o ilegibles'
                  : faltaSellado
                    ? 'Faltan fotos de producto sellado'
                    : 'Faltan fotos de producto destapado';

    return { cumple: false, faltantes, novedad, concepto: `Falta: ${enumerar(faltantes)}.${notaIlegibles}` };
}

export type TipoEvidencia = 'fachada' | 'sellado' | 'destapado' | 'remesa' | 'rotulo' | 'pdf_pod' | 'ilegible' | 'otro';

/** En el orden del protocolo; `corto` cabe en el selector de cada foto. */
export const TIPOS_FOTO: { valor: TipoEvidencia; texto: string; corto: string }[] = [
    { valor: 'fachada', texto: 'Fachada', corto: 'Fachada' },
    { valor: 'sellado', texto: 'Producto sellado', corto: 'Sellado' },
    { valor: 'destapado', texto: 'Producto destapado', corto: 'Destapado' },
    { valor: 'remesa', texto: 'Remesa o factura firmada', corto: 'Remesa' },
    { valor: 'rotulo', texto: 'Rótulo', corto: 'Rótulo' },
    // No cuenta para el protocolo
    { valor: 'ilegible', texto: 'Borrosa o ilegible', corto: 'Borrosa o ilegible' },
    { valor: 'otro', texto: 'Sin clasificar', corto: 'Sin clasificar' },
];

export type EstadoAuditoria = 'pendiente' | 'pendiente_sin_archivos' | 'cumple' | 'no_cumple' | 'sin_evidencia';
