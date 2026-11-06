import { EnlaceVolver } from '@/components/enlace-volver';
import LogoMarca from '@/components/logo-marca';
import { useCodigoVigente } from '@/hooks/use-codigo-vigente';
import { cn } from '@/lib/utils';
import { type Volver } from '@/types';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    title?: string;
    description?: string;
    /** Regreso al paso anterior (al sitio web desde el ingreso, al ingreso desde la recuperación). */
    volver?: Volver;
}

/** Un píxel transparente: por debajo de 1024 px (donde el panel no se ve) la foto ni se descarga. */
const SIN_FOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** El nombre junto al logo, como en el encabezado de la página principal (el logo va sin texto alternativo: no se repite). */
function Marca({ tamano }: { tamano: 'franja' | 'panel' }) {
    return (
        <div className="flex w-fit items-center gap-3">
            <LogoMarca alt="" className={tamano === 'panel' ? 'size-16 rounded-2xl p-1.5' : 'size-11 rounded-xl'} />
            <span className={cn('leading-tight', tamano === 'panel' ? 'text-lg' : 'text-[0.95rem]')}>
                <span className="block font-extrabold tracking-tight">Justo a Tiempo SP</span>
                <span className="block text-[0.72rem] font-semibold tracking-[0.14em] text-white/75 uppercase">S.A.S</span>
            </span>
        </div>
    );
}

/** La marca no es enlace: el único regreso es "Volver", escrito y con flecha. */
export default function AuthSplitLayout({ children, title, description, volver }: PropsWithChildren<AuthLayoutProps>) {
    // Una página de ingreso abierta desde hace horas no debe fallar al primer intento
    useCodigoVigente();

    return (
        <div className="bg-background grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-1">
            {/* En el teléfono y la tableta, la marca va en una franja compacta sobre el formulario (grafito en modo oscuro) */}
            <header className="bg-brand-navy-deep dark:bg-card dark:border-border flex items-center px-6 py-3 text-white sm:px-10 lg:hidden dark:border-b">
                <Marca tamano="franja" />
            </header>

            {/* Formulario. Arranca a una altura fija (no centrado): cuando aparece un aviso, lo de arriba no salta */}
            <main
                id="contenido"
                tabIndex={-1}
                className="flex flex-col items-center px-6 pt-8 pb-12 outline-none sm:px-10 sm:pt-14 lg:col-start-2 lg:row-start-1 lg:pt-[max(4rem,13vh)]"
            >
                <div className="w-full max-w-sm">
                    {volver && <EnlaceVolver {...volver} className="mb-8 -ml-0.5" />}
                    <div className="mb-8">
                        <h1 className="text-2xl font-extrabold tracking-tight text-balance">{title}</h1>
                        {description && <p className="text-muted-foreground mt-1.5 text-sm text-pretty">{description}</p>}
                    </div>
                    {children}
                </div>
            </main>

            {/* Panel de marca desde 1024 px, angosto: la foto del equipo y el nombre, sin más texto que compita con la
                tarea. Va después del formulario en el código (a la izquierda solo en pantalla): quien usa lector de
                pantalla llega primero al título y a los campos */}
            <div className="bg-brand-navy-deep dark:bg-card relative isolate hidden overflow-hidden p-10 text-white lg:col-start-1 lg:row-start-1 lg:block xl:p-12">
                <picture className="absolute inset-0 -z-20">
                    <source media="(min-width: 64rem)" srcSet="/images/operacion/equipo-en-bodega.jpg" />
                    <img src={SIN_FOTO} alt="" className="size-full object-cover object-[62%_45%]" />
                </picture>
                {/* Un velo leve con el azul de la marca (grafito en modo oscuro) y, arriba, uno más denso para leer el nombre */}
                <div className="bg-brand-navy-deep/25 dark:bg-background/45 absolute inset-0 -z-10" aria-hidden="true" />
                <div
                    className="from-brand-navy-deep/85 dark:from-background/90 absolute inset-x-0 top-0 -z-10 h-44 bg-gradient-to-b to-transparent"
                    aria-hidden="true"
                />
                <Marca tamano="panel" />
            </div>
        </div>
    );
}
