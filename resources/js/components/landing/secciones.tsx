import { COMPROMISOS, EMPRESA, RAZONES, SECTORES } from '@/lib/portafolio';
import { MapPin, ShieldCheck } from '@/components/iconos';
import { EncabezadoSeccion, Revelar } from './piezas';

export function PorQueElegirnos() {
    return (
        <section id="por-que-elegirnos" aria-labelledby="titulo-razones" className="bg-brand-navy-deep relative isolate overflow-hidden py-20 text-white md:py-28">
            <div className="bg-brand-coral/15 pointer-events-none absolute -bottom-48 -left-40 -z-10 size-[34rem] rounded-full blur-3xl" aria-hidden="true" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <EncabezadoSeccion
                    id="titulo-razones"
                    antetitulo="¿Por qué elegirnos?"
                    titulo="Cada operación requiere personal preparado y procesos eficientes"
                    entrada="Ofrecemos soluciones ajustadas a las necesidades de cada cliente, respaldadas por un equipo que conoce su operación."
                    sobreAzul
                />
                <ul role="list" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {RAZONES.map(({ icono: Icono, titulo, texto }, i) => (
                        <Revelar as="li" key={titulo} retraso={(i % 3) * 80} className="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 transition-colors hover:bg-white/[0.09]">
                            <span className="bg-brand-coral text-brand-navy-deep flex size-12 items-center justify-center rounded-2xl">
                                <Icono className="size-6" aria-hidden="true" />
                            </span>
                            <h3 className="mt-5 text-lg font-bold">{titulo}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-white/75">{texto}</p>
                        </Revelar>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export function Sectores() {
    return (
        <section id="sectores" aria-labelledby="titulo-sectores" className="py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <EncabezadoSeccion
                    id="titulo-sectores"
                    antetitulo="Sectores que atendemos"
                    titulo="Conocemos las exigencias de cada sector"
                    entrada="Del centro de distribución a la obra, del hospital al conjunto residencial: entornos con ritmos y protocolos muy distintos."
                    centrado
                />
                {/* Flex en vez de grid para centrar la última fila (13 sectores no llenan filas completas) */}
                <ul role="list" className="mt-12 flex flex-wrap justify-center gap-3">
                    {SECTORES.map(({ icono: Icono, nombre }, i) => (
                        <Revelar
                            as="li"
                            key={nombre}
                            retraso={(i % 5) * 50}
                            className="bg-card group hover:border-primary/40 flex w-[calc(50%-0.375rem)] flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-center transition-all hover:-translate-y-0.5 hover:shadow-md sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(20%-0.6rem)]"
                        >
                            <span className="bg-secondary text-primary group-hover:bg-brand-navy-deep flex size-12 items-center justify-center rounded-2xl transition-colors group-hover:text-white">
                                <Icono className="size-6" aria-hidden="true" />
                            </span>
                            <span className="text-sm font-semibold">{nombre}</span>
                        </Revelar>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export function SeguridadCobertura() {
    return (
        <section id="cobertura" aria-labelledby="titulo-cobertura" className="pb-20 md:pb-28">
            <h2 id="titulo-cobertura" className="sr-only">
                Cobertura y seguridad
            </h2>
            <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
                {/* Cobertura nacional: primero, porque es el destino del enlace "Cobertura" */}
                <Revelar className="bg-brand-navy-deep relative isolate overflow-hidden rounded-3xl p-7 text-white md:p-10">
                    {/* Textura de marca: trama de puntos y un gran marcador de ubicación */}
                    <div className="absolute inset-0 -z-10 opacity-[0.1] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" aria-hidden="true" />
                    <MapPin className="absolute -right-10 -bottom-10 -z-10 size-72 text-white/[0.06]" strokeWidth={1} aria-hidden="true" />
                    <span className="bg-brand-coral text-brand-navy-deep flex size-14 items-center justify-center rounded-2xl">
                        <MapPin className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="mt-6 text-2xl font-extrabold tracking-tight md:text-3xl">Donde su operación lo necesite</h3>
                    <p className="mt-3 max-w-lg text-lg leading-relaxed text-white/85">{EMPRESA.cobertura}</p>
                </Revelar>

                {/* Compromiso con la seguridad */}
                <Revelar retraso={100} className="bg-card rounded-3xl border p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-10">
                    <span className="bg-good-soft text-good flex size-14 items-center justify-center rounded-2xl">
                        <ShieldCheck className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="mt-6 text-2xl font-extrabold tracking-tight md:text-3xl">Compromiso con la seguridad</h3>
                    <p className="text-muted-foreground mt-3 leading-relaxed">{EMPRESA.seguridad}</p>
                    <ul role="list" className="mt-6 space-y-3">
                        {COMPROMISOS.map(({ icono: Icono, texto }) => (
                            <li key={texto} className="flex items-center gap-3 text-sm font-semibold">
                                <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                                    <Icono className="size-4" aria-hidden="true" />
                                </span>
                                {texto}
                            </li>
                        ))}
                    </ul>
                </Revelar>
            </div>
        </section>
    );
}
