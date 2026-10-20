import { Iniciales } from '@/components/admin/piezas';
import { EnlaceVolver } from '@/components/enlace-volver';
import { AlertTriangle, Building2, CheckCircle2, FileText, Layers, MapPinned, XCircle } from '@/components/iconos';
import LogoMarca from '@/components/logo-marca';
import { aFecha } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';

interface Vigente {
    vigente: true;
    nombre: string;
    cedula: string | null;
    cargo: string;
    email: string;
    /** Dónde presta el servicio hoy (todos son personal de Justo a Tiempo): cada empresa con su sede, sucursal y líneas. */
    asignaciones: { empresa: string | null; sede: string | null; sucursal: string | null; lineas: string[]; hasta: string | null }[];
    foto: string | null;
    arl: { url: string; pdf: boolean; subida: string | null } | null;
}

type Props = Vigente | { vigente: false; nombre: string };

const fechaLarga = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

/**
 * Lo que se ve al escanear el QR de un carnet (página pública, pensada para el celular de quien controla el
 * ingreso, p. ej. la portería de un cliente): quién es la persona, dónde trabaja y su certificado de ARL. Si el
 * carnet ya no está vigente, solo se dice eso.
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
        { titulo: 'Correo', valor: p.email },
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

            {/* Dónde presta el servicio: lo primero que busca quien controla el ingreso */}
            <section aria-labelledby="titulo-asignacion" className="border-primary/25 bg-secondary/50 mt-6 rounded-2xl border p-4">
                <h2 id="titulo-asignacion" className="text-xs font-bold tracking-[0.12em] uppercase">
                    Presta el servicio en
                </h2>
                {p.asignaciones.length === 0 ? (
                    <p className="text-muted-foreground mt-3 text-sm">Hoy no tiene asignaciones vigentes.</p>
                ) : (
                    <ul role="list" className="mt-3 grid gap-3">
                        {p.asignaciones.map((a, i) => (
                            <li key={i} className="bg-card rounded-xl border p-3.5">
                                <div className="flex items-start gap-3">
                                    <span className="bg-brand-navy-deep flex size-10 shrink-0 items-center justify-center rounded-xl">
                                        <Building2 className="text-brand-coral-on-dark size-5" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-lg leading-tight font-extrabold break-words">{a.empresa ?? 'Todas las empresas de su línea'}</p>
                                        {(a.sede || a.sucursal) && (
                                            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                                                <MapPinned className="size-4 shrink-0" aria-hidden="true" />
                                                {[a.sede, a.sucursal].filter(Boolean).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <ul role="list" aria-label="Líneas de servicio" className="mt-3 flex flex-wrap gap-1.5">
                                    {a.lineas.map((l) => (
                                        <li key={l} className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
                                            <Layers className="text-primary size-3.5" aria-hidden="true" />
                                            {l}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-muted-foreground mt-2 text-xs">{a.hasta ? `Asignado hasta el ${fechaLarga.format(aFecha(a.hasta))}` : 'Asignación indefinida'}</p>
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
