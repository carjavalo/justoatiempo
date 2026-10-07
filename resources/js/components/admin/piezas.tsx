import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, type TipoIcono } from '@/components/iconos';
import { type ReactNode } from 'react';

/** Contenedor común de las páginas de administración. */
export const contenedorModulo = 'mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-4 pt-3 md:p-6 md:pt-3 lg:p-8 lg:pt-4';

export function EncabezadoModulo({ titulo, descripcion, accion }: { titulo: string; descripcion: string; accion?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">{titulo}</h1>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{descripcion}</p>
            </div>
            {accion}
        </div>
    );
}

/** Estado con texto, no solo color. */
export function EstadoBadge({ activo, femenino = false }: { activo: boolean; femenino?: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                activo ? 'bg-good-soft text-good' : 'bg-muted text-muted-foreground',
            )}
        >
            <span className={cn('size-1.5 rounded-full', activo ? 'bg-good' : 'bg-muted-foreground/60')} aria-hidden="true" />
            {activo ? (femenino ? 'Activa' : 'Activo') : femenino ? 'Inactiva' : 'Inactivo'}
        </span>
    );
}

/** Tabla con desplazamiento horizontal accesible por teclado en pantallas angostas. */
export function Tabla({ titulo, children, minimo = 'min-w-[720px]' }: { titulo: string; children: ReactNode; minimo?: string }) {
    return (
        <div className="bg-card overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="focus-visible:ring-ring relative overflow-x-auto focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset" tabIndex={0} role="region" aria-label={`${titulo}, desplazable`}>
                <table className={cn('w-full text-left text-sm', minimo)}>
                    <caption className="sr-only">{titulo}</caption>
                    {children}
                </table>
            </div>
        </div>
    );
}

export const claseTh = 'px-3 py-3 text-[0.72rem] font-semibold tracking-wide uppercase first:pl-5 last:pr-5';
export const claseTd = 'px-3 py-3.5 align-middle first:pl-5 last:pr-5';

export function Paginacion<T>({ pagina, nombre }: { pagina: Paginado<T>; nombre: string }) {
    if (pagina.last_page <= 1) return null;

    return (
        <nav aria-label={`Paginación de ${nombre}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
                Página {pagina.current_page} de {pagina.last_page}
            </span>
            <div className="flex gap-1.5">
                <PaginaLink href={pagina.prev_page_url} etiqueta="Página anterior">
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </PaginaLink>
                <PaginaLink href={pagina.next_page_url} etiqueta="Página siguiente">
                    <ChevronRight className="size-4" aria-hidden="true" />
                </PaginaLink>
            </div>
        </nav>
    );
}

function PaginaLink({ href, etiqueta, children }: { href: string | null; etiqueta: string; children: ReactNode }) {
    const clase = 'flex size-9 items-center justify-center rounded-lg border';
    if (!href) {
        return (
            <span className={cn(clase, 'text-muted-foreground/40')} aria-hidden="true">
                {children}
            </span>
        );
    }
    return (
        <Link href={href} preserveScroll preserveState className={cn(clase, 'bg-card hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden')} aria-label={etiqueta}>
            {children}
        </Link>
    );
}

/** Primera vez, sin registros: explica para qué sirve el módulo y ofrece la única acción posible. */
export function EstadoVacio({ icono: Icono, titulo, texto, accion }: { icono: TipoIcono; titulo: string; texto: string; accion: ReactNode }) {
    return (
        <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
            <span className="bg-secondary text-primary flex size-16 items-center justify-center rounded-2xl">
                <Icono className="size-8" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-extrabold tracking-tight">{titulo}</h2>
            <p className="text-muted-foreground mt-1.5 max-w-md text-sm">{texto}</p>
            <div className="mt-6">{accion}</div>
        </div>
    );
}

export function SinResultados({ texto }: { texto: string }) {
    return <p className="bg-card text-muted-foreground rounded-2xl border px-6 py-10 text-center text-sm">{texto}</p>;
}

/** Conteo que lleva a la lista filtrada: un destino más específico que el del panel, no lo repite. */
export function ConteoEnlace({ n, uno, varios, ninguno, de, href }: { n: number; uno: string; varios: string; ninguno: string; de: string; href: string }) {
    if (n === 0) return <span className="text-muted-foreground text-xs">{ninguno}</span>;
    return (
        <Link href={href} className="text-primary focus-visible:ring-ring rounded-sm font-semibold whitespace-nowrap underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden">
            {n} {n === 1 ? uno : varios}
            <span className="sr-only"> de {de}</span>
        </Link>
    );
}

/** Ícono con iniciales para identificar filas de un vistazo (decorativo: el nombre va al lado). */
export function Iniciales({ texto, className }: { texto: string; className?: string }) {
    const iniciales = texto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();

    return (
        <span className={cn('bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold', className)} aria-hidden="true">
            {iniciales}
        </span>
    );
}
