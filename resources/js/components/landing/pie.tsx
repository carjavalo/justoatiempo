import LogoMarca from '@/components/logo-marca';
import { EMPRESA } from '@/lib/portafolio';

export function Pie() {
    return (
        <footer className="bg-brand-navy-deep text-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
                <div className="flex items-center gap-3">
                    <LogoMarca className="size-16 rounded-2xl p-1.5" />
                    <div className="leading-tight">
                        <p className="font-extrabold">{EMPRESA.nombre}</p>
                        <p className="text-sm text-white/75">Soluciones operativas integrales</p>
                    </div>
                </div>
                <p className="text-sm text-white/75">
                    © {new Date().getFullYear()} {EMPRESA.nombre}. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    );
}
