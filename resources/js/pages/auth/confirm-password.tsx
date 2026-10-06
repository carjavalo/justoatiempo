import { Head, useForm } from '@inertiajs/react';
import { LockKeyhole } from 'lucide-react';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    useFocoPrimerError(errors, ['password']);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Confirma tu contraseña" description="Esta es un área protegida. Ingresa tu contraseña para continuar.">
            <Head title="Confirmar contraseña" />

            <form onSubmit={submit} className="grid gap-6" noValidate>
                <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                        <LockKeyhole className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden="true" />
                        <PasswordInput
                            {...propsCampo('password', errors.password)}
                            name="password"
                            required
                            autoComplete="current-password"
                            value={data.password}
                            autoFocus
                            onChange={(e) => setData('password', e.target.value)}
                            className="h-11 rounded-lg pl-9"
                        />
                    </div>
                    <InputError id="password-error" message={errors.password} />
                </div>

                <BotonEnviar procesando={processing} textoProcesando="Confirmando…" className="h-11 w-full rounded-lg text-[0.95rem] font-semibold">
                    Confirmar
                </BotonEnviar>
            </form>
        </AuthLayout>
    );
}
