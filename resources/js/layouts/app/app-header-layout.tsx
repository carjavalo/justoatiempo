import { AvisoFlash } from '@/components/aviso-flash';
import { BarraSuperior } from '@/components/barra-superior';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { type BreadcrumbItem } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Plantilla de la plataforma: barra superior y, fuera del panel, la ruta de navegación.
 * Sin menú lateral: el panel es el menú, así ninguna opción aparece repetida.
 */
export default function AppHeaderLayout({ children, breadcrumbs = [] }: { children: React.ReactNode; breadcrumbs?: BreadcrumbItem[] }) {
    const enPanel = usePage().component === 'panel';

    return (
        <div className="bg-background flex min-h-svh flex-col">
            {/* Primer elemento con Tab: evita recorrer la barra en cada página (WCAG 2.4.1) */}
            <a
                href="#contenido"
                className="bg-card text-foreground focus-visible:ring-ring sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2"
            >
                Saltar al contenido
            </a>
            <BarraSuperior />
            {!enPanel && (
                <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6 lg:px-8">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            )}
            {/* Destino del enlace de salto y del foco al cambiar de página */}
            <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
                {children}
            </main>
            <AvisoFlash />
        </div>
    );
}
