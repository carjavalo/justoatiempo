import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { type SharedData } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import { CheckCircle2 } from '@/components/iconos';
import { type FormEventHandler, useEffect, useRef, useState } from 'react';
import { EncabezadoSeccion, Revelar } from './piezas';
import { EVENTO_COTIZAR } from './servicios';
import { Selector } from '@/components/selector';

const claseCampo = 'border-input bg-background w-full rounded-lg border px-3 text-sm transition-[color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-critical aria-invalid:focus-visible:border-critical aria-invalid:focus-visible:ring-critical/25';

/** Qué pasa después de enviar el formulario. */
const PASOS = [
    { titulo: 'Nos cuenta qué necesita', texto: 'Con los datos de su operación en este formulario.' },
    { titulo: 'Analizamos su operación', texto: 'Definimos perfiles, cantidad de personal y procesos.' },
    { titulo: 'Recibe una propuesta a la medida', texto: 'Lista para revisarla con su equipo.' },
];

export function Contacto({ servicios }: { servicios: string[] }) {
    const { flash } = usePage<SharedData & { flash: { contactoEnviado?: boolean } }>().props;
    const [enviado, setEnviado] = useState(false);
    const confirmacion = useRef<HTMLDivElement>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        nombre: '',
        empresa: '',
        email: '',
        telefono: '',
        servicio: '',
        mensaje: '',
        autoriza_datos: false as boolean,
        sitio_web: '', // trampa para robots
    });

    useFocoPrimerError(errors, ['nombre', 'email', 'telefono', 'servicio', 'mensaje', 'autoriza_datos']);

    // "Cotizar este servicio" en el explorador deja el servicio elegido aquí
    useEffect(() => {
        const alCotizar = (e: Event) => setData('servicio', (e as CustomEvent<string>).detail);
        window.addEventListener(EVENTO_COTIZAR, alCotizar);
        return () => window.removeEventListener(EVENTO_COTIZAR, alCotizar);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (flash?.contactoEnviado) {
            setEnviado(true);
            reset();
            window.setTimeout(() => confirmacion.current?.focus(), 50);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flash]);

    const enviar: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post('/contacto', { preserveScroll: true });
    };

    return (
        <section id="contacto" aria-labelledby="titulo-contacto" className="bg-muted/50 border-t py-20 md:py-28">
            <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
                <div>
                    <EncabezadoSeccion
                        id="titulo-contacto"
                        antetitulo="Contacto"
                        titulo="Hablemos de su operación"
                        entrada="Escríbanos y un asesor de nuestro equipo le contactará para entender su necesidad."
                    />
                    <Revelar retraso={100} className="mt-10">
                        <h3 className="text-sm font-bold tracking-[0.16em] uppercase">Cómo seguimos</h3>
                        <ol role="list" className="mt-5 space-y-5">
                            {PASOS.map(({ titulo, texto }, i) => (
                                <li key={titulo} className="relative flex gap-4">
                                    {/* Línea que une los pasos */}
                                    {i < PASOS.length - 1 && <span className="bg-border absolute top-11 bottom-[-1.25rem] left-[1.3125rem] w-px" aria-hidden="true" />}
                                    <span className="bg-brand-navy-deep flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white" aria-hidden="true">
                                        {i + 1}
                                    </span>
                                    <span className="pt-0.5">
                                        <span className="sr-only">Paso {i + 1}: </span>
                                        <span className="block font-bold">{titulo}</span>
                                        <span className="text-muted-foreground block text-sm">{texto}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </Revelar>
                </div>

                <Revelar retraso={150} className="bg-card rounded-3xl border p-6 shadow-[0_8px_30px_rgba(16,24,40,0.06)] md:p-8">
                    {enviado ? (
                        <div ref={confirmacion} tabIndex={-1} role="status" className="flex flex-col items-center py-10 text-center outline-none">
                            <span className="bg-good-soft text-good flex size-16 items-center justify-center rounded-full">
                                <CheckCircle2 className="size-8" aria-hidden="true" />
                            </span>
                            <h3 className="mt-5 text-2xl font-extrabold tracking-tight">¡Gracias! Recibimos su solicitud</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm">Le responderemos al correo o al teléfono que nos dejó.</p>
                            <button type="button" onClick={() => setEnviado(false)} className="text-primary mt-6 text-sm font-semibold underline underline-offset-4">
                                Enviar otra solicitud
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={enviar} noValidate aria-label="Solicitud de cotización" className="grid gap-5">
                            {/* Trampa: invisible para personas y fuera del orden de tabulación */}
                            <div className="absolute -left-[9999px]" aria-hidden="true">
                                <label htmlFor="sitio_web">No llenar este campo</label>
                                <input id="sitio_web" type="text" tabIndex={-1} autoComplete="off" value={data.sitio_web} onChange={(e) => setData('sitio_web', e.target.value)} />
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="nombre">
                                        Nombre completo <span aria-hidden="true">*</span>
                                    </Label>
                                    <Input {...propsCampo('nombre', errors.nombre)} required autoComplete="name" value={data.nombre} onChange={(e) => setData('nombre', e.target.value)} className="h-11 rounded-lg" />
                                    <InputError id="nombre-error" message={errors.nombre} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="empresa">Empresa</Label>
                                    <Input {...propsCampo('empresa', errors.empresa)} autoComplete="organization" value={data.empresa} onChange={(e) => setData('empresa', e.target.value)} className="h-11 rounded-lg" />
                                    <InputError id="empresa-error" message={errors.empresa} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="email">
                                        Correo electrónico <span aria-hidden="true">*</span>
                                    </Label>
                                    <Input {...propsCampo('email', errors.email)} type="email" required autoComplete="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className="h-11 rounded-lg" />
                                    <InputError id="email-error" message={errors.email} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="telefono">Teléfono</Label>
                                    <Input {...propsCampo('telefono', errors.telefono)} type="tel" autoComplete="tel" value={data.telefono} onChange={(e) => setData('telefono', e.target.value)} className="h-11 rounded-lg" />
                                    <InputError id="telefono-error" message={errors.telefono} />
                                </div>
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="servicio">Servicio de interés</Label>
                                <Selector
                                    {...propsCampo('servicio', errors.servicio)}
                                    valor={data.servicio}
                                    onCambio={(v) => setData('servicio', v)}
                                    placeholder="Elija un servicio (opcional)"
                                    opciones={[{ valor: '', texto: 'Sin especificar' }, ...servicios.map((s) => ({ valor: s, texto: s }))]}
                                    className="h-11"
                                />
                                <InputError id="servicio-error" message={errors.servicio} />
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="mensaje">
                                    ¿Qué necesita? <span aria-hidden="true">*</span>
                                </Label>
                                <textarea
                                    {...propsCampo('mensaje', errors.mensaje, 'mensaje-ayuda')}
                                    required
                                    rows={4}
                                    maxLength={2000}
                                    value={data.mensaje}
                                    onChange={(e) => setData('mensaje', e.target.value)}
                                    className={`${claseCampo} py-2.5 leading-relaxed`}
                                />
                                <p id="mensaje-ayuda" className="text-muted-foreground text-xs">
                                    Por ejemplo: cantidad de personas, ciudad, fechas y tipo de operación.
                                </p>
                                <InputError id="mensaje-error" message={errors.mensaje} />
                            </div>

                            <div className="grid gap-1.5">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="autoriza_datos"
                                        checked={data.autoriza_datos}
                                        onCheckedChange={(v) => setData('autoriza_datos', v === true)}
                                        aria-invalid={errors.autoriza_datos ? true : undefined}
                                        aria-describedby={errors.autoriza_datos ? 'autoriza_datos-error' : undefined}
                                        className="mt-0.5"
                                    />
                                    <Label htmlFor="autoriza_datos" className="text-muted-foreground text-xs leading-relaxed font-normal">
                                        Autorizo a Justo a Tiempo SP S.A.S a tratar mis datos personales para atender esta solicitud, conforme a la Ley 1581 de 2012.{' '}
                                        <span aria-hidden="true">*</span>
                                    </Label>
                                </div>
                                <InputError id="autoriza_datos-error" message={errors.autoriza_datos} />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-muted-foreground text-xs">
                                    <span aria-hidden="true">*</span> Campos obligatorios
                                </p>
                                <BotonEnviar procesando={processing} className="bg-brand-coral text-brand-navy-deep h-11 rounded-xl px-6 font-bold hover:bg-[#ee8574]">
                                    Enviar solicitud
                                </BotonEnviar>
                            </div>
                        </form>
                    )}
                </Revelar>
            </div>
        </section>
    );
}
