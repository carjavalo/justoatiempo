import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import { Check, Mail } from '@/components/iconos';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCuentaRegresiva } from '@/hooks/use-cuenta-regresiva';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';

type Camino = 'correo' | 'cedula';

/** Los dos caminos pesan igual: el enlace solo sirve a quien tiene correo; quien entra con cédula tiene el suyo. */
const CAMINOS: { valor: Camino; texto: string }[] = [
    { valor: 'correo', texto: 'Con mi correo' },
    { valor: 'cedula', texto: 'Con mi cédula' },
];

interface ForgotPasswordProps {
    status?: string;
    /** Segundos que faltan para poder pedir otro enlace. */
    espera: number;
    /** Momento del último envío desde este navegador (reinicia el contador en cada envío). */
    enviadoEn?: number | null;
    /** El camino con el que abre: el de la cédula si eso fue lo que se escribió al iniciar sesión. */
    con: Camino;
}

export default function ForgotPassword({ status, espera, enviadoEn, con }: ForgotPasswordProps) {
    const [camino, setCamino] = useState<Camino>(con);
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    useFocoPrimerError(errors, ['email']);

    // Después de enviar, el botón cuenta los segundos que faltan para poder pedir otro enlace
    const restante = useCuentaRegresiva(espera, enviadoEn);
    const esperando = restante > 0;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing || esperando) return;
        post(route('password.email'));
    };

    return (
        <AuthLayout title="Recuperar contraseña" volver={{ texto: 'Volver a iniciar sesión', href: route('login') }}>
            <Head title="Recuperar contraseña" />

            <MensajeEstado mensaje={status} />

            <fieldset className="mb-6">
                <legend className="mb-2 text-sm font-medium">¿Cómo entras a la plataforma?</legend>
                <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
                    {CAMINOS.map(({ valor, texto }) => (
                        <label
                            key={valor}
                            className="text-muted-foreground hover:text-foreground has-checked:bg-background has-checked:text-foreground has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-[color,background-color,box-shadow] has-checked:shadow-[0_1px_2px_rgba(16,24,40,0.08)] has-focus-visible:ring-2"
                        >
                            <input
                                type="radio"
                                name="camino"
                                value={valor}
                                checked={camino === valor}
                                onChange={() => setCamino(valor)}
                                className="sr-only"
                            />
                            {/* La elegida se marca también con un dibujo, no solo con el color */}
                            {camino === valor && <Check className="size-4" aria-hidden="true" />}
                            {texto}
                        </label>
                    ))}
                </div>
            </fieldset>

            {/* Los dos caminos quedan montados: cambiar de opción con las flechas no saca el foco del grupo */}
            <form onSubmit={submit} className={cn('grid gap-6', camino !== 'correo' && 'hidden')} noValidate>
                <div className="grid gap-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                        <Mail
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                            aria-hidden="true"
                        />
                        <Input
                            {...propsCampo('email', errors.email, 'email-ayuda')}
                            type="email"
                            name="email"
                            required
                            autoComplete="email"
                            placeholder="Ej.: nombre@correo.com"
                            value={data.email}
                            autoFocus={con === 'correo'}
                            onChange={(e) => setData('email', e.target.value)}
                            className="h-11 rounded-lg pl-9"
                        />
                    </div>
                    <InputError id="email-error" message={errors.email} />
                    <p id="email-ayuda" className="text-muted-foreground text-sm text-pretty">
                        Te enviaremos un enlace para crear una contraseña nueva.
                    </p>
                </div>

                {/* Mientras cuenta, queda aria-disabled (no disabled): no suelta el foco y se anuncia como no disponible */}
                <BotonEnviar
                    procesando={processing}
                    aria-disabled={processing || esperando || undefined}
                    className={cn('h-11 w-full rounded-lg text-[0.95rem] font-semibold', esperando && 'aria-disabled:cursor-not-allowed')}
                >
                    {esperando ? (
                        <span>
                            Reenviar en <span className="tabular-nums">{restante}</span> s
                        </span>
                    ) : enviadoEn ? (
                        'Reenviar enlace'
                    ) : (
                        'Enviar enlace'
                    )}
                </BotonEnviar>
                {/* Solo se anuncia el final de la cuenta, no cada segundo */}
                <p role="status" className="sr-only">
                    {espera > 0 && !esperando ? 'Ya puedes pedir otro enlace.' : ''}
                </p>
            </form>

            <div className={cn('grid gap-2 text-sm text-pretty', camino !== 'cedula' && 'hidden')}>
                <p>Pídele a tu coordinador o al administrador un código inicial nuevo.</p>
                <p className="text-muted-foreground">Entras con tu cédula y ese código, y enseguida creas tu contraseña.</p>
            </div>
        </AuthLayout>
    );
}
