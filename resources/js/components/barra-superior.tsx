import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { ChevronDown, Menu } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { ANCHO_PLATAFORMA, cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Barra superior de la plataforma: la marca (si no está ya en el menú lateral), la apariencia y el menú de la
 * cuenta. Con menú lateral, en el celular lleva el botón que lo abre. La marca no es enlace: al inicio se llega por
 * el menú o por "Volver" (así no hay dos controles que hagan lo mismo en la misma pantalla).
 */
export function BarraSuperior({ conMenu = false }: { conMenu?: boolean }) {
    const { auth } = usePage<SharedData>().props;

    return (
        <header className="bg-card/85 sticky top-0 z-30 border-b backdrop-blur-md">
            <div
                className={cn(
                    'flex h-16 w-full items-center justify-between gap-4 px-4 md:px-6 lg:px-8',
                    !conMenu && cn('mx-auto', ANCHO_PLATAFORMA),
                )}
            >
                <div className="flex min-w-0 items-center gap-3">
                    {conMenu && <BotonMenu />}
                    {/* Con menú lateral, la marca está en él (en el celular el menú se oculta: aquí sí) */}
                    <div className={cn('flex min-w-0 items-center gap-3', conMenu && 'md:hidden')}>
                        <LogoMarca className={conMenu ? 'size-9 rounded-lg' : 'size-11 rounded-xl'} />
                        <div className="min-w-0 leading-tight">
                            <p className="truncate text-[0.95rem] font-extrabold tracking-tight">Justo a Tiempo SP</p>
                            <p
                                className={cn(
                                    'text-muted-foreground truncate text-[0.7rem] font-semibold tracking-[0.14em] uppercase',
                                    // Junto al botón del menú, en un celular angosto no cabe: solo el nombre
                                    conMenu && 'hidden min-[400px]:block',
                                )}
                            >
                                Plataforma de gestión
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <AppearanceToggleDropdown />
                    <DropdownMenu>
                        <DropdownMenuTrigger className="hover:bg-muted data-[state=open]:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-xl p-1.5 text-left outline-hidden focus-visible:ring-2 sm:pr-2.5">
                            <span className="flex items-center gap-2 [&>div]:hidden sm:[&>div]:grid">
                                <UserInfo user={auth.user} />
                            </span>
                            <ChevronDown className="text-muted-foreground hidden size-4 sm:block" aria-hidden="true" />
                            {/* En móvil solo se ve el avatar: el nombre queda para el lector de pantalla */}
                            <span className="sr-only sm:hidden">Menú de {auth.user.name}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-60 rounded-xl">
                            <UserMenuContent user={auth.user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

/** Abre el menú lateral en el celular (en pantallas grandes está siempre a la vista). */
function BotonMenu() {
    const { toggleSidebar, openMobile } = useSidebar();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-expanded={openMobile}
            aria-controls="menu-lateral"
            className="-ml-1 size-10 rounded-lg md:hidden"
        >
            <Menu className="size-5" aria-hidden="true" />
            <span className="sr-only">Abrir el menú</span>
        </Button>
    );
}
