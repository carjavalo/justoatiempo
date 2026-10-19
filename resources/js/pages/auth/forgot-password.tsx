import { Head, useForm } from '@inertiajs/react';
import { Mail } from '@/components/iconos';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import { Input } from '@/components/ui/input';
import { useCuentaRegresiva } from '@/hooks/use-cuenta-regresiva';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';

interface ForgotPasswordProps {
    status?: string;
    /** Segundos que faltan para poder pedir otro enlace. */
    espera: number;
    /** Momento del último envío desde este navegador (reinicia el contador en cada envío). */
    enviadoEn?: number | null;
}

export default function ForgotPassword({ status, espera, enviadoEn }: ForgotPasswordProps) {
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
        <AuthLayout
            title="Recupera tu contraseña"
            description="Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña."
            volver={{ texto: 'Volver a iniciar sesión', href: route('login') }}
        >
            <Head title="Recuperar contraseña" />

            <MensajeEstado mensaje={status} />

            <form onSubmit={submit} className="grid gap-6" noValidate>
                <div className="grid gap-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                        <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
                        <Input
                            {...propsCampo('email', errors.email)}
                            type="email"
                            name="email"
                            required
                            autoComplete="username"
                            value={data.email}
                            autoFocus
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="nombre@justoatiempo.com"
                            className="h-11 rounded-lg pl-9"
                        />
                    </div>
                    <InputError id="email-error" message={errors.email} />
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
        </AuthLayout>
    );
}
