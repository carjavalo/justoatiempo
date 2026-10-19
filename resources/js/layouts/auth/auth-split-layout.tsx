import { EnlaceVolver } from '@/components/enlace-volver';
import { Building2, ShieldCheck, UsersRound } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { useCodigoVigente } from '@/hooks/use-codigo-vigente';
import { type Volver } from '@/types';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    title?: string;
    description?: string;
    /** Regreso al paso anterior (al sitio web desde el ingreso, al ingreso desde la recuperación). */
    volver?: Volver;
}

const PUNTOS = [
    { icono: Building2, texto: 'Empresas, sedes y sucursales en un solo registro' },
    { icono: UsersRound, texto: 'Cada persona con su rol, su línea y su sucursal' },
    { icono: ShieldCheck, texto: 'Accesos que se activan y retiran al instante' },
];

/** La marca no es enlace: el único regreso es "Volver", escrito y con flecha. */
export default function AuthSplitLayout({ children, title, description, volver }: PropsWithChildren<AuthLayoutProps>) {
    // Una página de ingreso abierta desde hace horas no debe fallar al primer intento
    useCodigoVigente();

    return (
        <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* Panel de marca: complementario al formulario */}
            <aside
                aria-label="Sobre la plataforma"
                className="bg-brand-navy-deep relative isolate hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
            >
                <img
                    src="/images/operacion/equipo-en-bodega.jpg"
                    alt=""
                    className="absolute inset-x-0 top-0 -z-20 h-[62%] w-full object-cover object-[50%_30%] opacity-60"
                />
                <div className="from-brand-navy-deep via-brand-navy-deep/85 to-brand-navy/40 absolute inset-0 -z-10 bg-gradient-to-t from-40%" />
                {/* Velo superior: asegura el contraste del texto sobre las zonas claras de la foto */}
                <div className="from-brand-navy-deep/80 absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b to-transparent" aria-hidden="true" />

                <div className="flex w-fit items-center gap-3">
                    <LogoMarca className="size-16 rounded-2xl p-1.5" />
                    <span className="leading-tight">
                        <span className="block text-lg font-extrabold tracking-tight">Justo a Tiempo SP S.A.S</span>
                        <span className="block text-xs font-medium tracking-[0.16em] text-white/85 uppercase">Soluciones operativas integrales</span>
                    </span>
                </div>

                <div className="max-w-lg">
                    <p className="text-brand-coral-on-dark text-sm font-bold tracking-[0.16em] uppercase">Plataforma de gestión</p>
                    {/* Texto de marca, no encabezado: el h1 de la página es el del formulario */}
                    <p className="mt-3 text-4xl leading-[1.1] font-extrabold tracking-tight xl:text-5xl">
                        Toda la operación de Justo a Tiempo, en un solo lugar.
                    </p>
                    <ul role="list" className="mt-8 space-y-4">
                        {PUNTOS.map(({ icono: Icono, texto }) => (
                            <li key={texto} className="flex items-center gap-3 text-[0.95rem] text-white/90">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                    <Icono className="text-brand-coral-on-dark size-[1.1rem]" aria-hidden="true" />
                                </span>
                                {texto}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-xs text-white/75">© {new Date().getFullYear()} Justo a Tiempo SP S.A.S</p>
            </aside>

            {/* Formulario */}
            <main id="contenido" tabIndex={-1} className="flex flex-col items-center justify-center p-6 outline-none sm:p-10">
                <div className="w-full max-w-sm">
                    {volver && <EnlaceVolver {...volver} className="mb-8 -ml-0.5" />}
                    <div className="mb-10 flex w-fit items-center gap-3 lg:hidden">
                        <LogoMarca className="size-14 rounded-2xl" />
                        <span className="text-lg font-extrabold tracking-tight">Justo a Tiempo SP</span>
                    </div>
                    <div className="mb-8">
                        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
                        <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}
