import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { Monitor, Moon, Sun } from '@/components/iconos';
import { HTMLAttributes } from 'react';

const TEMAS: { valor: Appearance; texto: string; icono: typeof Sun }[] = [
    { valor: 'light', texto: 'Claro', icono: Sun },
    { valor: 'dark', texto: 'Oscuro', icono: Moon },
    { valor: 'system', texto: 'Según el sistema', icono: Monitor },
];

/** Selector de tema: opciones de radio para que se anuncie cuál está activa. */
export default function AppearanceToggleDropdown({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();
    const actual = TEMAS.find((t) => t.valor === appearance) ?? TEMAS[2];

    return (
        <div className={className} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg">
                        <actual.icono className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
                        <span className="sr-only">Tema: {actual.texto.toLowerCase()}. Cambiar tema</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuLabel className="text-muted-foreground text-xs font-semibold">Tema</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={appearance} onValueChange={(v) => updateAppearance(v as Appearance)}>
                        {TEMAS.map(({ valor, texto, icono: Icono }) => (
                            <DropdownMenuRadioItem key={valor} value={valor} className="gap-2">
                                <Icono className="size-4" aria-hidden="true" />
                                {texto}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
