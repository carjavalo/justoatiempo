import AppLogoIcon from '@/components/app-logo-icon';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

/** Líneas de servicio del portafolio (GUIA PORTAFOLIO DE SERVICIOS JATSP). */
const SERVICIOS = [
    'Servicios logísticos',
    'Suministro de personal operativo',
    'Aseo general',
    'Aseo industrial',
    'Aseo de construcción y postobra',
    'Mantenimiento de zonas verdes',
    'Espacios públicos',
    'Apoyo a plantas y centros logísticos',
];

/** Portada provisional: el sitio público del portafolio se construye en su propia fase. */
export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Soluciones integrales en servicios operativos, logísticos y de aseo" />
            <div className="bg-brand-navy-deep relative isolate flex min-h-svh flex-col overflow-hidden text-white">
                <img src="/images/marca/equipo.jpg" alt="" className="absolute inset-0 -z-20 size-full object-cover object-[50%_30%] opacity-45" />
                <div className="from-brand-navy-deep via-brand-navy-deep/80 absolute inset-0 -z-10 bg-gradient-to-t to-transparent" />
                {/* Velo superior: la cabecera queda sobre zonas claras de la foto */}
                <div className="from-brand-navy-deep/85 absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b to-transparent" aria-hidden="true" />

                <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                        <AppLogoIcon className="size-10 text-white" />
                        <span className="text-lg font-extrabold tracking-tight">Justo a Tiempo SP</span>
                    </div>
                    {/* Único acceso a la plataforma interna */}
                    <Link
                        href={auth.user ? route('dashboard') : route('login')}
                        className="bg-brand-navy-deep/70 hover:bg-brand-navy-deep/85 rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                        {auth.user ? 'Ir al panel' : 'Acceso colaboradores'}
                    </Link>
                </header>

                <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end p-6 pb-16 outline-none md:pb-20">
                    <h1 className="max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight md:text-6xl">
                        Soluciones integrales en servicios operativos, logísticos y de aseo.
                    </h1>
                    <p className="mt-5 max-w-xl text-lg text-white/80">Personal capacitado, compromiso y eficiencia al servicio de su operación.</p>

                    <ul role="list" aria-label="Líneas de servicio" className="mt-10 flex max-w-4xl flex-wrap gap-2 border-t border-white/15 pt-6">
                        {SERVICIOS.map((servicio) => (
                            <li key={servicio} className="flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-sm font-medium text-white/85 ring-1 ring-white/10">
                                <span className="bg-brand-coral size-1.5 rounded-full" aria-hidden="true" />
                                {servicio}
                            </li>
                        ))}
                    </ul>
                </main>
            </div>
        </>
    );
}
