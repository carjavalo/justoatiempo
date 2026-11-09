import { EnlaceVolver } from '@/components/enlace-volver';
import LogoMarca from '@/components/logo-marca';
import { useCodigoVigente } from '@/hooks/use-codigo-vigente';
import { EMPRESA } from '@/lib/portafolio';
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

/** El nombre completo junto al logo, en una línea, como en el pie de la página principal (el logo va sin texto alternativo: no se repite). */
function Marca({ tamano }: { tamano: 'franja' | 'panel' }) {
    return (
        <div className="flex w-fit items-center gap-3">
            <LogoMarca alt="" className={tamano === 'panel' ? 'size-16 rounded-2xl p-1.5' : 'size-11 rounded-xl'} />
            <span className={cn('leading-tight font-extrabold tracking-tight', tamano === 'panel' ? 'text-lg' : 'text-[0.95rem]')}>{EMPRESA.nombre}</span>
        </div>
    );
}

/** La marca no es enlace: el único regreso es "Volver", escrito y con flecha. */
export default function AuthSplitLayout({ children, title, description, volver }: PropsWithChildren<AuthLayoutProps>) {
    // Una página de ingreso abierta desde hace horas no debe fallar al primer intento
    useCodigoVigente();

    return (
        <div className="bg-background grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-1">
            {/* En el teléfono y la tableta, una franja compacta (grafito en modo oscuro) con el logo y el nombre: quien llega
                por un enlace sabe de inmediato dónde está */}
            <header className="bg-brand-navy-deep dark:bg-card dark:border-border flex items-center px-6 py-3 text-white sm:px-10 lg:hidden dark:border-b">
                <Marca tamano="franja" />
            </header>

            {/* Formulario. Desde 1024 px arranca a una altura que depende de la pantalla y no del contenido: a la vista queda
                centrado y, cuando aparece un aviso, lo de arriba no salta */}
            <main
                id="contenido"
                tabIndex={-1}
                className="flex flex-col items-center px-6 pt-7 pb-12 outline-none sm:px-10 sm:pt-12 lg:col-start-2 lg:row-start-1 lg:pt-[max(4rem,calc(50svh-14rem))]"
            >
                <div className="w-full max-w-sm">
                    {/* El regreso: arriba desde 1024 px; en el teléfono, al pie del formulario (nunca los dos a la vez) */}
                    {volver && <EnlaceVolver {...volver} className="mb-6 -ml-0.5 hidden lg:inline-flex" />}
                    <div className="mb-6 sm:mb-8">
                        <h1 className="text-2xl font-extrabold tracking-tight text-balance">{title}</h1>
                        {description && <p className="text-muted-foreground mt-1.5 text-sm text-pretty">{description}</p>}
                    </div>
                    {children}
                    {volver && <EnlaceVolver {...volver} className="mt-8 -ml-0.5 lg:hidden" />}
                </div>
            </main>

            {/* Panel de marca desde 1024 px, angosto: la foto del equipo, el nombre arriba y el lema abajo (el mismo del pie
                de la página principal), sin más texto que compita con la tarea. Va después del formulario en el código (a la
                izquierda solo en pantalla): quien usa lector de pantalla llega primero al título y a los campos */}
            <div className="bg-brand-navy-deep dark:bg-card relative isolate hidden flex-col justify-between gap-10 overflow-hidden p-10 text-white lg:col-start-1 lg:row-start-1 lg:flex xl:p-12">
                <picture className="absolute inset-0 -z-20">
                    <source media="(min-width: 64rem)" srcSet="/images/operacion/equipo-en-bodega.jpg" />
                    {/* El encuadre deja completas a las dos personas que miran de frente */}
                    <img src={SIN_FOTO} alt="" className="size-full object-cover object-[8%_45%]" />
                </picture>
                {/* Velos con el azul de la marca (grafito en modo oscuro): uno leve en toda la foto; arriba, uno más denso para
                    leer el nombre; abajo, el más largo, para el lema. El centro deja ver al equipo */}
                <div className="bg-brand-navy-deep/15 dark:bg-background/50 absolute inset-0 -z-10" aria-hidden="true" />
                <div
                    className="from-brand-navy-deep/85 dark:from-background/90 absolute inset-x-0 top-0 -z-10 h-44 bg-gradient-to-b to-transparent"
                    aria-hidden="true"
                />
                <div
                    className="from-brand-navy-deep via-brand-navy-deep/75 dark:from-background dark:via-background/75 absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t to-transparent"
                    aria-hidden="true"
                />
                <Marca tamano="panel" />
                <p className="max-w-[14ch] text-4xl leading-[1.05] font-extrabold tracking-tight text-balance 2xl:text-5xl">
                    Soluciones operativas integrales.
                </p>
            </div>
        </div>
    );
}
