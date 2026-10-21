export type Rol = 'admin' | 'coordinador' | 'auxiliar';

export interface Auth {
    user: User;
    /** Lo que puede hacer ("usuarios.ver", "cargas.subir"…): los permisos de su rol que le aplican. */
    permisos: string[];
}

/** Destino del enlace "Volver" de una página: el nivel anterior. */
export interface Volver {
    texto: string;
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

/** Una opción del menú lateral (App\Support\Menu). */
export interface ItemMenu {
    titulo: string;
    href: string;
    /** Clave del ícono del módulo; en las líneas, la clave de su ícono de línea. */
    icono: string | null;
    /** Slug de la línea de servicio (las opciones de "Operación"). */
    linea: string | null;
    /** Direcciones en las que la opción queda marcada (y lo que cuelga de ellas). */
    rutas: string[];
    /** Pendientes por atender (p. ej. solicitudes). */
    contador: number | null;
}

export interface GrupoMenu {
    titulo: string | null;
    items: ItemMenu[];
}

export interface SharedData {
    name: string;
    auth: Auth;
    flash: { success?: string | null; error?: string | null };
    /** El menú lateral; null con una sola opción (quien trabaja en una sola línea navega con sus pestañas). */
    menu: GrupoMenu[] | null;
    /** Si el menú quedó abierto (o contraído a íconos) la última vez. */
    menuAbierto: boolean;
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
    /** Su rol dentro de la empresa ("Conductor"). */
    rol_label: string;
    /** Primera página de quien ingresa (el panel o su línea) y el texto del enlace para volver a ella. */
    inicio: { titulo: string; volver: string; url: string };
    /** Las líneas en las que trabaja hoy (por sus asignaciones vigentes). */
    lineas: { slug: string; nombre: string }[];
    /** Si tiene entregas de Drivin a su nombre: se le ofrece "Mis entregas". */
    entregas: boolean;
    /** Si cambia sus nombres y su correo en "Mi cuenta" (quien ve solo lo suyo, solo su contraseña). */
    editaPerfil: boolean;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
