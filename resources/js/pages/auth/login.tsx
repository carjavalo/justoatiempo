import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
}

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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Inicia sesión" description="Ingresa con el correo y la contraseña que te asignó el administrador.">
            <Head title="Iniciar sesión" />

            {status && <div className="bg-good-soft text-good mb-6 rounded-lg px-3 py-2 text-sm font-medium">{status}</div>}

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <div className="relative">
                            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                id="email"
                                type="email"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="nombre@justoatiempo.com"
                                className="h-11 rounded-lg pl-9"
                            />
                        </div>
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Contraseña</Label>
                            {canResetPassword && (
                                <TextLink href={route('password.request')} className="ml-auto text-xs" tabIndex={5}>
                                    ¿Olvidaste tu contraseña?
                                </TextLink>
                            )}
                        </div>
                        <div className="relative">
                            <LockKeyhole className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                id="password"
                                type="password"
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                                className="h-11 rounded-lg pl-9"
                            />
                        </div>
                        <InputError message={errors.password} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox id="remember" name="remember" tabIndex={3} checked={data.remember} onCheckedChange={(v) => setData('remember', v === true)} />
                        <Label htmlFor="remember" className="font-normal">
                            Mantener la sesión iniciada
                        </Label>
                    </div>

                    <Button type="submit" className="mt-2 h-11 w-full rounded-lg text-[0.95rem] font-semibold" tabIndex={4} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Ingresar
                    </Button>
                </div>

                <p className="text-muted-foreground text-center text-xs">¿No tienes acceso? Solicítalo a tu coordinador o al administrador.</p>
            </form>
        </AuthLayout>
    );
}
