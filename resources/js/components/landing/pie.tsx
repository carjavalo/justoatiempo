import LogoMarca from '@/components/logo-marca';
import { EMPRESA } from '@/lib/portafolio';
import { canalesDeContacto, MarcaPrueba, useDatosEmpresa } from './datos-empresa';

/** Pie: la empresa con su NIT, cómo contactarla y su política de datos (solo lo que esté definido). */
export function Pie() {
    const empresa = useDatosEmpresa();
    const canales = canalesDeContacto(empresa);

    return (
        <footer data-fondo-oscuro className="bg-brand-navy-deep text-white">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-8">
                <div className="flex items-start gap-3">
                    <LogoMarca className="size-16 shrink-0 rounded-2xl p-1.5" />
                    <div className="leading-tight">
                        <p className="font-extrabold">{EMPRESA.nombre}</p>
                        <p className="text-sm text-white/75">Soluciones operativas integrales</p>
                        {empresa.nit && <p className="mt-2 text-sm text-white/75">NIT {empresa.nit}</p>}
                    </div>
                </div>

                {canales.length > 0 && (
                    <div>
                        <h2 className="flex flex-wrap items-center gap-3 text-sm font-bold">
                            Contacto
                            {empresa.datosDePrueba && <MarcaPrueba className="bg-white/10 text-[#f6c47a]" />}
                        </h2>
                        <ul role="list" className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                            {canales.map(({ icono: Icono, etiqueta, valor, href, externo }) => (
                                <li key={etiqueta} className="flex min-w-0 items-center gap-2.5">
                                    <Icono className="text-brand-coral-on-dark size-4" aria-hidden="true" />
                                    {href ? (
                                        <a
                                            href={href}
                                            {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                            className="min-w-0 break-words text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                        >
                                            <span className="sr-only">{etiqueta}: </span>
                                            {valor}
                                            {externo && <span className="sr-only"> (se abre en WhatsApp)</span>}
                                        </a>
                                    ) : (
                                        <span className="min-w-0 break-words text-white/85">
                                            <span className="sr-only">{etiqueta}: </span>
                                            {valor}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="border-t border-white/10">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <p>
                        © {new Date().getFullYear()} {EMPRESA.nombre}. Todos los derechos reservados.
                    </p>
                    {empresa.politicaDatos && (
                        <a
                            href={empresa.politicaDatos}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            Política de tratamiento de datos<span className="sr-only"> (se abre en otra pestaña)</span>
                        </a>
                    )}
                </div>
            </div>
        </footer>
    );
}
