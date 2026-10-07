import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Building2, LayoutGrid, Lightbulb, type TipoIcono, MapPinned, UsersRound } from '@/components/iconos';

interface Resumen {
    usuarios: { total: number; activos: number };
    sedes: { total: number; activas: number; propias: number };
    empresas: { total: number; activas: number };
}

interface Props {
    resumen?: Resumen;
    asignacion?: { empresa: string | null; sede: string | null };
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

function saludo(): string {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

/** Inicio de la plataforma: las opciones del administrador, en el orden en que se pidieron. */
export default function Panel({ resumen, asignacion }: Props) {
    const { auth } = usePage<SharedData>().props;
    const primerNombre = auth.user.name.split(' ')[0];

    return (
        <AppLayout>
            <Head title="Panel" />

            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8">
                <header>
                    <p className="text-brand-coral-ink text-xs font-bold tracking-[0.16em] uppercase first-letter:uppercase">{formatoFecha.format(new Date())}</p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                        {saludo()}, {primerNombre}
                    </h1>
                    {resumen && <p className="text-muted-foreground mt-2 text-base">¿Qué quieres gestionar hoy?</p>}
                </header>

                {resumen ? <OpcionesAdmin resumen={resumen} /> : <SinOpciones asignacion={asignacion} />}
            </div>
        </AppLayout>
    );
}

function OpcionesAdmin({ resumen }: { resumen: Resumen }) {
    const { usuarios, sedes, empresas } = resumen;
    const opciones: { id: string; titulo: string; texto: string; href: string; icono: TipoIcono; dato: string }[] = [
        {
            id: 'usuarios',
            titulo: 'Usuarios',
            texto: 'Crea accesos y asigna a cada persona su rol, empresa y sede.',
            href: route('usuarios.index'),
            icono: UsersRound,
            dato: usuarios.total ? plural(usuarios.activos, 'usuario activo', 'usuarios activos') : 'Aún no hay usuarios',
        },
        {
            id: 'sedes',
            titulo: 'Sedes',
            texto: 'Registra las sedes de las empresas clientes y las sedes propias.',
            href: route('sedes.index'),
            icono: MapPinned,
            dato: sedes.total ? `${plural(sedes.activas, 'sede activa', 'sedes activas')} · ${plural(sedes.propias, 'propia', 'propias')}` : 'Aún no hay sedes',
        },
        {
            id: 'empresas',
            titulo: 'Empresas',
            texto: 'Da de alta a las empresas clientes con su NIT y su contacto.',
            href: route('empresas.index'),
            icono: Building2,
            dato: empresas.total ? plural(empresas.activas, 'empresa activa', 'empresas activas') : 'Aún no hay empresas',
        },
    ];

    return (
        <section aria-labelledby="titulo-opciones" className="flex flex-col gap-5">
            <h2 id="titulo-opciones" className="sr-only">
                Opciones de administración
            </h2>
            <ul role="list" className="grid gap-5 md:grid-cols-3">
                {opciones.map(({ id, titulo, texto, href, icono: Icono, dato }) => (
                    <li
                        key={id}
                        className={cn(
                            'group bg-card relative isolate flex flex-col overflow-hidden rounded-3xl border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all md:p-7',
                            'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[var(--sombra-elevada)]',
                            'has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/25',
                        )}
                    >
                        {/* Ícono grande de fondo: decorativo */}
                        <Icono className="text-primary/[0.05] absolute -right-6 -bottom-6 -z-10 size-40 transition-transform group-hover:scale-105" strokeWidth={1.2} aria-hidden="true" />
                        <span className="bg-brand-navy-deep flex size-14 items-center justify-center rounded-2xl shadow-md">
                            <Icono className="text-brand-coral-on-dark size-8" aria-hidden="true" />
                        </span>
                        <h3 className="mt-6 text-xl font-extrabold tracking-tight">
                            {/* El enlace cubre toda la tarjeta (::after), pero su nombre es solo el título */}
                            <Link href={href} prefetch aria-describedby={`opcion-${id}`} className="outline-hidden after:absolute after:inset-0 after:content-['']">
                                {titulo}
                            </Link>
                        </h3>
                        <p id={`opcion-${id}`} className="text-muted-foreground mt-2 text-sm leading-relaxed">
                            {texto}
                        </p>
                        <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
                            <span className="text-sm font-semibold">{dato}</span>
                            <ArrowRight className="text-primary size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </div>
                    </li>
                ))}
            </ul>

            {empresas.total === 0 && (
                <p className="bg-secondary/60 text-secondary-foreground flex items-start gap-3 rounded-2xl px-5 py-4 text-sm">
                    <Lightbulb className="text-brand-coral-ink mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <span>
                        <strong className="font-semibold">Para empezar:</strong> registra primero las empresas, luego sus sedes y por último los usuarios, así podrás asignarle a
                        cada persona su empresa y su sede.
                    </span>
                </p>
            )}
        </section>
    );
}

function SinOpciones({ asignacion }: { asignacion?: Props['asignacion'] }) {
    return (
        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <section aria-labelledby="titulo-asignacion" className="bg-card rounded-3xl border p-6">
                <h2 id="titulo-asignacion" className="text-sm font-bold tracking-[0.14em] uppercase">
                    Tu asignación
                </h2>
                <dl className="mt-4 grid gap-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground text-xs">Empresa</dt>
                        <dd className="font-semibold">{asignacion?.empresa ?? 'Justo a Tiempo SP'}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Sede</dt>
                        <dd className="font-semibold">{asignacion?.sede ?? 'Sin sede asignada'}</dd>
                    </div>
                </dl>
            </section>
            <section className="bg-card flex flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center">
                <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                    <LayoutGrid className="size-7" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-extrabold tracking-tight">Pronto verás aquí tus líneas de servicio</h2>
                <p className="text-muted-foreground mt-1.5 max-w-md text-sm">Cuando el administrador habilite las categorías, desde este panel entrarás a cada una.</p>
            </section>
        </div>
    );
}
