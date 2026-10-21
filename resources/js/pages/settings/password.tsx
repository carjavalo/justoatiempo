import { BotonEnviar } from '@/components/boton-enviar';
import { CheckCircle2, KeyRound } from '@/components/iconos';
import InputError from '@/components/input-error';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

/** obligatorio: entró con la contraseña inicial (su cédula) y debe cambiarla para seguir. */
export default function Password({ obligatorio = false }: { obligatorio?: boolean }) {
    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    useFocoPrimerError(errors, ['current_password', 'password', 'password_confirmation']);

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) reset('password', 'password_confirmation');
                if (errors.current_password) reset('current_password');
            },
        });
    };

    return (
        // Mientras deba cambiarla, no hay a dónde volver: cualquier otra página lo trae de regreso aquí
        <AppLayout volver={obligatorio ? false : undefined}>
            <Head title="Contraseña" />

            <SettingsLayout descripcion="Usa una contraseña larga y difícil de adivinar. Al cambiarla, la usarás en tu próximo ingreso.">
                {obligatorio && (
                    <p role="status" className="bg-secondary text-secondary-foreground mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm">
                        <KeyRound className="text-brand-coral-ink mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <span>
                            <strong className="font-semibold">Crea tu propia contraseña para seguir.</strong> Entraste con la contraseña inicial (tu
                            cédula): escríbela como contraseña actual y elige una nueva que solo tú conozcas.
                        </span>
                    </p>
                )}
                <form onSubmit={updatePassword} className="space-y-6" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="current_password">Contraseña actual</Label>
                        <PasswordInput
                            {...propsCampo('current_password', errors.current_password)}
                            value={data.current_password}
                            onChange={(e) => setData('current_password', e.target.value)}
                            required
                            className="h-11 rounded-lg"
                            autoComplete="current-password"
                            placeholder={obligatorio ? 'Tu número de cédula' : 'La que usas para ingresar'}
                        />
                        <InputError id="current_password-error" message={errors.current_password} />
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="grid content-start gap-2">
                            <Label htmlFor="password">Nueva contraseña</Label>
                            <PasswordInput
                                {...propsCampo('password', errors.password, 'password-ayuda')}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                required
                                className="h-11 rounded-lg"
                                autoComplete="new-password"
                                placeholder="Escribe la nueva contraseña"
                            />
                            <p id="password-ayuda" className="text-muted-foreground text-xs">
                                Mínimo 8 caracteres.
                            </p>
                            <InputError id="password-error" message={errors.password} />
                        </div>

                        <div className="grid content-start gap-2">
                            <Label htmlFor="password_confirmation">Confirmar nueva contraseña</Label>
                            <PasswordInput
                                {...propsCampo('password_confirmation', errors.password_confirmation)}
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                required
                                className="h-11 rounded-lg"
                                autoComplete="new-password"
                                placeholder="Repítela para confirmar"
                            />
                            <InputError id="password_confirmation-error" message={errors.password_confirmation} />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6">
                        <BotonEnviar procesando={processing} textoProcesando="Actualizando…" className="h-10 rounded-lg px-5 font-semibold">
                            Actualizar contraseña
                        </BotonEnviar>

                        {/* Región siempre presente: el aviso se anuncia al aparecer (WCAG 4.1.3) */}
                        <div role="status" className="min-h-5">
                            {recentlySuccessful && (
                                <p className="text-good flex items-center gap-1.5 text-sm font-medium">
                                    <CheckCircle2 className="size-4" aria-hidden="true" />
                                    Contraseña actualizada
                                </p>
                            )}
                        </div>
                    </div>
                </form>
            </SettingsLayout>
        </AppLayout>
    );
}
