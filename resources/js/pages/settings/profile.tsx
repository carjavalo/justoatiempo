import { type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2 } from '@/components/iconos';
import { FormEventHandler } from 'react';

import { BotonEnviar } from '@/components/boton-enviar';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';

export default function Profile({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { auth } = usePage<SharedData>().props;

    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: auth.user.name,
        email: auth.user.email,
    });

    useFocoPrimerError(errors, ['name', 'email']);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        patch(route('profile.update'), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Mi cuenta', href: route('profile.edit') }]}>
            <Head title="Perfil" />

            <SettingsLayout descripcion="Tu nombre y el correo con el que ingresas a la plataforma.">
                <form onSubmit={submit} className="space-y-6" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre completo</Label>
                        <Input
                            {...propsCampo('name', errors.name)}
                            className="h-11 rounded-lg"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            required
                            autoComplete="name"
                        />
                        <InputError id="name-error" message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            {...propsCampo('email', errors.email)}
                            type="email"
                            className="h-11 rounded-lg"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            required
                            autoComplete="username"
                        />
                        <InputError id="email-error" message={errors.email} />
                    </div>

                    {mustVerifyEmail && auth.user.email_verified_at === null && (
                        <div className="bg-warning-soft rounded-lg p-3 text-sm">
                            Tu correo aún no está verificado.{' '}
                            <Link href={route('verification.send')} method="post" as="button" className="text-warning font-semibold underline underline-offset-2">
                                Reenviar el correo de verificación
                            </Link>
                            <MensajeEstado mensaje={status === 'verification-link-sent' ? 'Te enviamos un nuevo enlace de verificación.' : null} className="mt-2 mb-0" />
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6">
                        <BotonEnviar procesando={processing} textoProcesando="Guardando…" className="h-10 rounded-lg px-5 font-semibold">
                            Guardar cambios
                        </BotonEnviar>

                        {/* Región siempre presente: el aviso se anuncia al aparecer (WCAG 4.1.3) */}
                        <div role="status" className="min-h-5">
                            {recentlySuccessful && (
                                <p className="text-good flex items-center gap-1.5 text-sm font-medium">
                                    <CheckCircle2 className="size-4" aria-hidden="true" />
                                    Cambios guardados
                                </p>
                            )}
                        </div>
                    </div>
                </form>
            </SettingsLayout>
        </AppLayout>
    );
}
