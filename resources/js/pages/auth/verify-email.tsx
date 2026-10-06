import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import { MensajeEstado } from '@/components/mensaje-estado';
import TextLink from '@/components/text-link';
import AuthLayout from '@/layouts/auth-layout';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('verification.send'));
    };

    return (
        <AuthLayout title="Verifica tu correo" description="Abre el enlace que te enviamos por correo para activar tu acceso a la plataforma.">
            <Head title="Verificar correo" />

            <MensajeEstado mensaje={status === 'verification-link-sent' ? 'Te enviamos un nuevo enlace de verificación.' : null} />

            <form onSubmit={submit} className="grid gap-4">
                <BotonEnviar procesando={processing} variant="secondary" className="h-11 w-full rounded-lg font-semibold">
                    Reenviar el correo
                </BotonEnviar>

                <TextLink href={route('logout')} method="post" as="button" className="mx-auto block text-sm">
                    Cerrar sesión
                </TextLink>
            </form>
        </AuthLayout>
    );
}
