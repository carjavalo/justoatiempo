import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { KeyRound, UserRound } from '@/components/iconos';
import { type ReactNode } from 'react';

const SECCIONES = [
    { titulo: 'Perfil', url: '/settings/profile', icono: UserRound },
    { titulo: 'Contraseña', url: '/settings/password', icono: KeyRound },
];

/** "Mi cuenta": el título vive aquí; cada sección solo agrega su descripción. */
export default function SettingsLayout({ descripcion, children }: { descripcion: string; children: ReactNode }) {
    const actual = usePage().url.split('?')[0];
    const seccion = SECCIONES.find((s) => s.url === actual);

    return (
        <div className="mx-auto w-full max-w-3xl p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-[1.75rem]">Mi cuenta</h1>

            <nav aria-label="Secciones de mi cuenta" className="mt-6 flex gap-1 border-b">
                {SECCIONES.map(({ titulo, url, icono: Icono }) => {
                    const activa = actual === url;
                    return (
                        <Link
                            key={url}
                            href={url}
                            prefetch
                            aria-current={activa ? 'page' : undefined}
                            className={cn(
                                'focus-visible:ring-ring -mb-px flex items-center gap-2 rounded-t-md border-b-2 px-3 pb-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                                activa ? 'border-brand-coral-ink text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
                            )}
                        >
                            <Icono className={cn('size-4', activa && 'text-brand-coral-ink')} aria-hidden="true" />
                            {titulo}
                        </Link>
                    );
                })}
            </nav>

            <section aria-labelledby="titulo-seccion" className="bg-card mt-6 rounded-2xl border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-8">
                {/* El nombre de la sección ya se ve en la pestaña activa; aquí queda para quien navega por encabezados */}
                <h2 id="titulo-seccion" className="sr-only">
                    {seccion?.titulo}
                </h2>
                <p className="text-muted-foreground mb-6 text-sm">{descripcion}</p>
                {children}
            </section>
        </div>
    );
}
