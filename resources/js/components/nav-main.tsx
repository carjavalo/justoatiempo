import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type NavGroup } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ groups = [] }: { groups: NavGroup[] }) {
    const page = usePage();
    const actual = page.url.split('?')[0];

    return (
        <>
            {groups.map((grupo) => (
                <SidebarGroup key={grupo.title} className="px-3 py-1.5">
                    <SidebarGroupLabel className="text-sidebar-foreground/55 text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
                        {grupo.title}
                    </SidebarGroupLabel>
                    <SidebarMenu className="gap-0.5">
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
                                            'relative data-[active=true]:before:absolute data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:-left-3 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-brand-coral',
                                        )}
                                    >
                                        <Link href={item.url} prefetch>
                                            {item.icon && <item.icon className={cn('size-[1.1rem]', activo && 'text-brand-coral')} />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    );
}
