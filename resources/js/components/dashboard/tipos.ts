import { type DiaLogistica } from '@/components/linea/dia';

export interface Kpis {
    /** Entregas: los productos. */
    asignadas: number;
    /** Las órdenes (pedidos de Drivin) que traen esas entregas. */
    ordenes: number;
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
    /** El día de la línea (el mismo de su tarjeta en el inicio): no depende del periodo ni de la sede. */
    dia: DiaLogistica;
    acciones: AccionReciente[];
}
