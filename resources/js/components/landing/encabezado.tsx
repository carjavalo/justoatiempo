import LogoMarca from '@/components/logo-marca';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { LogIn, Menu } from '@/components/iconos';
import { useEffect, useState } from 'react';

export const SECCIONES = [
    { id: 'nosotros', texto: 'Nosotros' },
    { id: 'servicios', texto: 'Servicios' },
    { id: 'por-que-elegirnos', texto: 'Por qué elegirnos' },
    { id: 'sectores', texto: 'Sectores' },
    { id: 'cobertura', texto: 'Cobertura' },
];

/** Sección visible ahora, para marcarla en la navegación. */
function useSeccionActual() {
    const [actual, setActual] = useState<string | null>(null);
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const obs = new IntersectionObserver(
            (entradas) => {
                const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visible) setActual(visible.target.id);
            },
            { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
        );
        SECCIONES.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);
    return actual;
}

export function Encabezado() {
    const { auth } = usePage<SharedData>().props;
    const [desplazado, setDesplazado] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(false);
    const actual = useSeccionActual();

    useEffect(() => {
        const alDesplazar = () => setDesplazado(window.scrollY > 24);
        alDesplazar();
        window.addEventListener('scroll', alDesplazar, { passive: true });
        return () => window.removeEventListener('scroll', alDesplazar);
    }, []);

    const acceso = auth.user ? { href: route('panel'), texto: 'Ir al panel' } : { href: route('login'), texto: 'Acceso colaboradores' };

    return (
        <header
            className={cn(
                'fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300',
                desplazado ? 'bg-card/90 text-foreground shadow-[0_1px_0_var(--border)] backdrop-blur-md' : 'bg-transparent text-white',
            )}
        >
            <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <a href="#inicio" className="focus-visible:ring-ring flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:outline-hidden">
                    <LogoMarca className="size-14 rounded-2xl" />
                    <span className="leading-tight">
                        <span className="block text-[0.95rem] font-extrabold tracking-tight">Justo a Tiempo SP</span>
                        <span className={cn('block text-[0.68rem] font-semibold tracking-[0.14em] uppercase', desplazado ? 'text-muted-foreground' : 'text-white/75')}>S.A.S</span>
                    </span>
                </a>

                <nav aria-label="Secciones de la página" className="hidden lg:block">
                    <ul role="list" className="flex items-center gap-1">
                        {SECCIONES.map((s) => (
                            <li key={s.id}>
                                <a
                                    href={`#${s.id}`}
                                    aria-current={actual === s.id ? 'true' : undefined}
                                    className={cn(
                                        'focus-visible:ring-ring relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                                        desplazado ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white',
                                        actual === s.id && (desplazado ? 'text-foreground' : 'text-white'),
                                        // Subrayado coral de la sección actual
                                        'after:bg-brand-coral after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:transition-opacity',
                                        actual === s.id ? 'after:opacity-100' : 'after:opacity-0',
                                    )}
                                >
                                    {s.texto}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="flex items-center gap-2">
                    <Link
                        href={acceso.href}
                        className={cn(
                            'hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ring-1 transition-colors sm:inline-flex',
                            'focus-visible:outline-2 focus-visible:outline-offset-2',
                            desplazado
                                ? 'ring-input hover:bg-muted focus-visible:outline-ring'
                                : 'bg-brand-navy-deep/60 hover:bg-brand-navy-deep/80 ring-white/30 backdrop-blur focus-visible:outline-white',
                        )}
                    >
                        <LogIn className="size-4" aria-hidden="true" />
                        {acceso.texto}
                    </Link>

                    {/* Menú en móvil y tableta */}
                    <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'flex size-10 items-center justify-center rounded-lg ring-1 lg:hidden',
                                    'focus-visible:outline-2 focus-visible:outline-offset-2',
                                    desplazado ? 'ring-input focus-visible:outline-ring' : 'ring-white/30 focus-visible:outline-white',
                                )}
                            >
                                <Menu className="size-5" aria-hidden="true" />
                                <span className="sr-only">Abrir menú</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="right" className="bg-brand-navy-deep w-80 border-none p-0 text-white [&>button]:text-white">
                            <SheetTitle className="sr-only">Menú</SheetTitle>
                            <nav aria-label="Secciones de la página" className="flex h-full flex-col p-6 pt-16">
                                <ul role="list" className="flex flex-col gap-1">
                                    {SECCIONES.map((s) => (
                                        <li key={s.id}>
                                            <a
                                                href={`#${s.id}`}
                                                onClick={() => setMenuAbierto(false)}
                                                aria-current={actual === s.id ? 'true' : undefined}
                                                className="block rounded-xl px-4 py-3 text-lg font-semibold text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white aria-[current=true]:bg-white/10 aria-[current=true]:text-white"
                                            >
                                                {s.texto}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={acceso.href}
                                    className="bg-brand-coral text-brand-navy-deep mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                >
                                    <LogIn className="size-4" aria-hidden="true" />
                                    {acceso.texto}
                                </Link>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
