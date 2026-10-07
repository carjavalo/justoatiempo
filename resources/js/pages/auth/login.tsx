import { Head, useForm } from '@inertiajs/react';
import { LockKeyhole, Mail } from '@/components/iconos';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import { PasswordInput } from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });

    useFocoPrimerError(errors, ['email', 'password']);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Inicia sesión" description="Ingresa con el correo y la contraseña que te asignó el administrador.">
            <Head title="Iniciar sesión" />

            <MensajeEstado mensaje={status} />

            <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
                <div className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <div className="relative">
                            <Mail weight="bold" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
                            <Input
                                {...propsCampo('email', errors.email)}
                                type="email"
                                required
                                autoFocus
                                autoComplete="username"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="nombre@justoatiempo.com"
                                className="h-11 rounded-lg pl-9"
                            />
                        </div>
                        <InputError id="email-error" message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative">
                            <LockKeyhole weight="bold" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden="true" />
                            <PasswordInput
                                {...propsCampo('password', errors.password)}
                                required
                                autoComplete="current-password"
                                placeholder="Escribe tu contraseña"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="h-11 rounded-lg pl-9"
                            />
                        </div>
                        <InputError id="password-error" message={errors.password} />
                        {canResetPassword && (
                            <TextLink href={route('password.request')} className="justify-self-end text-xs">
                                ¿Olvidaste tu contraseña?
                            </TextLink>
                        )}
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox id="remember" name="remember" checked={data.remember} onCheckedChange={(v) => setData('remember', v === true)} />
                        <Label htmlFor="remember" className="font-normal">
                            Mantener la sesión iniciada
                        </Label>
                    </div>

                    <BotonEnviar procesando={processing} textoProcesando="Ingresando…" className="mt-2 h-11 w-full rounded-lg text-[0.95rem] font-semibold">
                        Ingresar
                    </BotonEnviar>
                </div>

                <p className="text-muted-foreground text-center text-xs">¿No tienes acceso? Solicítalo a tu coordinador o al administrador.</p>
            </form>
        </AuthLayout>
    );
}
