/**
 * Contenido de la presentación de la empresa, tomado de la "Guía del portafolio de servicios
 * Justo a Tiempo SP S.A.S". Para cambiar textos o imágenes de la página principal, se edita aquí.
 */
import {
    AseoConstruccion,
    AseoIndustrial,
    Award,
    BadgeCheck,
    CalendarRange,
    Cog,
    ConjuntoResidencial,
    Factory,
    GraduationCap,
    HardHat,
    HeartPulse,
    Landmark,
    Layers,
    ListaChequeo,
    Map,
    PackageOpen,
    Scale,
    Sectores,
    ServicioLogistico,
    ShieldCheck,
    Shirt,
    ShoppingBag,
    SprayCan,
    Sprout,
    Store,
    Telescope,
    type TipoIcono,
    TreePine,
    Truck,
    UserCheck,
    UsersRound,
    UtensilsCrossed,
    Warehouse,
    Zap,
} from '@/components/iconos';

export const EMPRESA = {
    nombre: 'Justo a Tiempo SP S.A.S',
    nombreCorto: 'Justo a Tiempo SP',
    titular: 'Soluciones integrales en servicios operativos, logísticos y de aseo.',
    lema: 'Personal capacitado, compromiso y eficiencia al servicio de su operación.',
    quienesSomos: [
        'En Justo a Tiempo SP somos una empresa especializada en el suministro de personal operativo y la prestación de servicios integrales para los sectores logístico, industrial, comercial, institucional y de construcción.',
        'Nos enfocamos en proporcionar soluciones eficientes, flexibles y confiables que permiten a nuestros clientes fortalecer sus procesos operativos mediante talento humano altamente comprometido y capacitado.',
        'Nuestra experiencia nos permite atender operaciones de diferentes niveles de complejidad, garantizando calidad, oportunidad y cumplimiento en cada servicio prestado.',
    ],
    mision: 'Brindar soluciones integrales mediante el suministro de personal operativo y la prestación de servicios especializados, contribuyendo al crecimiento de nuestros clientes con talento humano competente, procesos eficientes y un firme compromiso con la calidad, la seguridad y la mejora continua.',
    vision: 'Consolidarnos como una empresa líder en la prestación de servicios operativos y logísticos a nivel nacional, siendo reconocidos por nuestra confiabilidad, capacidad de respuesta, innovación y excelencia en el servicio.',
    valores: ['Responsabilidad', 'Compromiso', 'Honestidad', 'Respeto', 'Trabajo en equipo', 'Calidad', 'Innovación', 'Orientación al cliente'],
    /** Entrada a COMPROMISOS: juntos dicen lo mismo que el párrafo del portafolio, sin repetirlo. */
    seguridad: 'Desarrollamos nuestras actividades promoviendo ambientes laborales seguros, sobre tres pilares:',
    cobertura:
        'Prestamos nuestros servicios a nivel nacional, adaptándonos a las necesidades operativas de cada cliente y garantizando disponibilidad de personal para proyectos temporales, permanentes y de alta demanda.',
};

export interface LineaServicio {
    id: string;
    nombre: string;
    icono: TipoIcono;
    /**
     * Foto del servicio: todas con la misma proporción vertical (0,62). Las de logística y personal son fotos reales
     * de la operación (images/operacion); las demás, ilustrativas con el logo oficial.
     */
    imagen: string;
    descripcion: string;
    /** Cómo nombra el portafolio la lista: actividades, perfiles, incluye o servicios. */
    tituloLista: string;
    items: string[];
    /** El ítem que la empresa quiere destacar (el perfil prioritario). */
    destacado?: string;
    /** Aclaración bajo la lista (p. ej. los perfiles que solo se ofrecen bajo requerimiento). */
    nota?: string;
}

/**
 * Las líneas de servicio, con los nombres y actividades del "Documento definitivo de ajustes para la página web".
 * El apoyo operativo para plantas y centros logísticos ya no es una línea aparte: sus actividades quedaron en
 * servicios logísticos y en suministro de personal operativo.
 */
export const SERVICIOS: LineaServicio[] = [
    {
        id: 'logisticos',
        nombre: 'Servicios logísticos',
        icono: ServicioLogistico,
        imagen: '/images/operacion/cargue-en-bodega.jpg',
        descripcion:
            'Soluciones logísticas mediante el suministro de personal especializado para apoyar todas las etapas de la cadena de abastecimiento, garantizando operaciones eficientes, seguras y organizadas.',
        tituloLista: 'Actividades',
        items: [
            'Cargue y descargue',
            'Recepción de mercancía',
            'Almacenamiento',
            'Organización de bodegas',
            'Control de inventarios',
            'Picking (preparación de pedidos)',
            'Packing (acondicionamiento de pedidos)',
            'Clasificación de mercancías',
            'Etiquetado',
            'Embalaje',
            'Paletización',
            'Estibado de mercancías',
            'Cross docking',
            'Despacho de mercancías',
            'Distribución de mercancías',
        ],
    },
    {
        id: 'personal',
        nombre: 'Suministro de personal operativo',
        icono: UsersRound,
        imagen: '/images/operacion/coordinacion-de-equipo.jpg',
        descripcion: 'Talento humano para necesidades operativas temporales, permanentes o por proyectos, adaptado a los procesos internos de cada cliente.',
        tituloLista: 'Perfiles',
        items: [
            'Auxiliares logísticos',
            'Auxiliares de bodega',
            'Auxiliares de cargue y descargue',
            'Auxiliares de distribución y entrega',
            'Auxiliares de inventario',
            'Auxiliares de empaque y acondicionamiento',
            'Auxiliares de producción',
            'Operarios de planta',
            'Operarios generales',
        ],
        destacado: 'Auxiliares logísticos',
        nota: 'Auxiliares de producción, operarios de planta y operarios generales: disponibles bajo requerimiento.',
    },
    {
        id: 'aseo-general',
        nombre: 'Aseo general',
        icono: SprayCan,
        imagen: '/images/servicios/aseo.jpg',
        descripcion:
            'Limpieza y desinfección para empresas, oficinas, edificios, instituciones educativas, conjuntos residenciales, establecimientos comerciales y demás instalaciones.',
        tituloLista: 'Incluye',
        items: [
            'Limpieza de oficinas',
            'Lavado de pisos',
            'Limpieza de baños',
            'Limpieza de vidrios',
            'Limpieza de zonas comunes',
            'Aseo de áreas de cafetería',
            'Recolección de residuos ordinarios',
            'Desinfección de superficies',
        ],
    },
    {
        id: 'aseo-industrial',
        nombre: 'Aseo industrial',
        icono: AseoIndustrial,
        imagen: '/images/servicios/aseo-industrial.jpg',
        descripcion: 'Procesos especializados de limpieza en ambientes industriales y logísticos bajo protocolos de seguridad.',
        tituloLista: 'Incluye',
        items: [
            'Limpieza de plantas de producción',
            'Limpieza de bodegas y centros logísticos',
            'Limpieza de patios industriales',
            'Limpieza de estanterías',
            'Limpieza de maquinaria y equipos',
            'Limpieza de muelles de carga',
            'Recolección y clasificación de residuos industriales no peligrosos',
        ],
    },
    {
        id: 'aseo-construccion',
        nombre: 'Limpieza de obra y posobra',
        icono: AseoConstruccion,
        imagen: '/images/servicios/aseo-construccion.jpg',
        descripcion: 'Labores de limpieza durante y después de obras civiles, remodelaciones y adecuaciones.',
        tituloLista: 'Incluye',
        items: [
            'Retiro de polvo y residuos finos',
            'Limpieza profunda de superficies',
            'Limpieza de vidrios',
            'Lavado de pisos',
            'Limpieza de baños',
            'Limpieza de enchapes',
            'Limpieza final para entrega de obra',
        ],
    },
    {
        id: 'zonas-verdes',
        nombre: 'Mantenimiento de zonas verdes y jardines',
        icono: Sprout,
        imagen: '/images/servicios/zonas-verdes.jpg',
        descripcion: 'Conservación de jardines y espacios verdes mediante labores de mantenimiento preventivo y correctivo.',
        tituloLista: 'Servicios',
        items: ['Corte de césped', 'Poda de plantas y arbustos', 'Fertilización', 'Deshierbe', 'Riego', 'Siembra y reposición de plantas', 'Recolección de residuos vegetales'],
    },
    {
        id: 'espacios-publicos',
        nombre: 'Limpieza y mantenimiento de espacios públicos',
        icono: TreePine,
        imagen: '/images/servicios/espacios-publicos.jpg',
        descripcion: 'Conservación y mantenimiento de parques, vías peatonales y espacios urbanos.',
        tituloLista: 'Actividades',
        items: [
            'Barrido manual de espacios públicos',
            'Limpieza de parques y áreas comunes',
            'Recolección de residuos ordinarios',
            'Limpieza de andenes',
            'Limpieza de plazoletas',
            'Limpieza de ciclorrutas',
            'Lavado de mobiliario urbano',
        ],
    },
];

/**
 * "¿Por qué elegirnos?" y "Nuestros diferenciales" del portafolio, unificados (en el documento
 * varios puntos se repiten). Seguridad (SG-SST, EPP) y cobertura tienen su propia sección.
 */
export const RAZONES: { icono: TipoIcono; titulo: string; texto: string }[] = [
    { icono: UserCheck, titulo: 'Personal seleccionado y capacitado', texto: 'Talento previamente seleccionado, con procesos de inducción y capacitación antes de iniciar.' },
    { icono: Telescope, titulo: 'Supervisión permanente', texto: 'Acompañamiento continuo de cada operación para asegurar calidad y cumplimiento.' },
    { icono: Zap, titulo: 'Respuesta inmediata', texto: 'Atención oportuna y reemplazos inmediatos cuando la operación lo requiere.' },
    { icono: CalendarRange, titulo: 'Flexibilidad operativa', texto: 'Servicios permanentes, temporales o por proyectos, con atención personalizada para cada cliente.' },
    { icono: Scale, titulo: 'Cumplimiento laboral', texto: 'Operamos con pleno cumplimiento de la legislación laboral vigente.' },
    { icono: Award, titulo: 'Experiencia en operaciones', texto: 'Trayectoria en operaciones industriales y logísticas.' },
];

export const SECTORES: { icono: TipoIcono; nombre: string }[] = [
    { icono: Factory, nombre: 'Industria' },
    { icono: Warehouse, nombre: 'Logística' },
    { icono: Truck, nombre: 'Transporte' },
    { icono: ShoppingBag, nombre: 'Retail' },
    { icono: HardHat, nombre: 'Construcción' },
    { icono: PackageOpen, nombre: 'Centros de distribución' },
    { icono: Cog, nombre: 'Manufactura' },
    { icono: UtensilsCrossed, nombre: 'Alimentos' },
    { icono: HeartPulse, nombre: 'Salud' },
    { icono: GraduationCap, nombre: 'Educación' },
    { icono: Landmark, nombre: 'Sector público' },
    { icono: Store, nombre: 'Centros comerciales' },
    { icono: ConjuntoResidencial, nombre: 'Conjuntos residenciales' },
];

/** Datos clave de la portada (todos del portafolio, sin cifras inventadas). */
export const DESTACADOS: { icono: TipoIcono; titulo: string; texto: string }[] = [
    { icono: Layers, titulo: `${SERVICIOS.length} líneas de servicio`, texto: 'Logística, personal, aseo y mantenimiento' },
    { icono: Sectores, titulo: '13 sectores', texto: 'Industria, logística, retail, salud y más' },
    { icono: Map, titulo: 'Cobertura nacional', texto: 'Personal disponible en todo el país' },
    { icono: ShieldCheck, titulo: 'SG-SST', texto: 'Seguridad y salud en el trabajo' },
];

export const COMPROMISOS: { icono: TipoIcono; texto: string }[] = [
    { icono: ListaChequeo, texto: 'Lineamientos del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST)' },
    { icono: Shirt, texto: 'Uso adecuado de los Elementos de Protección Personal (EPP)' },
    { icono: BadgeCheck, texto: 'Cumplimiento de la normatividad vigente en seguridad y salud' },
];
