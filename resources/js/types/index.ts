import { LucideIcon } from 'lucide-react';

export type Rol = 'admin' | 'coordinador' | 'auxiliar';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    /** Roles que ven la opción; si se omite, todos. */
    roles?: Rol[];
    badge?: string;
}

export interface SharedData {
    name: string;
    auth: Auth;
    flash: { success?: string | null; error?: string | null };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    rol: Rol;
    rol_label: string;
    empleado_id: number | null;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
