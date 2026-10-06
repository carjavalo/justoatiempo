import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type NavGroup } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const page = usePage();
    const actual = page.url.split('?')[0];

    return (
        <nav aria-label="Menú principal" className="flex flex-col gap-1">
            {groups.map((grupo, g) => (
                <SidebarGroup key={grupo.title} className="px-3 py-1.5">
                    <SidebarGroupLabel id={`grupo-menu-${g}`} className="text-sidebar-foreground/80 text-[0.72rem] font-semibold tracking-[0.12em] uppercase">
                        {grupo.title}
                    </SidebarGroupLabel>
                    <SidebarMenu className="gap-0.5" aria-labelledby={`grupo-menu-${g}`}>
                        {grupo.items.map((item) => {
                            const activo = actual === item.url || actual.startsWith(item.url + '/');

                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activo}
                                        tooltip={{ children: item.title }}
                                        className={cn(
                                            'h-9 rounded-lg font-medium transition-colors',
                                            'text-sidebar-foreground hover:text-white',
                                            'data-[active=true]:bg-white/10 data-[active=true]:font-semibold data-[active=true]:text-white',
                                            // Barra coral de la opción activa: señal que no depende solo del color del texto
                                            'relative data-[active=true]:before:absolute data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-brand-coral',
                                        )}
                                    >
                                        <Link href={item.url} prefetch aria-current={activo ? 'page' : undefined}>
                                            {item.icon && <item.icon className={cn('size-[1.1rem]', activo && 'text-brand-coral')} aria-hidden="true" />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </nav>
    );
}
