import {
    Bandeja,
    Building2,
    CalendarRange,
    Inicio,
    Layers,
    MapPinned,
    PanelLeft,
    Settings,
    Store,
    type TipoIcono,
    Truck,
    UserCheck,
    UsersRound,
} from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { iconoLinea } from '@/lib/iconos-linea';
import { cn } from '@/lib/utils';
import { type GrupoMenu, type ItemMenu } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { useLayoutEffect, useRef } from 'react';

/** Ícono de cada módulo (las claves las pone App\Support\Menu). */
const ICONOS: Record<string, TipoIcono> = {
    inicio: Inicio,
    usuarios: UsersRound,
    asignaciones: CalendarRange,
    roles: UserCheck,
    empresas: Building2,
    sedes: Store,
    sucursales: MapPinned,
    solicitudes: Bandeja,
    servicios: Layers,
    vehiculos: Truck,
    parametros: Settings,
};

const marcada = (item: ItemMenu, ruta: string) => item.rutas.some((r) => ruta === r || ruta.startsWith(`${r}/`));

/** Hasta dónde se desplazó el menú: cada página lo vuelve a dibujar y debe quedar donde estaba. */
let desplazamiento = 0;

/**
 * Menú lateral de la plataforma: el inicio, las líneas de servicio que ve y los módulos de su rol, por grupos. Se
 * contrae a solo íconos (con el nombre al pasar el mouse o al enfocar) y en el celular se abre como panel.
 */
export function MenuLateral({ grupos }: { grupos: GrupoMenu[] }) {
    const { url } = usePage();
    const ruta = url.split('?')[0];
    const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
    const contraido = state === 'collapsed' && !isMobile;
    const lista = useRef<HTMLDivElement>(null);

    // Al llegar a otra página, el menú queda donde estaba y la opción marcada a la vista
    useLayoutEffect(() => {
        const contenedor = lista.current;
        if (!contenedor) return;
        contenedor.scrollTop = desplazamiento;
        contenedor.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [ruta]);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-2">
                <div className="flex items-center gap-3">
                    <LogoMarca className="size-10 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0.5" />
                    <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                        <p className="truncate text-[0.95rem] font-extrabold tracking-tight text-white">Justo a Tiempo SP</p>
                        <p className="text-sidebar-foreground truncate text-[0.68rem] font-semibold tracking-[0.14em] uppercase">
                            Plataforma de gestión
                        </p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent ref={lista} onScroll={(e) => (desplazamiento = e.currentTarget.scrollTop)} className="gap-0 py-2">
                <nav aria-label="Menú principal" className="flex flex-col gap-1">
                    {grupos.map((grupo, g) => (
                        <SidebarGroup key={grupo.titulo ?? g} className="px-3 py-1.5 group-data-[collapsible=icon]:px-2">
                            {grupo.titulo && (
                                <SidebarGroupLabel
                                    id={`grupo-menu-${g}`}
                                    // Contraído, el título se oculta: que no tape la parte baja del ícono anterior
                                    className="text-sidebar-foreground/80 text-[0.68rem] font-semibold tracking-[0.12em] uppercase group-data-[collapsible=icon]:pointer-events-none"
                                >
                                    {grupo.titulo}
                                </SidebarGroupLabel>
                            )}
                            <SidebarMenu className="gap-0.5" aria-labelledby={grupo.titulo ? `grupo-menu-${g}` : undefined}>
                                {grupo.items.map((item) => {
                                    const activo = marcada(item, ruta);
                                    const Icono = item.linea ? iconoLinea({ icono: item.icono, slug: item.linea }) : ICONOS[item.icono ?? ''];
                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={activo}
                                                tooltip={item.contador ? `${item.titulo} (${item.contador} sin atender)` : item.titulo}
                                                className={cn(
                                                    'text-sidebar-foreground relative h-auto min-h-9 rounded-lg py-2 font-medium transition-colors group-data-[collapsible=icon]:min-h-8 hover:text-white',
                                                    // Los nombres largos de las líneas ("Limpieza y mantenimiento de espacios públicos") en dos renglones, sin cortarse
                                                    '[&>span:last-child]:line-clamp-2! [&>span:last-child]:leading-snug [&>span:last-child]:whitespace-normal!',
                                                    'data-[active=true]:bg-white/10 data-[active=true]:font-semibold data-[active=true]:text-white',
                                                    // Barra coral de la opción activa: la señal no depende solo del color del texto
                                                    'data-[active=true]:before:bg-brand-coral data-[active=true]:before:absolute data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-full',
                                                )}
                                            >
                                                <Link
                                                    href={item.href}
                                                    prefetch
                                                    // "page" solo en la página misma; en sus páginas internas (p. ej. Cargas Drivin), la sección
                                                    aria-current={ruta === item.href ? 'page' : activo ? 'true' : undefined}
                                                    // En el celular el menú es un panel: se cierra al elegir
                                                    onClick={() => isMobile && setOpenMobile(false)}
                                                >
                                                    {Icono && (
                                                        <Icono className={cn('size-[1.15rem]!', activo && 'text-brand-coral')} aria-hidden="true" />
                                                    )}
                                                    <span className={cn(item.contador && 'pr-6')}>
                                                        {item.titulo}
                                                        {item.contador && <span className="sr-only">, {item.contador} sin atender</span>}
                                                    </span>
                                                </Link>
                                            </SidebarMenuButton>
                                            {item.contador && (
                                                <SidebarMenuBadge
                                                    // Azul sobre coral: contraste AA (el blanco sobre coral no alcanza)
                                                    className="bg-brand-coral text-brand-coral-foreground peer-hover/menu-button:text-brand-coral-foreground peer-data-[active=true]/menu-button:text-brand-coral-foreground top-2! rounded-full px-1.5 text-[0.7rem] font-bold"
                                                    aria-hidden="true"
                                                >
                                                    {item.contador}
                                                </SidebarMenuBadge>
                                            )}
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroup>
                    ))}
                </nav>
            </SidebarContent>

            {/* En el celular el panel se cierra con su botón o tocando fuera */}
            {!isMobile && (
                <SidebarFooter className="border-sidebar-border border-t px-3 py-3 group-data-[collapsible=icon]:px-2">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={toggleSidebar}
                                tooltip="Expandir el menú"
                                aria-expanded={!contraido}
                                aria-controls="menu-lateral"
                                aria-keyshortcuts="Control+B Meta+B"
                                className="text-sidebar-foreground h-9 rounded-lg hover:text-white"
                            >
                                <PanelLeft className="size-[1.15rem]!" aria-hidden="true" />
                                <span>{contraido ? 'Expandir el menú' : 'Contraer el menú'}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            )}
        </Sidebar>
    );
}
