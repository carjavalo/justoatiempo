import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    // Un solo nivel repetiría el título de la página: las migas solo aparecen cuando hay jerarquía
    const conMigas = breadcrumbs.length > 1;

    return (
        <header className="bg-card/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md md:rounded-t-xl md:px-6">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />
                {conMigas && (
                    <>
                        <div className="bg-border mx-1 h-5 w-px" />
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </>
                )}
            </div>
            <div className="ml-auto flex items-center gap-1">
                <AppearanceToggleDropdown />
            </div>
        </header>
    );
}
