import { SERVICIOS } from '@/lib/portafolio';
import { cn } from '@/lib/utils';
import { ArrowRight, Check } from '@/components/iconos';
import { type KeyboardEvent, useRef, useState } from 'react';
import { EncabezadoSeccion, Revelar } from './piezas';

/** Evento para preseleccionar el servicio en el formulario de contacto. */
export const EVENTO_COTIZAR = 'cotizar-servicio';

/**
 * Explorador de las líneas de servicio con el patrón de pestañas de WAI-ARIA:
 * una sola pestaña en el orden de tabulación y flechas/Inicio/Fin para recorrerlas.
 */
export function Servicios() {
    const [activo, setActivo] = useState(0);
    const pestanas = useRef<(HTMLButtonElement | null)[]>([]);
    const servicio = SERVICIOS[activo];

    const mover = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        const destino = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: SERVICIOS.length - 1 }[e.key];
        if (destino === undefined) return;
        e.preventDefault();
        const j = (destino + SERVICIOS.length) % SERVICIOS.length;
        setActivo(j);
        pestanas.current[j]?.focus();
    };

    const cotizar = () => window.dispatchEvent(new CustomEvent(EVENTO_COTIZAR, { detail: servicio.nombre }));

    return (
        <section id="servicios" aria-labelledby="titulo-servicios" className="bg-muted/50 border-y py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <EncabezadoSeccion
                    id="titulo-servicios"
                    antetitulo="Portafolio"
                    titulo="Nuestras líneas de servicio"
                    entrada="Soluciones ajustadas a cada operación, con personal preparado y procesos eficientes en logística, aseo y mantenimiento."
                    centrado
                />

                <Revelar className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                    <div
                        role="tablist"
                        aria-label="Líneas de servicio"
                        aria-orientation="vertical"
                        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
                    >
                        {SERVICIOS.map((s, i) => {
                            const sel = i === activo;
                            const Icono = s.icono;
                            return (
                                <button
                                    key={s.id}
                                    ref={(el) => {
                                        pestanas.current[i] = el;
                                    }}
                                    id={`pestana-${s.id}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={sel}
                                    aria-controls={`panel-${s.id}`}
                                    tabIndex={sel ? 0 : -1}
                                    onClick={() => setActivo(i)}
                                    onKeyDown={(e) => mover(e, i)}
                                    className={cn(
                                        'group flex shrink-0 snap-start items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all lg:w-full',
                                        'focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
                                        sel ? 'bg-brand-navy-deep border-transparent text-white shadow-lg' : 'bg-card hover:border-primary/40 hover:shadow-sm',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                                            sel ? 'bg-brand-coral text-brand-coral-foreground' : 'bg-secondary text-primary',
                                        )}
                                    >
                                        <Icono className="size-5" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm leading-snug font-bold whitespace-nowrap lg:whitespace-normal">{s.nombre}</span>
                                        <span className={cn('hidden text-xs lg:block', sel ? 'text-white/70' : 'text-muted-foreground')}>
                                            {s.items.length} {s.tituloLista.toLowerCase() === 'perfiles' ? 'perfiles' : 'actividades'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {SERVICIOS.map((s, i) => (
                        <div
                            key={s.id}
                            id={`panel-${s.id}`}
                            role="tabpanel"
                            aria-labelledby={`pestana-${s.id}`}
                            tabIndex={0}
                            hidden={i !== activo}
                            className="bg-card flex flex-col overflow-hidden rounded-3xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
                        >
                            <div className="grid flex-1 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                                {/* Marco idéntico para todas las líneas: ocupa todo el alto del panel */}
                                <div className="relative aspect-square sm:aspect-[4/3] md:aspect-auto md:min-h-[28rem]">
                                    <img
                                        src={s.imagen}
                                        alt={`Personal de Justo a Tiempo SP en ${s.nombre.toLowerCase()}`}
                                        className="absolute inset-0 size-full object-cover object-top"
                                        loading={i === 0 ? 'eager' : 'lazy'}
                                    />
                                </div>
                                <div className="flex flex-col p-6 md:p-8">
                                    <h3 className="text-2xl leading-tight font-extrabold tracking-tight">{s.nombre}</h3>
                                    <p className="text-muted-foreground mt-3 leading-relaxed">{s.descripcion}</p>

                                    <h4 className="mt-6 text-xs font-bold tracking-[0.14em] uppercase">{s.tituloLista}</h4>
                                    <ul role="list" className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                                        {s.items.map((item) => (
                                            <li key={item} className="flex items-start gap-2 text-sm">
                                                <span className="bg-good-soft text-good mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                                                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                                                </span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    <a
                                        href="#contacto"
                                        onClick={cotizar}
                                        className="bg-accion text-accion-foreground group mt-8 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    >
                                        Cotizar este servicio
                                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </Revelar>
            </div>
        </section>
    );
}
