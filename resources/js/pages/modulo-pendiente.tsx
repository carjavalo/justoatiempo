import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { navegacion } from '@/lib/navegacion';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Hammer } from 'lucide-react';

interface Props {
    clave: string;
    titulo: string;
    descripcion: string;
    requisitos: string[];
}

/** Vista temporal de los módulos que aún no se han construido. */
export default function ModuloPendiente({ clave, titulo, descripcion, requisitos }: Props) {
    const item = navegacion.flatMap((g) => g.items).find((i) => i.url === `/${clave}`);
    const Icono = item?.icon ?? Hammer;

    return (
        <AppLayout breadcrumbs={[{ title: titulo, href: `/${clave}` }]}>
            <Head title={titulo} />
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="bg-card relative isolate w-full max-w-xl overflow-hidden rounded-3xl border p-8 text-center shadow-sm md:p-12">
                    <AppLogoIcon className="text-muted pointer-events-none absolute -right-16 -bottom-16 -z-10 size-72" gearClassName="fill-muted" />
                    <span className="bg-secondary text-primary mx-auto flex size-16 items-center justify-center rounded-2xl">
                        <Icono className="size-8" />
                    </span>
                    <p className="text-brand-coral mt-6 text-xs font-bold tracking-[0.16em] uppercase">Módulo en construcción</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{titulo}</h1>
                    <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">{descripcion}</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {requisitos.map((r) => (
                            <span key={r} className="bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-semibold">
                                {r}
                            </span>
                        ))}
                    </div>
                    <Button asChild variant="outline" className="mt-8 rounded-lg">
                        <Link href="/dashboard">
                            <ArrowLeft className="size-4" />
                            Volver al panel
                        </Link>
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
