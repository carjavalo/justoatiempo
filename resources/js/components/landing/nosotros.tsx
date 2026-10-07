import LogoMarca from '@/components/logo-marca';
import { EMPRESA } from '@/lib/portafolio';
import { CheckCircle2, Target, Vision } from '@/components/iconos';
import { EncabezadoSeccion, Revelar } from './piezas';

export function Nosotros() {
    return (
        <section id="nosotros" aria-labelledby="titulo-nosotros" className="py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <EncabezadoSeccion id="titulo-nosotros" antetitulo="Quiénes somos" titulo="Talento humano comprometido con su operación" />
                        <Revelar retraso={100} className="text-muted-foreground mt-6 space-y-4 text-base leading-relaxed md:text-lg">
                            {EMPRESA.quienesSomos.map((p) => (
                                <p key={p.slice(0, 20)}>{p}</p>
                            ))}
                        </Revelar>
                    </div>

                    {/* Foto del equipo con el logo oficial como sello */}
                    <Revelar retraso={150} className="relative mx-auto w-full max-w-md">
                        <div className="bg-brand-coral-soft absolute -top-5 -right-5 -z-10 hidden size-40 rounded-3xl sm:block" aria-hidden="true" />
                        <img
                            src="/images/servicios/despachos.jpg"
                            alt="Colaborador de Justo a Tiempo SP con una caja de despacho"
                            className="aspect-[3/4] w-full rounded-3xl object-cover object-top shadow-xl"
                        />
                        <LogoMarca
                            grande
                            alt={`Logo de ${EMPRESA.nombre}`}
                            className="absolute -bottom-6 left-4 w-36 rounded-2xl p-2.5 shadow-[var(--sombra-flotante)] sm:-left-8 sm:w-44 sm:p-3"
                        />
                    </Revelar>
                </div>

                {/* Misión y visión */}
                <div className="mt-16 grid gap-5 md:grid-cols-2">
                    {[
                        { icono: Target, titulo: 'Misión', texto: EMPRESA.mision },
                        { icono: Vision, titulo: 'Visión', texto: EMPRESA.vision },
                    ].map(({ icono: Icono, titulo, texto }, i) => (
                        <Revelar key={titulo} retraso={i * 100} className="bg-card relative overflow-hidden rounded-3xl border p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-8">
                            <span className="bg-secondary text-primary flex size-12 items-center justify-center rounded-2xl">
                                <Icono className="size-6" aria-hidden="true" />
                            </span>
                            <h3 className="mt-5 text-xl font-extrabold tracking-tight">{titulo}</h3>
                            <p className="text-muted-foreground mt-2 leading-relaxed">{texto}</p>
                        </Revelar>
                    ))}
                </div>

                {/* Valores */}
                <Revelar className="mt-12">
                    <h3 className="text-center text-sm font-bold tracking-[0.16em] uppercase">Nuestros valores</h3>
                    <ul role="list" className="mt-5 flex flex-wrap justify-center gap-2.5">
                        {EMPRESA.valores.map((v) => (
                            <li key={v} className="bg-card flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold">
                                <CheckCircle2 className="text-brand-coral-ink size-4" aria-hidden="true" />
                                {v}
                            </li>
                        ))}
                    </ul>
                </Revelar>
            </div>
        </section>
    );
}
