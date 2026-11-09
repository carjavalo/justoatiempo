import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { BotonEnviar } from '@/components/boton-enviar';
import { AlertTriangle, At, LockKeyhole, Numpad, UserRound, XCircle } from '@/components/iconos';
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

function recordarModo(modo: Modo | null) {
    try {
        if (modo) localStorage.setItem(CLAVE_MODO, modo);
        else localStorage.removeItem(CLAVE_MODO);
    } catch {
        // Sin almacenamiento (navegación privada): el teclado queda el de siempre
    }
}

/** El ejemplo del primer campo, según el teclado que abre: cédula, correo o cualquiera de los dos (en un computador). */
const EJEMPLO = { numeric: 'Ej.: 1144123456', email: 'Ej.: nombre@correo.com', text: 'Ej.: 1144123456 o nombre@correo.com' } as const;

/** Un correo: lleva @. */
const esCorreo = (texto: string) => texto.includes('@');

/** Una cédula como se la escriba: solo números, con puntos, espacios o guiones ("ana.ruiz2" no lo es). */
const esCedula = (texto: string) => /^[\d\s.-]+$/.test(texto.trim()) && /\d/.test(texto);

/** Pantalla táctil: ahí el teclado lo pone el teléfono (en un computador no hay teclado que cambiar). */
const esTactil = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** "4:47" desde un minuto; "42 s" por debajo. */
const reloj = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`);

/** "5 minutos", "42 segundos": para el lector de pantalla. */
const enPalabras = (s: number) => {
    const minutos = Math.ceil(s / 60);
    return s >= 60 ? `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}` : `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
};

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
    // memoria (la primera vez casi siempre es un auxiliar). En el teléfono, un botón dentro del campo cambia entre ambos
    const [teclado, setTeclado] = useState<'numeric' | 'email' | 'text'>(() => {
        const modo = correo ? 'correo' : modoRecordado();
        if (modo === 'correo') return 'email';
        return modo === 'cedula' || esTactil() ? 'numeric' : 'text';
    });

    const conCorreo = esCorreo(data.email);
    const conCedula = esCedula(data.email);

    const restante = useCuentaRegresiva(Number(bloqueo ?? 0), bloqueo ? intentos : undefined);
    const bloqueado = restante > 0;
    // Durante el bloqueo, el tiempo va solo en el botón; el aviso dice a quién acudir. Al terminar, el aviso desaparece
    const ayudaBloqueo = conCorreo
        ? 'Si no recuerdas tu contraseña, usa «¿Olvidaste tu contraseña?».'
        : 'Si no recuerdas tu contraseña, pide un código nuevo a tu coordinador o al administrador.';
    const aviso = bloqueo ? (bloqueado ? `Hiciste demasiados intentos seguidos. ${ayudaBloqueo}` : null) : ingreso;
    const tiempo = () => `Podrás intentarlo de nuevo en ${enPalabras(restante)}.`;

    /**
     * Lo que el lector de pantalla debe oír ya. Se vacía y se vuelve a llenar, para que se anuncie aunque el texto sea el
     * mismo; unos segundos después se vacía otra vez: lo que sigue a la vista se lee con la contraseña, sin repetirse ni
     * quedar desactualizado (p. ej. con el tiempo del bloqueo).
     */
    const anunciar = (texto?: string | null) => {
        relojesAnuncio.current.forEach((r) => window.clearTimeout(r));
        setAnuncio('');
        if (!texto) return;
        relojesAnuncio.current = [window.setTimeout(() => setAnuncio(texto), 100), window.setTimeout(() => setAnuncio(''), 4000)];
    };

    // Al terminar el bloqueo no queda nada pendiente por anunciar (el aviso de fin lo da la región de estado)
    useEffect(() => {
        if (bloqueo && !bloqueado) anunciar(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bloqueado]);

    useEffect(() => () => relojesAnuncio.current.forEach((r) => window.clearTimeout(r)), []);

    // Tras cada intento fallido (no al corregir), el foco va al campo que falta o, si no, a la contraseña: es lo que
    // se vació y casi siempre lo que hay que volver a escribir
    useEffect(() => {
        if (!intentos) return;
        const campo = document.getElementById(errors.email ? 'email' : 'password');
        const yaEstaba = document.activeElement === campo;
        campo?.focus();
        // Si el foco cambió, el campo se lee con su error o con el aviso (está en su descripción). Si ya estaba ahí
        // (se envió con Enter), nada se lee solo: se anuncia. El tiempo del bloqueo se dice siempre: solo está en el botón
        if (bloqueo) anunciar(yaEstaba ? `${aviso} ${tiempo()}` : tiempo());
        else anunciar(yaEstaba ? (aviso ?? errors.email ?? errors.password) : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intentos]);

    /** Al corregir un campo, su error se va; el aviso del ingreso sigue a la vista hasta el próximo intento. */
    const escribir = (campo: 'email' | 'password', valor: string) => {
        setData(campo, valor);
        if (errors[campo]) clearErrors(campo);
    };

    const revisarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState('CapsLock'));

    /** Ida y vuelta entre el teclado de números y el de letras con «@» (el teclado cambia al volver a enfocar el campo). */
    const cambiarTeclado = () => {
        flushSync(() => setTeclado((t) => (t === 'email' ? 'numeric' : 'email')));
        document.getElementById('email')?.focus();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;
        // Durante el bloqueo, Enter no queda en silencio: se dice cuánto falta
        if (bloqueado) {
            anunciar(`Todavía no. ${tiempo()}`);
            return;
        }

        // Lo que falta o no tiene forma de correo ni de cédula se dice aquí mismo, sin ir al servidor (ni gastar un intento)
        const identificacion = data.email.trim();
        const errorUsuario = !identificacion
            ? 'Escribe tu correo o tu cédula.'
            : !esCorreo(identificacion) && !esCedula(identificacion)
              ? 'Escribe tu correo completo (con @) o tu número de cédula.'
              : null;
        if (errorUsuario || !data.password) {
            clearErrors();
            if (errorUsuario) setError('email', errorUsuario);
            if (!data.password) setError('password', 'Escribe tu contraseña.');
            setIntentos((n) => n + 1);
            return;
        }

        // El modo se recuerda solo si entra (si falla, vuelve el de antes). En un teléfono solo se recuerda la cédula:
        // si un coordinador entra con su correo en el teléfono de la cuadrilla, el siguiente auxiliar no hereda el teclado de letras
        const anterior = modoRecordado();
        const modo: Modo = conCorreo ? 'correo' : 'cedula';
        if (modo === 'cedula' || !tactil) recordarModo(modo);
        // Si entra, la plataforma se carga completa (AuthenticatedSessionController); si no, vuelve con el aviso
        post(route('login'), {
            onError: (fallo) => {
                recordarModo(anterior);
                // La contraseña se vacía tras un intento que no entró; si lo que faltaba era el correo o la cédula, se conserva
                if (!fallo.email) reset('password');
                setIntentos((n) => n + 1);
            },
        });
    };

    const ayudaClave = [aviso && 'ingreso-aviso', 'password-mayus', conCedula && 'password-primera'].filter(Boolean).join(' ');
    // En el teléfono, mientras no se haya escrito una cédula, el campo lleva el botón para cambiar de teclado
    const conBotonTeclado = tactil && teclado !== 'text' && !conCedula;

    return (
        <AuthLayout title="Iniciar sesión" volver={{ texto: 'Volver al sitio web', href: route('home') }}>
            <Head title="Iniciar sesión" />

            <MensajeEstado mensaje={status} />

            <form className="grid gap-5" onSubmit={submit} noValidate>
                {/* Con cada intento el aviso se vuelve a montar y destella un instante: un fallo igual al anterior también se nota */}
                {aviso && (
                    <div
                        key={intentos}
                        id="ingreso-aviso"
                        className="bg-critical-soft text-critical flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm font-medium motion-safe:animate-[aviso-nuevo_0.7s_ease-out]"
                    >
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
                            placeholder={EJEMPLO[teclado]}
                            value={data.email}
                            onChange={(e) => escribir('email', e.target.value)}
                            className={cn('h-11 rounded-lg pl-9', conBotonTeclado && 'pr-12')}
                        />
                        {/* Dentro del campo: aparecer o desaparecer no mueve nada. Nombre fijo + aria-pressed; el dibujo
                            muestra el teclado al que se pasa */}
                        {conBotonTeclado && (
                            <button
                                type="button"
                                onClick={cambiarTeclado}
                                aria-label="Teclado con @"
                                aria-pressed={teclado === 'email'}
                                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
                            >
                                {teclado === 'email' ? (
                                    <Numpad className="size-[1.1rem]" aria-hidden="true" />
                                ) : (
                                    <At className="size-[1.1rem]" aria-hidden="true" />
                                )}
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
                            placeholder="Escribe tu contraseña"
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

                {/* Solo con correo (cada quien en su propio equipo): con cédula, el teléfono puede ser de la cuadrilla y la
                    sesión no se guarda (LoginRequest). Toda la fila se puede tocar, no solo la casilla */}
                {conCorreo && (
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
                            Espera <span className="tabular-nums">{reloj(restante)}</span>
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
