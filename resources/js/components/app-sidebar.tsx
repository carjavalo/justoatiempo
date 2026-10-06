import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { navegacionPara } from '@/lib/navegacion';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            {/* La marca no es enlace: "Panel", justo debajo, es el único acceso al inicio */}
            <SidebarHeader className="pt-3 pb-2">
                <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:px-0">
                    <AppLogo />
                </div>
            </SidebarHeader>

            <SidebarContent className="gap-1 pt-2">
                <NavMain groups={navegacionPara(auth.user.rol)} />
            </SidebarContent>

            <SidebarFooter className="pb-3">
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
