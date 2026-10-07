import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { type User } from '@/types';

export function UserInfo({ user, showEmail = false }: { user: User; showEmail?: boolean }) {
    const getInitials = useInitials();

    return (
        <>
            {/* Decorativo: el nombre ya está escrito al lado */}
            <Avatar className="h-8 w-8 overflow-hidden rounded-lg" aria-hidden="true">
                <AvatarImage src={user.avatar} alt="" />
                {/* Azul sobre coral: 5:1 (el blanco no llega a 4.5:1) */}
                <AvatarFallback className="bg-brand-coral text-brand-coral-foreground rounded-lg text-xs font-bold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs opacity-80">{showEmail ? user.email : user.rol_label}</span>
            </div>
        </>
    );
}
