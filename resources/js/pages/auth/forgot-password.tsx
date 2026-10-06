import { Head, useForm } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import TextLink from '@/components/text-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    useFocoPrimerError(errors, ['email']);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('password.email'));
    };

    return (
        <AuthLayout title="Recupera tu contraseña" description="Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.">
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

                <BotonEnviar procesando={processing} className="h-11 w-full rounded-lg text-[0.95rem] font-semibold">
                    Enviar enlace
                </BotonEnviar>

                <p className="text-muted-foreground text-center text-sm">
                    ¿La recordaste? <TextLink href={route('login')}>Inicia sesión</TextLink>
                </p>
            </form>
        </AuthLayout>
    );
}
