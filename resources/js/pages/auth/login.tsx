import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, KeyboardEvent, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { BotonEnviar } from '@/components/boton-enviar';
import { AlertTriangle, LockKeyhole, UserRound, XCircle } from '@/components/iconos';
import InputError from '@/components/input-error';
import { MensajeEstado } from '@/components/mensaje-estado';
import { PasswordInput } from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCuentaRegresiva } from '@/hooks/use-cuenta-regresiva';
import AuthLayout from '@/layouts/auth-layout';
import { propsCampo } from '@/lib/formularios';
import { cn } from '@/lib/utils';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
    /** Correo de quien acaba de restablecer su contraseña: ya va escrito. */
    correo?: string | null;
}

type Modo = 'cedula' | 'correo';
const CLAVE_MODO = 'ingreso.con';

/** Con qué se entró la última vez en este equipo. Solo eso: la cédula no se guarda (hay teléfonos de cuadrilla compartidos). */
function modoRecordado(): Modo | null {
    try {
        const modo = localStorage.getItem(CLAVE_MODO);
        return modo === 'cedula' || modo === 'correo' ? modo : null;
    } catch {
        return null;
    }
}

function recordarModo(modo: Modo) {
    try {
        localStorage.setItem(CLAVE_MODO, modo);
    } catch {
        // Sin almacenamiento (navegación privada): el teclado queda el de siempre
    }
}

/** Lo escrito es una cédula (sin @ y con números). */
const esCedula = (texto: string) => !texto.includes('@') && /\d/.test(texto);

/** Pantalla táctil: ahí el teclado lo pone el teléfono (en un computador no hay teclado que cambiar). */
const esTactil = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function Login({ status, canResetPassword, correo }: LoginProps) {
    const { data, setData, post, processing, errors, reset, clearErrors, setError } = useForm<LoginForm>({
        email: correo ?? '',
        password: '',
        remember: false,
    });
    // Los fallos del ingreso (datos que no coinciden, cuenta) no son de un campo: llegan en «ingreso». En un bloqueo,
    // «bloqueo» trae los segundos que faltan.
    const { ingreso, bloqueo } = errors as typeof errors & { ingreso?: string; bloqueo?: string };
    const [intentos, setIntentos] = useState(0);
    const [mayusculas, setMayusculas] = useState(false);
    // Quien entró con su cédula la última vez recibe de una vez el teclado de números (con salida al de letras)
    const [teclado, setTeclado] = useState<'numeric' | 'email' | 'text'>(() => {
        const modo = correo ? 'correo' : modoRecordado();
        return modo === 'cedula' ? 'numeric' : modo === 'correo' ? 'email' : 'text';
    });
    const [tactil] = useState(esTactil);

    const restante = useCuentaRegresiva(Number(bloqueo ?? 0), bloqueo ? intentos : undefined);
    const bloqueado = restante > 0;
    // Durante el bloqueo, el aviso cuenta los segundos; al terminar desaparece y el botón vuelve a servir
    const aviso = bloqueo ? (bloqueado ? `Hiciste demasiados intentos seguidos. Podrás intentarlo de nuevo en ${restante} s.` : null) : ingreso;

    // Tras cada intento fallido (no al corregir), el foco va al campo que falta o, si no, a la contraseña: es lo que
    // se vació y casi siempre lo que hay que volver a escribir
    useEffect(() => {
        if (intentos) document.getElementById(errors.email ? 'email' : 'password')?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intentos]);

    /** Al corregir un campo, su error se va; el aviso del ingreso sigue a la vista hasta el próximo intento. */
    const escribir = (campo: 'email' | 'password', valor: string) => {
        setData(campo, valor);
        if (errors[campo]) clearErrors(campo);
    };

    const revisarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState('CapsLock'));

    const usarCorreo = () => {
        // El teclado cambia al volver a enfocar el campo, ya con el modo nuevo
        flushSync(() => setTeclado('email'));
        recordarModo('correo');
        document.getElementById('email')?.focus();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing || bloqueado) return;

        // Lo que falta se dice aquí mismo, sin ir al servidor
        const sinCorreo = !data.email.trim();
        const sinClave = !data.password;
        if (sinCorreo || sinClave) {
            clearErrors();
            if (sinCorreo) setError('email', 'Escribe tu correo o tu cédula.');
            if (sinClave) setError('password', 'Escribe tu contraseña.');
            setIntentos((n) => n + 1);
            return;
        }

        recordarModo(esCedula(data.email) ? 'cedula' : 'correo');
        // Si entra, la plataforma se carga completa (AuthenticatedSessionController); si no, vuelve con el aviso
        post(route('login'), {
            onError: () => setIntentos((n) => n + 1),
            onFinish: () => reset('password'),
        });
    };

    const conCedula = esCedula(data.email);
    const ayudaClave = [aviso && 'ingreso-error', 'password-mayus', conCedula && 'password-primera'].filter(Boolean).join(' ');

    return (
        <AuthLayout title="Iniciar sesión" volver={{ texto: 'Volver al sitio web', href: route('home') }}>
            <Head title="Iniciar sesión" />

            <MensajeEstado mensaje={status} />

            <form className="grid gap-5" onSubmit={submit} noValidate>
                {aviso && (
                    <div
                        id="ingreso-error"
                        className="bg-critical-soft text-critical flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm font-medium"
                    >
                        <XCircle className="mt-0.5 size-4" aria-hidden="true" />
                        <p className="text-pretty">{aviso}</p>
                    </div>
                )}
                {/* Solo se anuncia el final del bloqueo, no cada segundo */}
                <p role="status" className="sr-only">
                    {bloqueo && !bloqueado ? 'Ya puedes intentarlo de nuevo.' : ''}
                </p>

                <div className="grid gap-2">
                    <Label htmlFor="email">Correo o cédula</Label>
                    <div className="relative">
                        <UserRound
                            weight="bold"
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                            aria-hidden="true"
                        />
                        <Input
                            {...propsCampo('email', errors.email, 'email-ayuda')}
                            type="text"
                            inputMode={teclado}
                            required
                            autoCapitalize="none"
                            spellCheck={false}
                            autoFocus={!correo}
                            autoComplete="username"
                            value={data.email}
                            onChange={(e) => escribir('email', e.target.value)}
                            className="h-11 rounded-lg pl-9"
                        />
                    </div>
                    <InputError id="email-error" message={errors.email} />
                    <p id="email-ayuda" className="text-muted-foreground text-sm">
                        Si usas tu cédula, escríbela con o sin puntos.
                    </p>
                    {/* El teclado de números no tiene «@»: quien esta vez entra con correo lo cambia aquí */}
                    {tactil && teclado === 'numeric' && (
                        <button
                            type="button"
                            onClick={usarCorreo}
                            className="text-foreground decoration-muted-foreground focus-visible:ring-ring -mt-1 inline-flex min-h-11 items-center justify-self-start rounded-sm text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-hidden"
                        >
                            Entrar con correo
                        </button>
                    )}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                        <LockKeyhole
                            weight="bold"
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
                            aria-hidden="true"
                        />
                        <PasswordInput
                            {...propsCampo('password', errors.password, ayudaClave)}
                            required
                            autoFocus={!!correo}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => escribir('password', e.target.value)}
                            onKeyDown={revisarMayusculas}
                            onKeyUp={revisarMayusculas}
                            onBlur={() => setMayusculas(false)}
                            className="h-11 rounded-lg pl-9"
                        />
                    </div>
                    <InputError id="password-error" message={errors.password} />
                    {/* Siempre presente (vacío si no aplica), para que el lector de pantalla anuncie el cambio */}
                    <p
                        id="password-mayus"
                        role="status"
                        className={mayusculas ? 'text-muted-foreground flex items-center gap-1.5 text-sm' : 'sr-only'}
                    >
                        {mayusculas && (
                            <>
                                <AlertTriangle className="text-warning size-4" aria-hidden="true" />
                                Bloq Mayús está activado.
                            </>
                        )}
                    </p>
                    {/* La guía del primer ingreso aparece donde se necesita: junto a la contraseña, cuando se escribió una cédula */}
                    {conCedula && (
                        <p id="password-primera" className="text-muted-foreground text-sm text-pretty">
                            ¿Primera vez? Escribe el código inicial que te dio tu coordinador.
                        </p>
                    )}
                </div>

                {/* Toda la fila se puede tocar, no solo la casilla */}
                <label htmlFor="remember" className="-my-1.5 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
                    <Checkbox id="remember" name="remember" checked={data.remember} onCheckedChange={(v) => setData('remember', v === true)} />
                    Mantener la sesión iniciada
                </label>

                <BotonEnviar
                    procesando={processing}
                    textoProcesando="Ingresando…"
                    aria-disabled={processing || bloqueado || undefined}
                    className={cn('h-11 w-full rounded-lg text-[0.95rem] font-semibold', bloqueado && 'aria-disabled:cursor-not-allowed')}
                >
                    {processing ? (
                        'Ingresando…'
                    ) : bloqueado ? (
                        <span>
                            Espera <span className="tabular-nums">{restante}</span> s
                        </span>
                    ) : (
                        'Ingresar'
                    )}
                </BotonEnviar>

                {/* Lejos del botón del ojo: un toque errado no saca de la página. Quien escribió su cédula llega directo a su camino */}
                {canResetPassword && (
                    <TextLink
                        href={route('password.request', conCedula ? { con: 'cedula' } : undefined)}
                        className="-mt-2 inline-flex min-h-11 items-center justify-self-center text-sm"
                    >
                        ¿Olvidaste tu contraseña?
                    </TextLink>
                )}
            </form>
        </AuthLayout>
    );
}
