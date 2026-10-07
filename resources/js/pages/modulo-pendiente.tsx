import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { Hammer } from '@/components/iconos';

interface Props {
    clave: string;
    titulo: string;
    descripcion: string;
    requisitos: string[];
}

/** Vista temporal de los módulos de la operación que aún no se han construido. */
export default function ModuloPendiente({ titulo, descripcion, requisitos }: Props) {
    const Icono = Hammer;

    return (
        <AppLayout>
            <Head title={titulo} />
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="bg-card relative isolate w-full max-w-xl overflow-hidden rounded-3xl border p-8 text-center shadow-sm md:p-12">
                    <span className="bg-secondary text-primary mx-auto flex size-16 items-center justify-center rounded-2xl">
                        <Icono className="size-8" aria-hidden="true" />
                    </span>
                    <p className="text-brand-coral-ink mt-6 text-xs font-bold tracking-[0.16em] uppercase">Módulo en construcción</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{titulo}</h1>
                    <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">{descripcion}</p>
                    <ul role="list" aria-label="Requisitos que cubre" className="mt-5 flex flex-wrap justify-center gap-2">
                        {requisitos.map((r) => (
                            <li key={r} className="bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-semibold">
                                {r}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AppLayout>
    );
}
