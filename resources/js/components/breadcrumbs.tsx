import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Link } from '@inertiajs/react';
import { Fragment } from 'react';

/** Ruta de navegación; siempre empieza en "Panel", el inicio de la plataforma. */
export function Breadcrumbs({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
    const migas = [{ title: 'Panel', href: route('panel') }, ...breadcrumbs];

    return (
        <Breadcrumb>
            <BreadcrumbList className="gap-1.5 text-[0.8rem] sm:gap-2">
                {migas.map((item, index) => {
                    const ultima = index === migas.length - 1 && migas.length > 1;
                    return (
                        <Fragment key={item.title}>
                            <BreadcrumbItem className={ultima ? 'sr-only' : undefined}>
                                {ultima ? (
                                    // El h1 ya lo muestra: visible solo para lectores de pantalla (conserva aria-current)
                                    <BreadcrumbPage className="sr-only">{item.title}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden">
                                        <Link href={item.href} prefetch>
                                            {item.title}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {index < migas.length - 2 && <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
