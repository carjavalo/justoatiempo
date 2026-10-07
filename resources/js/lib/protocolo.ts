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
        return c.recibe_sin_destapar
            ? {
                  cumple: true,
                  faltantes,
                  novedad: 'Entregado sin destapar con nota en remesa',
                  concepto: 'Buen protocolo: fachada, producto sellado y remesa con la nota "Recibe sin destapar a conformidad".',
              }
            : { cumple: true, faltantes, novedad: 'Buen protocolo de entrega', concepto: 'Buen protocolo de entrega: fachada, producto sellado y destapado, y remesa firmada.' };
    }

    const novedad =
        faltaFachada && faltaRemesa
            ? 'Falta foto de fachada y remesa firmada'
            : faltaRemesa
              ? 'Falta remesa firmada'
              : faltaFachada
                ? 'Falta foto de fachada'
                : faltaSellado
                  ? 'Faltan fotos de producto sellado'
                  : 'Faltan fotos de producto destapado';

    return { cumple: false, faltantes, novedad, concepto: `Falta: ${enumerar(faltantes)}.` };
}

export type TipoEvidencia = 'fachada' | 'sellado' | 'destapado' | 'remesa' | 'rotulo' | 'pdf_pod' | 'otro';

/** En el orden del protocolo; `corto` cabe en el selector de cada foto. */
export const TIPOS_FOTO: { valor: TipoEvidencia; texto: string; corto: string }[] = [
    { valor: 'fachada', texto: 'Fachada', corto: 'Fachada' },
    { valor: 'sellado', texto: 'Producto sellado', corto: 'Sellado' },
    { valor: 'destapado', texto: 'Producto destapado', corto: 'Destapado' },
    { valor: 'remesa', texto: 'Remesa o factura firmada', corto: 'Remesa' },
    { valor: 'rotulo', texto: 'Rótulo', corto: 'Rótulo' },
    { valor: 'otro', texto: 'Sin clasificar', corto: 'Sin clasificar' },
];

export type EstadoAuditoria = 'pendiente' | 'pendiente_sin_archivos' | 'cumple' | 'no_cumple' | 'sin_evidencia';
