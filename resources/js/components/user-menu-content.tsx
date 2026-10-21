import { IdCard, LogOut, Settings } from '@/components/iconos';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';

interface UserMenuContentProps {
    user: User;
}

/**
 * Menú de la cuenta. Su botón ya muestra avatar y nombre desde sm (en móvil solo el avatar):
 * el encabezado completo aparece solo en móvil y, en pantallas mayores, basta con el correo.
 */
export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const { url } = usePage();
    // Lo que ya está en pantalla no se repite en el menú: en Mi cuenta, sus pestañas llevan a cada sección
    const opciones = [
        !url.startsWith('/mi-carnet') && { texto: 'Mi carnet', href: route('mi-carnet'), icono: IdCard },
        // Quien ve solo lo suyo no cambia sus datos (los lleva su carnet): su cuenta es su contraseña
        !url.startsWith('/settings') && {
            texto: user.editaPerfil ? 'Mi cuenta' : 'Cambiar contraseña',
            href: route(user.editaPerfil ? 'profile.edit' : 'password.edit'),
            icono: Settings,
        },
    ].filter((o) => o !== false);

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm sm:hidden">
                    <UserInfo user={user} showEmail={true} />
                </div>
                <p className="text-muted-foreground hidden truncate px-2 py-1.5 text-xs sm:block">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {opciones.length > 0 && (
                <>
                    <DropdownMenuGroup>
                        {opciones.map(({ texto, href, icono: Icono }) => (
                            <DropdownMenuItem key={href} asChild>
                                <Link className="block w-full" href={href} as="button" prefetch onClick={cleanup}>
                                    <Icono className="mr-2" aria-hidden="true" />
                                    {texto}
                                </Link>
                            </DropdownMenuItem>
                        ))}
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
