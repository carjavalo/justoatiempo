import { EnlaceVolver } from '@/components/enlace-volver';
import { AlertTriangle, Clock3, Hammer, LockKeyhole, Map as Mapa, type TipoIcono } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { type Volver } from '@/types';
import { Head } from '@inertiajs/react';

interface Props {
    estado: number;
    /** Motivo concreto (p. ej. "Esta herramienta es de otra línea de servicio."). */
    mensaje: string | null;
    /** Sin sesión: visitante del sitio público, al que se trata de usted. */
    publico: boolean;
    volver: Volver;
}

interface Texto {
    titulo: string;
    /** Para quien usa la plataforma (tuteo). */
    detalle: string;
    /** Para un visitante del sitio público (usted); si falta, el detalle sirve igual. */
    detallePublico?: string;
    icono: TipoIcono;
}

const TEXTOS: Record<number, Texto> = {
    403: { titulo: 'No tienes acceso a esta página', detalle: 'Tu usuario no tiene permiso para ver esta sección.', icono: LockKeyhole },
    404: {
        titulo: 'No encontramos esta página',
        detalle: 'Puede que la dirección esté mal escrita o que la página ya no exista.',
        icono: Mapa,
    },
    405: {
        titulo: 'Esta dirección no se abre directamente',
        detalle: 'Corresponde a una acción de un formulario. Vuelve y hazla desde allí.',
        detallePublico: 'Corresponde a una acción de un formulario. Vuelva e inténtelo desde allí.',
        icono: Mapa,
    },
    409: { titulo: 'Esta acción ya no se puede hacer', detalle: 'Alguien ya la hizo o el registro cambió mientras lo veías.', icono: AlertTriangle },
    429: {
        titulo: 'Demasiados intentos seguidos',
        detalle: 'Espera un minuto y vuelve a intentarlo.',
        detallePublico: 'Espere un minuto e inténtelo de nuevo.',
        icono: Clock3,
    },
    500: {
        titulo: 'Algo falló de nuestro lado',
        detalle: 'Intenta de nuevo en unos minutos. Si sigue pasando, avísale al administrador.',
        detallePublico: 'Intente de nuevo en unos minutos. Si el problema continúa, escríbanos desde el formulario de contacto.',
        icono: AlertTriangle,
    },
    503: {
        titulo: 'Estamos en mantenimiento',
        detalle: 'La plataforma vuelve a estar disponible en unos minutos.',
        detallePublico: 'El sitio vuelve a estar disponible en unos minutos.',
        icono: Hammer,
    },
};

/** Títulos que tutean y que, para el sitio público, se dicen de usted. */
const TITULOS_PUBLICOS: Partial<Record<number, string>> = { 403: 'No tiene acceso a esta página' };

/**
 * Página de error. Funciona aun sin sesión (p. ej. el sitio público en mantenimiento): por eso no usa la
 * plantilla con barra superior y recibe a dónde volver desde el servidor.
 */
export default function PaginaError({ estado, mensaje, publico, volver }: Props) {
    const texto = TEXTOS[estado] ?? TEXTOS[500];
    const Icono = texto.icono;
    const titulo = (publico && TITULOS_PUBLICOS[estado]) || texto.titulo;

    return (
        <>
            <Head title={titulo} />
            <main id="contenido" tabIndex={-1} className="bg-background flex min-h-svh items-center justify-center p-6 outline-none">
                <div className="w-full max-w-md">
                    <div className="mb-10 flex items-center gap-3">
                        <LogoMarca className="size-12 rounded-xl" />
                        <span className="leading-tight">
                            <span className="block text-[0.95rem] font-extrabold tracking-tight">Justo a Tiempo SP</span>
                            {!publico && (
                                <span className="text-muted-foreground block text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                                    Plataforma de gestión
                                </span>
                            )}
                        </span>
                    </div>

                    <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                        <Icono className="size-7" aria-hidden="true" />
                    </span>
                    <p className="text-brand-coral-ink mt-6 text-xs font-bold tracking-[0.16em] uppercase">Error {estado}</p>
                    <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-balance md:text-[1.75rem]">{titulo}</h1>
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed md:text-base">
                        {mensaje ?? (publico ? (texto.detallePublico ?? texto.detalle) : texto.detalle)}
                    </p>

                    <EnlaceVolver {...volver} className="mt-8" />
                </div>
            </main>
        </>
    );
}
