import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { BotonEnviar } from '@/components/boton-enviar';
import { AlertTriangle, At, LockKeyhole, UserRound, XCircle } from '@/components/iconos';
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
    const [anuncio, setAnuncio] = useState('');
    const relojesAnuncio = useRef<number[]>([]);
    const [tactil] = useState(esTactil);
    // El teclado de números para quien entra con cédula: si la última vez fue con cédula o, en un teléfono, si no hay
    // memoria (la primera vez casi siempre es un auxiliar). Quien entra con correo tiene el botón «@» dentro del campo
    const [teclado, setTeclado] = useState<'numeric' | 'email' | 'text'>(() => {
        const modo = correo ? 'correo' : modoRecordado();
        if (modo === 'correo') return 'email';
        return modo === 'cedula' || esTactil() ? 'numeric' : 'text';
    });

    const restante = useCuentaRegresiva(Number(bloqueo ?? 0), bloqueo ? intentos : undefined);
    const bloqueado = restante > 0;
    // Durante el bloqueo, los segundos van solo en el botón; al terminar, el aviso desaparece y el botón vuelve a servir
    const aviso = bloqueo ? (bloqueado ? 'Hiciste demasiados intentos seguidos.' : null) : ingreso;
    const conTiempo = (texto: string) => `${texto} Podrás intentarlo de nuevo en ${restante} segundos.`;

    /**
     * Lo que el lector de pantalla debe oír ya (el fallo, el último intento, el bloqueo). Se vacía y se vuelve a llenar,
     * para que se anuncie aunque el texto sea el mismo; unos segundos después se vacía otra vez: el aviso visible queda
     * para leerlo, sin repetirse ni quedar desactualizado (p. ej. con los segundos del bloqueo).
     */
    const anunciar = (texto?: string | null) => {
        relojesAnuncio.current.forEach((reloj) => window.clearTimeout(reloj));
        setAnuncio('');
        if (!texto) return;
        relojesAnuncio.current = [window.setTimeout(() => setAnuncio(texto), 100), window.setTimeout(() => setAnuncio(''), 4000)];
    };

    // Al terminar el bloqueo no queda nada pendiente por anunciar (el aviso de fin lo da la región de estado)
    useEffect(() => {
        if (bloqueo && !bloqueado) anunciar(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bloqueado]);

    useEffect(() => () => relojesAnuncio.current.forEach((reloj) => window.clearTimeout(reloj)), []);

    // Tras cada intento fallido (no al corregir), el foco va al campo que falta o, si no, a la contraseña: es lo que
    // se vació y casi siempre lo que hay que volver a escribir
    useEffect(() => {
        if (!intentos) return;
        const campo = document.getElementById(errors.email ? 'email' : 'password');
        const yaEstaba = document.activeElement === campo;
        campo?.focus();
        // Al enviar con Enter el foco ya está ahí y nada se anuncia solo: el aviso se dice siempre; el error de un campo,
        // cuando el foco no cambió (si cambió, el campo se lee con su error)
        anunciar(bloqueo ? conTiempo('Hiciste demasiados intentos seguidos.') : (aviso ?? (yaEstaba ? (errors.email ?? errors.password) : null)));
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
        // (el modo se recuerda al ingresar, no aquí: quien solo lo toca no ha entrado con correo)
        flushSync(() => setTeclado('email'));
        document.getElementById('email')?.focus();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        // Durante el bloqueo, Enter no queda en silencio: se dice cuánto falta
        if (bloqueado) {
            anunciar(conTiempo('Todavía no.'));
            return;
        }

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
            onError: (fallo) => {
                // La contraseña se vacía tras un intento que no entró; si lo que faltaba era el correo o la cédula, se conserva
                if (!fallo.email) reset('password');
                setIntentos((n) => n + 1);
            },
        });
    };

    const conCedula = esCedula(data.email);
    const ayudaClave = ['password-mayus', conCedula && 'password-primera'].filter(Boolean).join(' ');
    // El teclado de números no tiene «@»: mientras no se haya escrito una cédula, un botón dentro del campo lo cambia
    const cambiarTeclado = tactil && teclado === 'numeric' && !conCedula;

    return (
        <AuthLayout title="Iniciar sesión" volver={{ texto: 'Volver al sitio web', href: route('home') }}>
            <Head title="Iniciar sesión" />

            <MensajeEstado mensaje={status} />

            <form className="grid gap-5" onSubmit={submit} noValidate>
                {aviso && (
                    <div className="bg-critical-soft text-critical flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm font-medium">
                        <XCircle className="mt-0.5 size-4" aria-hidden="true" />
                        <p>{aviso}</p>
                    </div>
                )}
                {/* Siempre montada: lo que se escribe aquí se anuncia de inmediato (la cuenta regresiva no pasa por aquí) */}
                <p role="alert" className="sr-only">
                    {anuncio}
                </p>
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
                            className={cn('h-11 rounded-lg pl-9', cambiarTeclado && 'pr-12')}
                        />
                        {/* Dentro del campo: aparecer o desaparecer no mueve nada de la pantalla */}
                        {cambiarTeclado && (
                            <button
                                type="button"
                                onClick={usarCorreo}
                                aria-label="Escribir un correo (teclado con @)"
                                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                            >
                                <At className="size-[1.1rem]" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <InputError id="email-error" message={errors.email} />
                    <p id="email-ayuda" className="text-muted-foreground text-sm">
                        Si usas tu cédula, escríbela con o sin puntos.
                    </p>
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
                            ¿Primera vez? Escribe el código inicial que te dio tu coordinador o el administrador.
                        </p>
                    )}
                </div>

                {/* Solo para quien entra con correo (en su propio equipo): con cédula, el teléfono puede ser de la cuadrilla y
                    la sesión no se guarda (LoginRequest). Toda la fila se puede tocar, no solo la casilla */}
                {!conCedula && (
                    <label htmlFor="remember" className="-my-1.5 flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm">
                        <Checkbox id="remember" name="remember" checked={data.remember} onCheckedChange={(v) => setData('remember', v === true)} />
                        Mantener la sesión iniciada
                    </label>
                )}

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
                        className="inline-flex min-h-11 items-center justify-self-center text-sm"
                    >
                        ¿Olvidaste tu contraseña?
                    </TextLink>
                )}
            </form>
        </AuthLayout>
    );
}
