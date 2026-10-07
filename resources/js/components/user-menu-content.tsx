import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { LogOut, Settings } from '@/components/iconos';

interface UserMenuContentProps {
    user: User;
}

/**
 * Menú de la cuenta. Su botón ya muestra avatar y nombre desde sm (en móvil solo el avatar):
 * el encabezado completo aparece solo en móvil y, en pantallas mayores, basta con el correo.
 */
export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const enMiCuenta = usePage().url.startsWith('/settings');

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm sm:hidden">
                    <UserInfo user={user} showEmail={true} />
                </div>
                <p className="text-muted-foreground hidden truncate px-2 py-1.5 text-xs sm:block">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* En Mi cuenta, sus pestañas ya llevan a cada sección */}
            {!enMiCuenta && (
                <>
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                            <Link className="block w-full" href={route('profile.edit')} as="button" prefetch onClick={cleanup}>
                                <Settings className="mr-2" aria-hidden="true" />
                                Mi cuenta
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                </>
            )}
            <DropdownMenuItem asChild>
                <Link className="block w-full" method="post" href={route('logout')} as="button" onClick={cleanup}>
                    <LogOut className="mr-2" aria-hidden="true" />
                    Cerrar sesión
                </Link>
            </DropdownMenuItem>
        </>
    );
}
