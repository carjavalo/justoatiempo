import { DESTACADOS, EMPRESA } from '@/lib/portafolio';
import { ArrowRight } from '@/components/iconos';
import { Revelar } from './piezas';

export function Portada() {
    return (
        <section id="inicio" aria-labelledby="titulo-portada" className="relative isolate">
            <div className="bg-brand-navy-deep relative isolate overflow-hidden text-white">
                {/* Textura de marca: trama de puntos y resplandor coral */}
                <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden="true" />
                <div className="bg-brand-coral/20 absolute -top-40 -right-40 -z-10 size-[36rem] rounded-full blur-3xl" aria-hidden="true" />

                <div className="mx-auto max-w-7xl px-4 pt-32 sm:px-6 lg:px-8 lg:pt-40">
                    <div className="mx-auto max-w-4xl text-center">
                        <Revelar>
                            <h1 id="titulo-portada" className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[4.25rem]">
                                Soluciones integrales en servicios <span className="text-brand-coral-on-dark">operativos, logísticos y de aseo.</span>
                            </h1>
                        </Revelar>
                        <Revelar retraso={160}>
                            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">{EMPRESA.lema}</p>
                        </Revelar>
                        <Revelar retraso={240} className="mt-9 flex justify-center">
                            <a
                                href="#contacto"
                                className="bg-brand-coral text-brand-navy-deep group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold shadow-lg shadow-black/25 transition hover:bg-[#ee8574] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                            >
                                Solicitar cotización
                                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </a>
                        </Revelar>
                    </div>
                </div>

                {/* El equipo completo, a su tamaño natural; arriba se funde con el azul */}
                <Revelar retraso={300} className="relative mx-auto mt-14 max-w-[96rem]">
                    <img
                        src="/images/marca/equipo.jpg"
                        alt="Equipo de Justo a Tiempo SP: operarios, personal logístico, aseo, jardinería y cargue"
                        className="h-56 w-full object-cover object-[50%_35%] sm:h-auto sm:object-contain [mask-image:linear-gradient(to_bottom,transparent,black_28%)]"
                    />
                </Revelar>
            </div>

            {/* Datos clave: montados sobre el borde inferior de la portada */}
            <div className="relative mx-auto -mt-10 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
                <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {DESTACADOS.map(({ icono: Icono, titulo, texto }, i) => (
                        <Revelar as="li" key={titulo} retraso={i * 70} className="bg-card flex items-start gap-3 rounded-2xl border p-5 shadow-[0_12px_32px_rgba(18,36,74,0.12)]">
                            <span className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                                <Icono className="size-5" aria-hidden="true" />
                            </span>
                            <span>
                                <span className="block font-extrabold">{titulo}</span>
                                <span className="text-muted-foreground block text-sm">{texto}</span>
                            </span>
                        </Revelar>
                    ))}
                </ul>
            </div>
        </section>
    );
}
