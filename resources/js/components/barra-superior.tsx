import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import LogoMarca from '@/components/logo-marca';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { ChevronDown } from '@/components/iconos';

/**
 * Barra superior de la plataforma. La marca no es enlace: el único acceso al panel es la miga
 * "Panel" (así no hay dos controles que hagan lo mismo en la misma pantalla).
 */
export function BarraSuperior() {
    const { auth } = usePage<SharedData>().props;

    return (
        <header className="bg-card/85 sticky top-0 z-30 border-b backdrop-blur-md">
            <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                    <LogoMarca className="size-11 rounded-xl" />
                    <div className="min-w-0 leading-tight">
                        <p className="truncate text-[0.95rem] font-extrabold tracking-tight">Justo a Tiempo SP</p>
                        <p className="text-muted-foreground truncate text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Plataforma de gestión</p>
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
