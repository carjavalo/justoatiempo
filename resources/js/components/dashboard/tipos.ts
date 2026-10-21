export interface Kpis {
    asignadas: number;
    aprobadas: number;
    rechazadas: number;
    efectividad: number;
    devoluciones: number;
    averias: number;
    faltantes: number;
    auditadas: number;
    cumplimientoPod: number | null;
    sinEvidencia: number;
    sinAuditar: number;
    auxiliares: number;
    jornadas: number;
}

export interface PuntoTendencia {
    fecha: string;
    asignadas: number;
    aprobadas: number;
    rechazadas: number;
    efectividad: number;
}

export interface MotivoRechazo {
    motivo: string;
    total: number;
}

export interface EfectividadSede {
    id: number;
    nombre: string;
    color: string | null;
    meta: number;
    asignadas: number;
    aprobadas: number;
    efectividad: number;
}

export interface FilaRanking {
    id: number;
    nombre: string;
    cedula: string;
    jornadas: number;
    asignadas: number;
    aprobadas: number;
    efectividad: number;
    pod: number | null;
    sinEvidencia: number;
    felicitaciones: number;
    retroalimentaciones: number;
    llamados: number;
}

export interface ComponenteProtocolo {
    clave: string;
    nombre: string;
    detalle: string;
    cumplimiento: number;
}

export interface Protocolo {
    auditadas: number;
    sinDestapar: number;
    componentes: ComponenteProtocolo[];
}

export interface InformePendiente {
    id: number;
    fecha: string;
    sede: string | null;
    color: string | null;
    sucursal: string | null;
    estado: 'borrador' | 'seguimiento' | 'cerrado';
    estadoLabel: string;
    efectividad: number;
    asignadas: number;
    sinAuditar: number;
}

export interface Pendientes {
    informes: InformePendiente[];
    ultimaCarga: {
        id: number;
        archivo_nombre: string;
        fecha_operacion: string;
        total_filas: number;
        estado: string;
        procesado_en: string | null;
    } | null;
}

export interface AccionReciente {
    id: number;
    fecha: string;
    tipo: 'felicitacion' | 'retroalimentacion' | 'llamado_atencion' | 'llamado_escrito';
    tipoLabel: string;
    persona: string | null;
    descripcion: string;
}

export interface DashboardProps {
    filtros: { desde: string; hasta: string; periodo: number | null; sede: number | null };
    vista: 'gerencial' | 'auxiliar';
    /** Sedes de las empresas que reciben la línea (TuGo, Sodimac…), con la empresa a la que pertenecen. */
    sedes: { id: number; nombre: string; color: string | null; empresa: string | null }[];
    ultimaOperacion: string | null;
    meta: number;
    kpis: Kpis;
    kpisPrevios: Kpis;
    tendencia: PuntoTendencia[];
    motivos: MotivoRechazo[];
    porSede: EfectividadSede[];
    ranking: FilaRanking[];
    protocolo: Protocolo;
    pendientes: Pendientes | null;
    acciones: AccionReciente[];
}
