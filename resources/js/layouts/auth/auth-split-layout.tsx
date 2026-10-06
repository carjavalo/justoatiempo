import AppLogoIcon from '@/components/app-logo-icon';
import { Link } from '@inertiajs/react';
import { BarChart3, ClipboardCheck, FileSpreadsheet } from 'lucide-react';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    title?: string;
    description?: string;
}

const PUNTOS = [
    { icono: FileSpreadsheet, texto: 'Preliquidación de Drivin consolidada en segundos' },
    { icono: BarChart3, texto: 'Efectividad por cliente, ruta y auxiliar en tiempo real' },
    { icono: ClipboardCheck, texto: 'Auditoría del protocolo de evidencias POD' },
];

/** Foco visible sobre el azul marino: contorno blanco (15:1). */
const focoSobreAzul = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

export default function AuthSplitLayout({ children, title, description }: PropsWithChildren<AuthLayoutProps>) {
    return (
        <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* Panel de marca: complementario al formulario */}
            <aside aria-label="Sobre la plataforma" className="bg-brand-navy-deep relative isolate hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
                <img src="/images/marca/equipo.jpg" alt="" className="absolute inset-x-0 top-0 -z-20 h-[62%] w-full object-cover object-[50%_30%] opacity-60" />
                <div className="from-brand-navy-deep via-brand-navy-deep/85 to-brand-navy/40 absolute inset-0 -z-10 bg-gradient-to-t from-40%" />
                {/* Velo superior: asegura el contraste del texto sobre las zonas claras de la foto */}
                <div className="from-brand-navy-deep/80 absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b to-transparent" aria-hidden="true" />

                <Link href={route('home')} className={`flex w-fit items-center gap-3 rounded-2xl ${focoSobreAzul}`}>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                        <AppLogoIcon className="size-9 text-white" />
                    </span>
                    <span className="leading-tight">
                        <span className="block text-lg font-extrabold tracking-tight">Justo a Tiempo SP S.A.S</span>
                        <span className="block text-xs font-medium tracking-[0.16em] text-white/85 uppercase">Soluciones operativas integrales</span>
                    </span>
                </Link>

                <div className="max-w-lg">
                    <p className="text-brand-coral-on-dark text-sm font-bold tracking-[0.16em] uppercase">Plataforma de operaciones</p>
                    {/* Texto de marca, no encabezado: el h1 de la página es el del formulario */}
                    <p className="mt-3 text-4xl leading-[1.1] font-extrabold tracking-tight xl:text-5xl">El informe diario de entregas, sin hojas de cálculo.</p>
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
                    <Link href={route('home')} className="focus-visible:ring-ring mb-10 flex w-fit items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:outline-hidden lg:hidden">
                        <span className="bg-brand-navy-deep flex size-11 items-center justify-center rounded-xl">
                            <AppLogoIcon className="size-8 text-white" />
                        </span>
                        <span className="text-lg font-extrabold tracking-tight">Justo a Tiempo SP</span>
                    </Link>
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
