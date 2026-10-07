import { Head, useForm } from '@inertiajs/react';
import { XCircle } from '@/components/iconos';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { PasswordInput } from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';

interface ResetPasswordProps {
    token: string;
    email: string;
}

type ResetPasswordForm = {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
};

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const { data, setData, post, processing, errors, reset } = useForm<ResetPasswordForm>({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    useFocoPrimerError(errors, ['password', 'password_confirmation']);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout title="Crea una nueva contraseña" description={`Para la cuenta ${email}.`}>
            <Head title="Nueva contraseña" />

            {/* Enlace vencido o inválido: se anuncia de inmediato y ofrece la salida */}
            {errors.email && (
                <div role="alert" className="bg-critical-soft text-critical mb-6 flex gap-2 rounded-lg px-3 py-2 text-sm font-medium">
                    <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <p>
                        {errors.email} <TextLink href={route('password.request')}>Solicitar un nuevo enlace</TextLink>
                    </p>
                </div>
            )}

            <form onSubmit={submit} className="grid gap-5" noValidate>
                {/* Para los gestores de contraseñas: identifica la cuenta sin mostrar un campo repetido */}
                <input type="email" name="email" autoComplete="username" value={data.email} readOnly hidden />

                <div className="grid gap-2">
                    <Label htmlFor="password">Nueva contraseña</Label>
                    <p id="password-ayuda" className="text-muted-foreground -mt-1 text-xs">
                        Mínimo 8 caracteres.
                    </p>
                    <PasswordInput
                        {...propsCampo('password', errors.password, 'password-ayuda')}
                        name="password"
                        required
                        autoComplete="new-password"
                        placeholder="Escribe la nueva contraseña"
                        value={data.password}
                        autoFocus
                        onChange={(e) => setData('password', e.target.value)}
                        className="h-11 rounded-lg"
                    />
                    <InputError id="password-error" message={errors.password} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="password_confirmation">Confirmar nueva contraseña</Label>
                    <PasswordInput
                        {...propsCampo('password_confirmation', errors.password_confirmation)}
                        name="password_confirmation"
                        required
                        autoComplete="new-password"
                        placeholder="Repítela para confirmar"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        className="h-11 rounded-lg"
                    />
                    <InputError id="password_confirmation-error" message={errors.password_confirmation} />
                </div>

                <BotonEnviar procesando={processing} textoProcesando="Guardando…" className="mt-2 h-11 w-full rounded-lg text-[0.95rem] font-semibold">
                    Guardar contraseña
                </BotonEnviar>
            </form>
        </AuthLayout>
    );
}
