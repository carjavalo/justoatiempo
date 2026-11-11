import { Iniciales } from '@/components/admin/piezas';
import { EnlaceVolver } from '@/components/enlace-volver';
import { AlertTriangle, CheckCircle2, FileText, Layers, XCircle } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';

interface Vigente {
    vigente: true;
    nombre: string;
    cedula: string | null;
    cargo: string;
    rh: string | null;
    eps: string | null;
    /** La ARL a la que está afiliada ("SURA"); el certificado va aparte. */
    entidadArl: string | null;
    /** Las líneas de servicio que hace hoy, como en la franja del carnet (sin la empresa). */
    lineas: string[];
    foto: string | null;
    arl: { url: string; pdf: boolean; subida: string | null } | null;
}

type Props = Vigente | { vigente: false; nombre: string };

const fechaLarga = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

/**
 * Lo que se ve al escanear el QR de un carnet (página pública, pensada para el celular de quien controla el
 * ingreso, p. ej. la portería de un cliente): lo mismo que dice el carnet (quién es, su cargo, su línea, su cédula,
 * su RH, su EPS y su ARL) y su certificado de ARL. Si el carnet ya no está vigente, solo se dice eso.
 */
export default function VerificarCarnet(props: Props) {
    return (
        <>
            <Head title="Verificación de carnet">
                <meta name="robots" content="noindex" />
            </Head>

            <main id="contenido" className="bg-background flex min-h-svh flex-col items-center gap-6 px-4 py-8 sm:py-12">
                <article className="bg-card w-full max-w-md overflow-hidden rounded-3xl border shadow-[var(--sombra-elevada)]">
                    <header className="bg-brand-navy-deep flex items-center gap-3 px-5 py-4 text-white">
                        <LogoMarca alt="" className="size-12 rounded-xl p-1" />
                        <div className="leading-tight">
                            <p className="font-extrabold">Justo a Tiempo SP S.A.S</p>
                            <p className="text-brand-coral-on-dark text-xs font-bold tracking-[0.14em] uppercase">Verificación de carnet</p>
                        </div>
                    </header>

                    {props.vigente ? <Datos persona={props} /> : <NoVigente nombre={props.nombre} />}
                </article>

                <EnlaceVolver texto="Ir al sitio web de Justo a Tiempo SP" href="/" />
            </main>
        </>
    );
}

function Estado({ vigente }: { vigente: boolean }) {
    const Icono = vigente ? CheckCircle2 : XCircle;
    return (
        <p
            className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold',
                vigente ? 'bg-good-soft text-good' : 'bg-critical-soft text-critical',
            )}
        >
            <Icono className="size-4" aria-hidden="true" />
            {vigente ? 'Carnet vigente' : 'Carnet no vigente'}
        </p>
    );
}

function NoVigente({ nombre }: { nombre: string }) {
    return (
        <div className="flex flex-col items-center px-6 py-8 text-center">
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance">{nombre}</h1>
            <div className="mt-4">
                <Estado vigente={false} />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
                Esta persona ya no hace parte del equipo de Justo a Tiempo SP S.A.S. Si tiene dudas, comuníquese con la empresa.
            </p>
        </div>
    );
}

function Datos({ persona: p }: { persona: Vigente }) {
    const filas = [
        { titulo: 'Cédula', valor: p.cedula ? `C.C. ${Number(p.cedula).toLocaleString('es-CO')}` : null },
        { titulo: 'RH', valor: p.rh },
        { titulo: 'EPS', valor: p.eps },
        { titulo: 'ARL', valor: p.entidadArl },
    ].filter((f) => f.valor);

    return (
        <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col items-center text-center">
                {p.foto ? (
                    <img
                        src={p.foto}
                        alt={`Foto de ${p.nombre}`}
                        className="ring-brand-coral/70 size-32 rounded-full bg-[#eceef3] object-cover object-[50%_20%] ring-4"
                    />
                ) : (
                    <Iniciales texto={p.nombre} className="size-28 rounded-full text-3xl" />
                )}
                <h1 className="mt-4 text-2xl leading-tight font-extrabold tracking-tight text-balance">{p.nombre}</h1>
                <p className="text-muted-foreground mt-1">{p.cargo}</p>
                <div className="mt-4">
                    <Estado vigente />
                </div>
            </div>

            {/* Su línea, como en la franja del carnet: lo primero que busca quien controla el ingreso */}
            <section aria-labelledby="titulo-linea" className="border-primary/25 bg-secondary/50 mt-6 rounded-2xl border p-4">
                <h2 id="titulo-linea" className="text-xs font-bold tracking-[0.12em] uppercase">
                    {p.lineas.length > 1 ? 'Líneas de servicio' : 'Línea de servicio'}
                </h2>
                {p.lineas.length === 0 ? (
                    <p className="text-muted-foreground mt-3 text-sm">Hoy no tiene una línea asignada.</p>
                ) : (
                    <ul role="list" className="mt-3 grid gap-2.5">
                        {p.lineas.map((l) => (
                            <li key={l} className="flex items-center gap-3">
                                <span className="bg-brand-navy-deep flex size-10 shrink-0 items-center justify-center rounded-xl">
                                    <Layers className="text-brand-coral-on-dark size-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 text-lg leading-tight font-extrabold break-words">{l}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <dl className="mt-4 divide-y rounded-2xl border">
                {filas.map((f) => (
                    <div key={f.titulo} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-sm">
                        <dt className="text-muted-foreground">{f.titulo}</dt>
                        <dd className="min-w-0 font-semibold break-words">{f.valor}</dd>
                    </div>
                ))}
            </dl>

            <section aria-labelledby="titulo-arl" className="mt-6">
                <h2 id="titulo-arl" className="text-sm font-bold tracking-[0.12em] uppercase">
                    Certificado de ARL
                </h2>
                {p.arl ? (
                    <div className="mt-3">
                        {p.arl.pdf ? (
                            <a
                                href={p.arl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-accion text-accion-foreground focus-visible:ring-ring flex h-12 items-center justify-center gap-2 rounded-xl font-semibold focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-hidden"
                            >
                                <FileText className="size-5" aria-hidden="true" />
                                Ver certificado (PDF)
                                <span className="sr-only"> (se abre en otra pestaña)</span>
                            </a>
                        ) : (
                            <a
                                href={p.arl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="focus-visible:ring-ring block overflow-hidden rounded-xl border focus-visible:ring-2 focus-visible:outline-hidden"
                            >
                                <img src={p.arl.url} alt={`Certificado de ARL de ${p.nombre}`} className="w-full" />
                                <span className="sr-only"> (se abre en otra pestaña para verlo en grande)</span>
                            </a>
                        )}
                        {p.arl.subida && (
                            <p className="text-muted-foreground mt-2 text-xs">Cargado el {fechaLarga.format(new Date(p.arl.subida))}.</p>
                        )}
                    </div>
                ) : (
                    <p className="bg-warning-soft mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
                        <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        No tiene certificado de ARL cargado en la plataforma.
                    </p>
                )}
            </section>
        </div>
    );
}
