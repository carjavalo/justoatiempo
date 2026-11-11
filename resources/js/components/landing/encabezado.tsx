import { ArrowRight, LogIn, Menu } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export const SECCIONES = [
    { id: 'nosotros', texto: 'Nosotros' },
    { id: 'servicios', texto: 'Servicios' },
    { id: 'por-que-elegirnos', texto: 'Por qué elegirnos' },
    { id: 'sectores', texto: 'Sectores' },
    { id: 'cobertura', texto: 'Cobertura' },
];

/** El botón de cotizar de la portada: mientras se ve, el encabezado no lo repite. */
export const ID_CTA_PORTADA = 'cta-portada';

/**
 * Sección visible ahora, para marcarla en la navegación. Contacto también se observa aunque no tenga enlace: al llegar
 * allí ninguna sección queda marcada (antes seguía marcada «Cobertura»).
 */
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
        [...SECCIONES.map((s) => s.id), 'contacto'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);
    return actual;
}

/** Si el botón de cotizar de la portada está en pantalla. */
function useCtaPortadaVisible() {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const el = document.getElementById(ID_CTA_PORTADA);
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return visible;
}

export function Encabezado() {
    const { auth } = usePage<SharedData>().props;
    const [desplazado, setDesplazado] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(false);
    const actual = useSeccionActual();
    const ctaPortadaVisible = useCtaPortadaVisible();

    useEffect(() => {
        const alDesplazar = () => setDesplazado(window.scrollY > 24);
        alDesplazar();
        window.addEventListener('scroll', alDesplazar, { passive: true });
        return () => window.removeEventListener('scroll', alDesplazar);
    }, []);

    // Con sesión, directo al inicio de quien entra (el panel o su línea de servicio)
    const acceso = auth.user ? { href: auth.user.inicio.url, texto: 'Ir a la plataforma' } : { href: route('login'), texto: 'Acceso colaboradores' };
    // Cotizar queda siempre a mano: en el encabezado y abajo en el celular, salvo mientras se ve el de la portada o el formulario
    const cotizarOculto = ctaPortadaVisible || actual === 'contacto';

    return (
        <>
            <header
                className={cn(
                    'fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-300',
                    desplazado ? 'bg-card/90 text-foreground shadow-[0_1px_0_var(--border)] backdrop-blur-md' : 'bg-transparent text-white',
                )}
            >
                <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <a
                        href="#inicio"
                        className="focus-visible:ring-ring flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:outline-hidden"
                    >
                        <LogoMarca className="size-14 rounded-2xl" />
                        <span className="leading-tight">
                            <span className="block text-[0.95rem] font-extrabold tracking-tight">Justo a Tiempo SP</span>
                            <span
                                className={cn(
                                    'block text-[0.72rem] font-semibold tracking-[0.14em] uppercase',
                                    desplazado ? 'text-muted-foreground' : 'text-white/75',
                                )}
                            >
                                S.A.S
                            </span>
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
                                            'focus-visible:ring-ring relative inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
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
                        {/* El acceso del personal: un enlace discreto; la acción de la página es cotizar */}
                        <Link
                            href={acceso.href}
                            className={cn(
                                'hidden min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline sm:inline-flex',
                                'focus-visible:outline-2 focus-visible:outline-offset-2',
                                desplazado ? 'text-muted-foreground hover:text-foreground focus-visible:outline-ring' : 'text-white/80 hover:text-white focus-visible:outline-white',
                            )}
                        >
                            <LogIn className="size-4" aria-hidden="true" />
                            {acceso.texto}
                        </Link>

                        {/* Ocupa su lugar aunque no se vea: el encabezado no salta al aparecer */}
                        <a
                            href="#contacto"
                            inert={cotizarOculto}
                            className={cn(
                                'bg-brand-coral text-brand-coral-foreground hidden min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm hover:bg-[#ee8574] lg:inline-flex active:scale-[0.96] motion-reduce:active:scale-100',
                                'focus-visible:outline-2 focus-visible:outline-offset-2',
                                desplazado ? 'focus-visible:outline-ring' : 'focus-visible:outline-white',
                                'motion-safe:transition-[opacity,translate,scale] motion-safe:duration-300 motion-safe:ease-out',
                                cotizarOculto && 'pointer-events-none translate-y-1 opacity-0',
                            )}
                        >
                            Solicitar cotización
                        </a>

                        {/* Menú en móvil y tableta */}
                        <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        'flex size-11 items-center justify-center rounded-lg ring-1 lg:hidden',
                                        'focus-visible:outline-2 focus-visible:outline-offset-2',
                                        desplazado ? 'ring-input focus-visible:outline-ring' : 'ring-white/30 focus-visible:outline-white',
                                    )}
                                >
                                    <Menu className="size-5" aria-hidden="true" />
                                    <span className="sr-only">Abrir menú</span>
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="right"
                                className="bg-brand-navy-deep w-80 border-none p-0 text-white [&>button]:top-4 [&>button]:right-4 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:text-white [&>button_svg]:size-5"
                            >
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
                                    <div className="mt-auto grid gap-2">
                                        <a
                                            href="#contacto"
                                            onClick={() => setMenuAbierto(false)}
                                            className="bg-brand-coral text-brand-coral-foreground flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-bold transition-[scale] active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                        >
                                            Solicitar cotización
                                            <ArrowRight className="size-4" aria-hidden="true" />
                                        </a>
                                        <Link
                                            href={acceso.href}
                                            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                                        >
                                            <LogIn className="size-4" aria-hidden="true" />
                                            {acceso.texto}
                                        </Link>
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </header>

            {/* En el celular, cotizar queda abajo, al alcance del pulgar */}
            <div
                inert={cotizarOculto || menuAbierto}
                className={cn(
                    'bg-card/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden',
                    'motion-safe:transition-[opacity,translate] motion-safe:duration-300 motion-safe:ease-out',
                    (cotizarOculto || menuAbierto) && 'pointer-events-none translate-y-full opacity-0',
                )}
            >
                <a
                    href="#contacto"
                    className="bg-brand-coral text-brand-coral-foreground flex h-12 items-center justify-center gap-2 rounded-xl font-bold transition-[background-color,scale] hover:bg-[#ee8574] active:scale-[0.96] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    Solicitar cotización
                    <ArrowRight className="size-4" aria-hidden="true" />
                </a>
            </div>
        </>
    );
}
