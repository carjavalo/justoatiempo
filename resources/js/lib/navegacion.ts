import { type NavGroup, type Rol } from '@/types';
import {
    Building2,
    CalendarClock,
    ClipboardCheck,
    FileSpreadsheet,
    Gauge,
    MessagesSquare,
    PackageCheck,
    SlidersHorizontal,
    Truck,
    UploadCloud,
    UserCog,
    Users,
} from 'lucide-react';

/** Menú del CRM agrupado por módulo del SRS. Cada opción declara qué roles la ven. */
export const navegacion: NavGroup[] = [
    {
        title: 'Operación',
        items: [
            { title: 'Panel', url: '/dashboard', icon: Gauge },
            { title: 'Mis entregas', url: '/mis-entregas', icon: PackageCheck, roles: ['auxiliar'] },
            { title: 'Informe diario', url: '/informes', icon: FileSpreadsheet, roles: ['admin', 'coordinador'] },
            { title: 'Cargas Drivin', url: '/cargas', icon: UploadCloud, roles: ['admin', 'coordinador'] },
            { title: 'Auditoría POD', url: '/auditoria', icon: ClipboardCheck, roles: ['admin', 'coordinador'] },
            { title: 'Seguimiento', url: '/seguimiento', icon: MessagesSquare, roles: ['admin', 'coordinador'] },
        ],
    },
    {
        title: 'Planeación',
        items: [{ title: 'Programación diaria', url: '/programacion', icon: CalendarClock, roles: ['admin', 'coordinador'] }],
    },
    {
        title: 'Datos maestros',
        items: [
            { title: 'Empleados', url: '/empleados', icon: Users, roles: ['admin'] },
            { title: 'Clientes y sedes', url: '/clientes', icon: Building2, roles: ['admin'] },
            { title: 'Flota', url: '/vehiculos', icon: Truck, roles: ['admin'] },
        ],
    },
    {
        title: 'Administración',
        items: [
            { title: 'Usuarios y roles', url: '/usuarios', icon: UserCog, roles: ['admin'] },
            { title: 'Parámetros', url: '/parametros', icon: SlidersHorizontal, roles: ['admin'] },
        ],
    },
];

export function navegacionPara(rol: Rol): NavGroup[] {
    return navegacion
        .map((grupo) => ({ ...grupo, items: grupo.items.filter((item) => !item.roles || item.roles.includes(rol)) }))
        .filter((grupo) => grupo.items.length > 0);
}
