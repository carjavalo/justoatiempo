import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppearance } from '@/hooks/use-appearance';
import { Monitor, Moon, Sun } from 'lucide-react';
import { HTMLAttributes } from 'react';

export default function AppearanceToggleDropdown({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const getCurrentIcon = () => {
        switch (appearance) {
            case 'dark':
                return <Moon className="h-[1.1rem] w-[1.1rem]" />;
            case 'light':
                return <Sun className="h-[1.1rem] w-[1.1rem]" />;
            default:
                return <Monitor className="h-[1.1rem] w-[1.1rem]" />;
        }
    };

    return (
        <div className={className} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg">
                        {getCurrentIcon()}
                        <span className="sr-only">Cambiar tema</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateAppearance('light')}>
                        <span className="flex items-center gap-2">
                            <Sun className="h-[1.1rem] w-[1.1rem]" />
                            Claro
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAppearance('dark')}>
                        <span className="flex items-center gap-2">
                            <Moon className="h-[1.1rem] w-[1.1rem]" />
                            Oscuro
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAppearance('system')}>
                        <span className="flex items-center gap-2">
                            <Monitor className="h-[1.1rem] w-[1.1rem]" />
                            Sistema
                        </span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
