import { AvisoFlash } from '@/components/aviso-flash';
import { BarraSuperior } from '@/components/barra-superior';
import { EnlaceVolver } from '@/components/enlace-volver';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData, type Volver } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Plantilla de la plataforma: barra superior y, fuera del inicio, el enlace para volver al nivel
 * anterior. Sin menú lateral: el panel es el menú, así ninguna opción aparece repetida.
 */
export default function AppHeaderLayout({ children, volver }: { children: React.ReactNode; volver?: Volver | false }) {
    const pagina = usePage<SharedData>();
    const { inicio } = pagina.props.auth.user;
    const ruta = pagina.url.split('?')[0];

    // Sin destino explícito se vuelve al inicio de quien navega, salvo si ya está en él
    const destino = volver === false ? null : (volver ?? (ruta === inicio.url ? null : { texto: inicio.volver, href: inicio.url }));

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
            {/* Destino del enlace de salto y del foco al cambiar de página: lo primero que se alcanza es "Volver" */}
            <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
                {destino && (
                    <div className={cn('mx-auto w-full px-4 pt-4 md:px-6 lg:px-8', ANCHO_PLATAFORMA)}>
                        <EnlaceVolver {...destino} />
                    </div>
                )}
                {children}
            </main>
            <AvisoFlash />
        </div>
    );
}
