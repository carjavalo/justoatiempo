import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { type User } from '@/types';

export function UserInfo({ user, showEmail = false }: { user: User; showEmail?: boolean }) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="h-8 w-8 overflow-hidden rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-brand-coral rounded-lg text-xs font-bold text-white">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs opacity-70">{showEmail ? user.email : user.rol_label}</span>
            </div>
        </>
    );
}
