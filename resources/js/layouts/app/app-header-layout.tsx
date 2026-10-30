import { AvisoFlash } from '@/components/aviso-flash';
import { BarraSuperior } from '@/components/barra-superior';
import { EnlaceVolver } from '@/components/enlace-volver';
import { MenuLateral } from '@/components/menu-lateral';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type GrupoMenu, type SharedData, type Volver } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Si el menú quedó abierto: lo dice la cookie del navegador (vale también al volver con «Atrás» o al abrir un enlace
 * precargado, cuando la página llega con el dato de antes); el del servidor solo si no se puede leer.
 */
function menuAbiertoEnElNavegador(delServidor: boolean): boolean {
    const cookie = typeof document === 'undefined' ? null : document.cookie.match(/(?:^|;\s*)menu_lateral=(true|false)/);
    return cookie ? cookie[1] === 'true' : delServidor;
}

/** Si la dirección es la de una opción del menú (entonces "Volver" sería un segundo enlace al mismo lugar). */
function estaEnElMenu(menu: GrupoMenu[], href: string): boolean {
    const ruta = new URL(href, window.location.origin).pathname;
    return menu.some((g) => g.items.some((i) => i.href === ruta));
}

/**
 * Plantilla de la plataforma: el menú lateral (si quien navega tiene más de una opción), la barra superior y el
 * contenido. Con menú, "Volver" solo aparece cuando lleva a un lugar que el menú no tiene (la sección de una página
 * interna, como la revisión de una carga). Sin menú (quien trabaja en una sola línea), "Volver" lleva a su inicio.
 */
export default function AppHeaderLayout({ children, volver }: { children: React.ReactNode; volver?: Volver | false }) {
    const pagina = usePage<SharedData>();
    const { menu, menuAbierto } = pagina.props;
    const { inicio } = pagina.props.auth.user;
    const ruta = pagina.url.split('?')[0];

    const pedido = volver === false ? null : (volver ?? (menu || ruta === inicio.url ? null : { texto: inicio.volver, href: inicio.url }));
    const destino = pedido && menu && estaEnElMenu(menu, pedido.href) ? null : pedido;

    const saltar = (
        // Primer elemento con Tab: evita recorrer el menú y la barra en cada página (WCAG 2.4.1)
        <a
            href="#contenido"
            className="bg-card text-foreground focus-visible:ring-ring sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2 focus-visible:outline-hidden"
        >
            Saltar al contenido
        </a>
    );

    const contenido = (
        // Destino del enlace de salto y del foco al cambiar de página: lo primero que se alcanza es "Volver" (si lo hay).
        // Sin "Volver", el mismo espacio arriba: todas las páginas empiezan a la misma altura
        <main id="contenido" tabIndex={-1} className={cn('flex min-w-0 flex-1 flex-col outline-none', !destino && 'pt-3 md:pt-5 lg:pt-6')}>
            {destino && (
                <div className={cn('mx-auto w-full px-4 pt-4 md:px-6 lg:px-8', ANCHO_PLATAFORMA)}>
                    <EnlaceVolver {...destino} />
                </div>
            )}
            {children}
        </main>
    );

    if (!menu) {
        return (
            <div className="bg-background flex min-h-svh flex-col">
                {saltar}
                <BarraSuperior />
                {contenido}
                <AvisoFlash />
            </div>
        );
    }

    return (
        <SidebarProvider defaultOpen={menuAbiertoEnElNavegador(menuAbierto)}>
            {saltar}
            <MenuLateral grupos={menu} />
            <SidebarInset className="min-w-0">
                <BarraSuperior conMenu />
                {contenido}
            </SidebarInset>
            <AvisoFlash />
        </SidebarProvider>
    );
}
