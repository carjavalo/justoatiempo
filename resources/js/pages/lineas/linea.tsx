import { EstadoBadge } from '@/components/admin/piezas';
import { Building2, LayoutGrid, MapPinned, UsersRound } from '@/components/iconos';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { SERVICIOS } from '@/lib/portafolio';
import { usePuede } from '@/hooks/use-puede';
import { Link } from '@inertiajs/react';

interface Empresa {
    id: number;
    nombre: string;
    activo: boolean;
    sedes: number;
    sucursales: number;
    personas: number;
}

interface Props {
    linea: { id: number; slug: string; nombre: string };
    empresas: Empresa[];
    /** Personas activas de la línea por rol de la empresa ("Conductor", "Auxiliar operativo"…). */
    personal: { rol: string; total: number }[];
    /** Si su rol edita empresas (para asignarles la línea) y ve los usuarios. */
    puedeEmpresas: boolean;
    puedeUsuarios: boolean;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const claseEnlace = 'text-primary focus-visible:ring-ring rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden';

/**
 * Línea de servicio que aún no tiene tablero propio: muestra a quién se le presta (empresas, sedes y sucursales)
 * y con qué personal. El tablero se agrega cuando se defina cómo controla su operación.
 */
export default function Linea({ linea, empresas, personal, puedeEmpresas, puedeUsuarios }: Props) {
    const servicio = SERVICIOS.find((s) => s.id === linea.slug);
    const totalPersonas = personal.reduce((suma, p) => suma + p.total, 0);
    // Lo que su rol le deja registrar mientras la línea no tiene tablero
    const puede = usePuede();
    const registrables = [
        puede('empresas.crear') && 'empresas',
        puede('sedes.crear') && 'sedes',
        puede('sucursales.crear') && 'sucursales',
        puede('usuarios.crear') && 'personal',
    ].filter(Boolean) as string[];
    const listaRegistrables = registrables.length > 1 ? `${registrables.slice(0, -1).join(', ')} y ${registrables.at(-1)}` : registrables[0];

    return (
        <MarcoLinea slug={linea.slug} nombre={linea.nombre} titulo={linea.nombre}>
            {servicio && <p className="text-muted-foreground -mt-2 max-w-3xl text-sm leading-relaxed md:text-base">{servicio.descripcion}</p>}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                {/* Empresas que reciben la línea */}
                <section aria-labelledby="titulo-empresas" className="bg-card rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
                        <h2 id="titulo-empresas" className="flex items-center gap-2 text-base font-bold">
                            <Building2 className="text-primary size-5" aria-hidden="true" />
                            Empresas
                        </h2>
                        {puedeEmpresas && (
                            <Link href={route('empresas.index')} className={`${claseEnlace} text-sm`}>
                                Asignar empresas
                            </Link>
                        )}
                    </header>
                    {empresas.length === 0 ? (
                        <p className="text-muted-foreground px-5 py-8 text-sm">
                            Ninguna empresa recibe esta línea todavía.{puedeEmpresas && ' Márcala en el formulario de la empresa, en «Líneas de servicio que recibe».'}
                        </p>
                    ) : (
                        <ul role="list" className="divide-y">
                            {empresas.map((e) => (
                                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">{e.nombre}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {plural(e.sedes, 'sede', 'sedes')} · {plural(e.sucursales, 'sucursal', 'sucursales')} · {plural(e.personas, 'persona', 'personas')} en esta línea
                                        </p>
                                    </div>
                                    <EstadoBadge activo={e.activo} femenino />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="flex flex-col gap-5">
                    {/* Personal de la línea */}
                    <section aria-labelledby="titulo-personal" className="bg-card rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 id="titulo-personal" className="flex items-center gap-2 text-base font-bold">
                                <UsersRound className="text-primary size-5" aria-hidden="true" />
                                Personal
                            </h2>
                            {puedeUsuarios && totalPersonas > 0 && (
                                <Link href={route('usuarios.index', { linea: linea.id })} className={`${claseEnlace} text-sm`}>
                                    Ver personas
                                </Link>
                            )}
                        </div>
                        {personal.length === 0 && <p className="text-muted-foreground mt-3 text-sm">Aún no hay personas activas en esta línea.</p>}
                        <dl className="mt-4 grid grid-cols-2 gap-3 empty:hidden">
                            {personal.map((p) => (
                                <div key={p.rol} className="bg-muted/60 rounded-xl px-4 py-3">
                                    <dt className="text-muted-foreground truncate text-xs" title={p.rol}>
                                        {p.rol}
                                    </dt>
                                    <dd className="text-2xl font-extrabold tabular-nums">{p.total}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    {/* Tablero pendiente */}
                    <section aria-labelledby="titulo-tablero" className="border-primary/25 bg-secondary/50 rounded-2xl border border-dashed p-5">
                        <h2 id="titulo-tablero" className="flex items-center gap-2 text-base font-bold">
                            <LayoutGrid className="text-primary size-5" aria-hidden="true" />
                            Tablero por definir
                        </h2>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                            Cuando definamos cómo controla esta línea su operación (turnos, novedades, insumos, evidencias…), aquí tendrá su tablero por empresa,
                            como el de servicios logísticos.
                        </p>
                        {listaRegistrables && (
                            <p className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                                <MapPinned className="size-4" aria-hidden="true" />
                                Mientras tanto ya puedes registrar sus {listaRegistrables}.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </MarcoLinea>
    );
}
