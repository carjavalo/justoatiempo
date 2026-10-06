import AppLogoIcon from '@/components/app-logo-icon';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

/** Portada provisional: el sitio público del portafolio se construye en su propia fase. */
export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Soluciones integrales en servicios operativos, logísticos y de aseo" />
            <div className="bg-brand-navy-deep relative isolate flex min-h-svh flex-col overflow-hidden text-white">
                <img src="/images/marca/equipo.jpg" alt="" className="absolute inset-0 -z-20 size-full object-cover object-[50%_30%] opacity-45" />
                <div className="from-brand-navy-deep via-brand-navy-deep/80 absolute inset-0 -z-10 bg-gradient-to-t to-transparent" />

                <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-6">
                    <div className="flex items-center gap-3">
                        <AppLogoIcon className="size-10 text-white" />
                        <span className="text-lg font-extrabold tracking-tight">Justo a Tiempo SP</span>
                    </div>
                    <Link
                        href={auth.user ? route('dashboard') : route('login')}
                        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
                    >
                        {auth.user ? 'Ir al panel' : 'Acceso colaboradores'}
                    </Link>
                </header>

                <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end p-6 pb-20">
                    <p className="text-brand-coral text-sm font-bold tracking-[0.16em] uppercase">Justo a Tiempo SP S.A.S</p>
                    <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight md:text-6xl">
                        Soluciones integrales en servicios operativos, logísticos y de aseo.
                    </h1>
                    <p className="mt-5 max-w-xl text-lg text-white/80">Personal capacitado, compromiso y eficiencia al servicio de su operación.</p>
                    <Link
                        href={auth.user ? route('dashboard') : route('login')}
                        className="bg-brand-coral mt-8 inline-flex w-fit items-center gap-2 rounded-lg px-5 py-3 font-semibold shadow-lg transition hover:bg-[#d95f4e]"
                    >
                        {auth.user ? 'Ir al panel de operaciones' : 'Ingresar a la plataforma'}
                        <ArrowRight className="size-4" />
                    </Link>
                </main>
            </div>
        </>
    );
}
