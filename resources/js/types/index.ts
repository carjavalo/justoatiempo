export type Rol = 'admin' | 'coordinador' | 'auxiliar';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

/** Respuesta de paginate() de Laravel. */
export interface Paginado<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

export interface SharedData {
    name: string;
    auth: Auth;
    flash: { success?: string | null; error?: string | null };
    [key: string]: unknown;
}

export interface User {
    id: number;
    /** Nombre completo (lo arma el servidor con las partes). */
    name: string;
    nombres: string | null;
    primer_apellido: string | null;
    segundo_apellido: string | null;
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
