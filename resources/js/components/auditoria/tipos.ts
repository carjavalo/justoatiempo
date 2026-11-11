import { type Checklist, type EstadoAuditoria, type Evaluacion, type TipoEvidencia } from '@/lib/protocolo';

export interface FiltrosAuditoria {
    fecha: string;
    sede: number | null;
    estado: 'pendientes' | 'no_cumplen' | 'sin_evidencia' | 'auditadas' | 'todas';
    q: string | null;
}

export interface Jornada {
    fecha: string;
    aprobadas: number;
    pendientes: number;
}

export interface Resumen {
    aprobadas: number;
    auditadas: number;
    pendientes: number;
    cumplen: number;
    noCumplen: number;
    sinEvidencia: number;
    cumplimiento: number | null;
}

export interface OrdenCola {
    id: number;
    codigo: string;
    destinatario: string | null;
    ciudad: string | null;
    sede: string | null;
    sucursal: string | null;
    auxiliar: string | null;
    placa: string | null;
    /** Productos de la orden: las entregas que cuenta el informe. */
    productos: number;
    evidencias: number;
    estadoAuditoria: EstadoAuditoria;
}

export interface EvidenciaOrden {
    id: number;
    tipo: TipoEvidencia;
    nombre: string | null;
    esPdf: boolean;
    imagenes: number | null;
    tamano: number | null;
    url: string;
    /** Lo que propuso la IA de la foto: qué muestra y cómo se ve el producto. */
    ia: { tipo: TipoEvidencia | null; estado: 'bien' | 'posible_dano' | 'no_se_ve' | null; detalle: string | null } | null;
}

/** La revisión de las fotos con IA: si está configurada, cuántas fotos le faltan y lo que encontró. */
export interface RevisionIaOrden {
    disponible: boolean;
    pendientes: number;
    avisos: AvisoPdf[];
}

/** Algo que dice el PDF de Drivin de la entrega, leído al subirlo. */
export interface AvisoPdf {
    nivel: 'bien' | 'atencion' | 'info';
    texto: string;
    /** La firma del cliente, junto al aviso de que firmó. */
    imagen?: string;
}

export interface OrdenDetalle {
    id: number;
    codigo: string;
    fecha: string;
    sede: string | null;
    sucursal: string | null;
    ruta: string | null;
    placa: string | null;
    auxiliar: string | null;
    conductor: string | null;
    destinatario: string | null;
    direccion: string | null;
    ciudad: string | null;
    horaEntrega: string | null;
    comentarioPod: string | null;
    faltante: string | null;
    productos: string[];
    informeCerrado: boolean;
    evidencias: EvidenciaOrden[];
    /** Lo que dice el PDF de prueba de entrega más reciente que se pudo leer. */
    lecturaPdf: { avisos: AvisoPdf[] } | null;
    ia: RevisionIaOrden;
    auditoria: Checklist & {
        tipo_novedad_id: number | null;
        concepto: string | null;
        auditada: boolean;
        auditor: string | null;
        auditadaEn: string | null;
    };
    sugerencia: Evaluacion;
}

export interface TipoNovedad {
    id: number;
    nombre: string;
    severidad: 'ninguna' | 'leve' | 'grave';
}
