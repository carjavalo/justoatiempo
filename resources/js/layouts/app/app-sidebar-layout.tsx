import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { AvisoFlash } from '@/components/aviso-flash';
import { type BreadcrumbItem } from '@/types';

export default function AppSidebarLayout({ children, breadcrumbs = [] }: { children: React.ReactNode; breadcrumbs?: BreadcrumbItem[] }) {
    return (
        <AppShell variant="sidebar">
            {/* Primer elemento con Tab: evita recorrer todo el menú en cada página (WCAG 2.4.1) */}
            <a
                href="#contenido"
                className="bg-card text-foreground focus-visible:ring-ring sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2"
            >
                Saltar al contenido
            </a>
            <AppSidebar />
            <AppContent variant="sidebar">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {/* Destino del enlace de salto y del foco al cambiar de página */}
                <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
                    {children}
                </main>
            </AppContent>
            <AvisoFlash />
        </AppShell>
    );
}
