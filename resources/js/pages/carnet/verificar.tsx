import { EnlaceVolver } from '@/components/enlace-volver';
import { CheckCircle2, XCircle } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';

interface Props {
    nombre: string;
    cargo: string;
    vigente: boolean;
}

/**
 * Lo que se ve al escanear el QR de un carnet (página pública, en "usted"): si la persona hace parte del equipo
 * de Justo a Tiempo SP y si su carnet sigue vigente.
 */
export default function VerificarCarnet({ nombre, cargo, vigente }: Props) {
    const Icono = vigente ? CheckCircle2 : XCircle;

    return (
        <>
            <Head title="Verificación de carnet">
                <meta name="robots" content="noindex" />
            </Head>

            <main id="contenido" className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
                <div className="bg-card w-full max-w-sm rounded-3xl border p-8 text-center shadow-[var(--sombra-elevada)]">
                    <LogoMarca grande alt="Justo a Tiempo SP S.A.S" className="mx-auto w-36 rounded-2xl p-2.5" />
                    <p className="text-brand-coral-ink mt-6 text-xs font-bold tracking-[0.16em] uppercase">Verificación de carnet</p>
                    <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-tight text-balance">{nombre}</h1>
                    <p className="text-muted-foreground mt-1">{cargo}</p>

                    <p
                        className={cn(
                            'mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold',
                            vigente ? 'bg-good-soft text-good' : 'bg-critical-soft text-critical',
                        )}
                    >
                        <Icono className="size-4" aria-hidden="true" />
                        {vigente ? 'Carnet vigente' : 'Carnet no vigente'}
                    </p>
                    <p className="text-muted-foreground mt-4 text-sm">
                        {vigente
                            ? 'Esta persona hace parte del equipo de Justo a Tiempo SP S.A.S.'
                            : 'Este carnet ya no está vigente. Si tiene dudas, comuníquese con Justo a Tiempo SP S.A.S.'}
                    </p>
                </div>

                <EnlaceVolver texto="Ir al sitio web de Justo a Tiempo SP" href="/" />
            </main>
        </>
    );
}
