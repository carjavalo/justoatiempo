import { type Checklist, type EstadoAuditoria, type Evaluacion, type TipoEvidencia } from '@/lib/protocolo';

export interface FiltrosAuditoria {
    fecha: string;
    cliente: number | null;
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
    cliente: string | null;
    sede: string | null;
    auxiliar: string | null;
    placa: string | null;
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
}

export interface OrdenDetalle {
    id: number;
    codigo: string;
    fecha: string;
    cliente: string | null;
    sede: string | null;
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
