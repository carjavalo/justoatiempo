import { Campo } from '@/components/admin/campo';
import { claseTd, claseTh, contenedorModulo, EncabezadoModulo, Tabla } from '@/components/admin/piezas';
import { AlertTriangle, FileSpreadsheet, Info, LoaderCircle, UploadCloud, UsersRound, XCircle } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Head, router, usePage } from '@inertiajs/react';
import { type DragEvent, useRef, useState } from 'react';

type Accion = 'nueva' | 'completa' | 'igual' | 'error';

interface FilaImportacion {
    fila: number;
    accion: Accion;
    nombre: string;
    cedula: string | null;
    cargo: string | null;
    ciudad: string | null;
    telefono: string | null;
    email: string | null;
    fecha_ingreso: string | null;
    operacion: string | null;
    empresaId: number | null;
    /** Los datos que se le completan a quien ya estaba registrado. */
    completa: string[];
    errores: string[];
    avisos: string[];
}

interface Revision {
    archivo: string;
    /** Identifica el archivo revisado: se confirma este mismo (no otro subido en otra pestaña). */
    token: string;
    filas: FilaImportacion[];
    /** Cada valor de la columna "operación" y la empresa a la que corresponde. */
    operaciones: { clave: string; valor: string; empresaId: number | null; sugerida: boolean; personas: number }[];
    resumen: Record<Accion, number>;
}

interface Props {
    revision: Revision | null;
    roles: { id: number; nombre: string; resumen: string }[];
    rolPorDefecto: number | null;
    /** asignable: quien importa puede asignar personas a ella (permiso y alcance). */
    empresas: { id: number; nombre: string; lineas: number; asignable: boolean }[];
    /** Si su rol crea asignaciones: las personas nuevas quedan asignadas a su empresa. */
    puedeAsignar: boolean;
}

const EXTENSIONES = '.xlsx,.xls,.csv';

const COLUMNAS = [
    ['CÉDULA', 'obligatoria'],
    ['PRIMER NOMBRE y SEGUNDO NOMBRE', 'o una sola columna NOMBRES'],
    ['PRIMER APELLIDO y SEGUNDO APELLIDO', 'o una sola columna APELLIDOS'],
    ['CARGO', 'como va en el carnet'],
    ['OPERACIÓN', 'la empresa donde presta el servicio'],
    ['CIUDAD, TELÉFONO y CORREO', ''],
    ['FECHA NACIMIENTO y FECHA DE INGRESO', ''],
];

const CAMPOS: Record<string, string> = {
    cargo: 'cargo',
    ciudad: 'ciudad',
    telefono: 'teléfono',
    email: 'correo',
    fecha_nacimiento: 'nacimiento',
    fecha_ingreso: 'ingreso',
    segundo_apellido: 'segundo apellido',
};

const ACCIONES: Record<Accion, { texto: string; clase: string }> = {
    nueva: { texto: 'Nueva', clase: 'bg-good-soft text-good' },
    completa: { texto: 'Se completa', clase: 'bg-secondary text-secondary-foreground' },
    igual: { texto: 'Sin cambios', clase: 'bg-muted text-muted-foreground' },
    error: { texto: 'No se importa', clase: 'bg-critical-soft text-critical' },
};

const plural = (n: number, uno: string, varios: string) => `${fmt.numero(n)} ${n === 1 ? uno : varios}`;

export default function ImportarPersonal({ revision, roles, rolPorDefecto, empresas, puedeAsignar }: Props) {
    return (
        <AppLayout volver={{ texto: 'Volver a Usuarios', href: route('usuarios.index') }}>
            <Head title="Importar personal" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Importar personal"
                    descripcion="Sube el Excel del personal (como «Auxiliares activos»). Cada persona queda en Usuarios con su carnet y sin acceso a la plataforma; a quien ya estaba registrado solo se le completan los datos que le falten."
                />

                {revision ? (
                    <RevisionArchivo
                        revision={revision}
                        roles={roles}
                        rolPorDefecto={rolPorDefecto}
                        empresas={empresas}
                        puedeAsignar={puedeAsignar}
                    />
                ) : (
                    <SubirArchivo />
                )}
            </div>
        </AppLayout>
    );
}

function SubirArchivo() {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [procesando, setProcesando] = useState(false);
    const [arrastrando, setArrastrando] = useState(false);
    const [nombre, setNombre] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);

    // Elegir el archivo ya es la intención de revisarlo: se envía de inmediato
    const subir = (archivo: File | undefined) => {
        if (!archivo) return;
        setNombre(archivo.name);
        router.post(
            route('usuarios.importar.revisar'),
            { archivo },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => {
                    setProcesando(false);
                    if (input.current) input.current.value = '';
                },
            },
        );
    };

    const soltar = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setArrastrando(false);
        subir(e.dataTransfer.files?.[0]);
    };

    return (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
                <input
                    ref={input}
                    id="archivo"
                    type="file"
                    accept={EXTENSIONES}
                    className="peer sr-only"
                    disabled={procesando}
                    aria-describedby="archivo-ayuda archivo-error"
                    onChange={(e) => subir(e.target.files?.[0])}
                />
                <label
                    htmlFor="archivo"
                    onDragOver={(e) => {
                        e.preventDefault();
                        setArrastrando(true);
                    }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={soltar}
                    className={cn(
                        'bg-card flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                        'peer-focus-visible:border-ring peer-focus-visible:ring-ring/25 peer-focus-visible:border-solid peer-focus-visible:ring-[3px]',
                        'hover:border-primary/50 hover:bg-secondary/40',
                        arrastrando && 'border-brand-coral bg-brand-coral-soft/40',
                        procesando && 'pointer-events-none',
                        errors.archivo && 'border-critical/60',
                    )}
                >
                    {procesando ? (
                        <>
                            <LoaderCircle className="text-primary size-10 motion-safe:animate-spin" aria-hidden="true" />
                            <span className="text-base font-bold">Leyendo {nombre}…</span>
                        </>
                    ) : (
                        <>
                            <span className="bg-secondary text-primary flex size-14 items-center justify-center rounded-2xl">
                                <UploadCloud className="size-7" aria-hidden="true" />
                            </span>
                            <span className="text-base font-bold">
                                Arrastra aquí el Excel del personal o{' '}
                                <span className="text-primary underline underline-offset-4">elige el archivo</span>
                            </span>
                            <span id="archivo-ayuda" className="text-muted-foreground text-xs">
                                Excel (.xlsx, .xls) o CSV · máximo 5 MB. Antes de importar verás qué pasará con cada persona.
                            </span>
                        </>
                    )}
                </label>
                <div id="archivo-error" aria-live="polite">
                    {errors.archivo && (
                        <p className="text-critical mt-3 flex items-center gap-2 text-sm font-medium">
                            <XCircle className="size-4 shrink-0" aria-hidden="true" />
                            {errors.archivo}
                        </p>
                    )}
                </div>
            </div>

            <section aria-labelledby="titulo-columnas" className="bg-card rounded-2xl border p-5">
                <h2 id="titulo-columnas" className="flex items-center gap-2 text-sm font-bold">
                    <FileSpreadsheet className="text-primary size-5" aria-hidden="true" />
                    Columnas que se reconocen
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                    Los encabezados pueden estar en cualquier orden y en cualquiera de las primeras filas.
                </p>
                <ul role="list" className="mt-3 grid gap-2 text-sm">
                    {COLUMNAS.map(([columna, detalle]) => (
                        <li key={columna}>
                            <span className="font-semibold">{columna}</span>
                            {detalle && <span className="text-muted-foreground"> · {detalle}</span>}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function RevisionArchivo({ revision, roles, rolPorDefecto, empresas, puedeAsignar }: { revision: Revision } & Omit<Props, 'revision'>) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [rol, setRol] = useState(rolPorDefecto && roles.some((r) => r.id === rolPorDefecto) ? String(rolPorDefecto) : '');
    const [procesando, setProcesando] = useState(false);
    const { resumen } = revision;
    const porImportar = resumen.nueva + resumen.completa;
    const nombreEmpresa = (id: number | null) => empresas.find((e) => e.id === id)?.nombre;

    const cambiarEmpresa = (clave: string, valor: string) => {
        const empresasElegidas = Object.fromEntries(revision.operaciones.map((o) => [o.clave, o.clave === clave ? valor || null : o.empresaId]));
        router.put(
            route('usuarios.importar.empresas'),
            { token: revision.token, empresas: empresasElegidas },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmar = () => {
        router.post(
            route('usuarios.importar.confirmar'),
            { token: revision.token, rol_id: rol },
            { preserveScroll: true, onStart: () => setProcesando(true), onFinish: () => setProcesando(false) },
        );
    };

    const tarjetas: { accion: Accion; titulo: string; detalle: string }[] = [
        { accion: 'nueva', titulo: 'Nuevas', detalle: 'Se registran con su carnet' },
        { accion: 'completa', titulo: 'Se completan', detalle: 'Ya estaban: reciben los datos que les faltan' },
        { accion: 'igual', titulo: 'Sin cambios', detalle: 'Ya estaban con todos sus datos' },
        { accion: 'error', titulo: 'No se importan', detalle: 'Les falta algo obligatorio' },
    ];

    return (
        <>
            <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4">
                <p className="flex min-w-0 items-center gap-3 text-sm">
                    <FileSpreadsheet className="text-primary size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                        <span className="block truncate font-semibold" title={revision.archivo}>
                            {revision.archivo}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {plural(revision.filas.length, 'persona en el archivo', 'personas en el archivo')}
                        </span>
                    </span>
                </p>
                <Button variant="outline" className="h-9 rounded-lg" onClick={() => router.delete(route('usuarios.importar.descartar'))}>
                    Usar otro archivo
                </Button>
            </div>

            <ul role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {tarjetas.map((t) => (
                    <li key={t.accion} className="bg-card flex flex-col rounded-2xl border px-4 py-3.5">
                        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{t.titulo}</span>
                        <span
                            className={cn('mt-1 text-3xl font-extrabold tabular-nums', t.accion === 'error' && resumen.error > 0 && 'text-critical')}
                        >
                            {fmt.numero(resumen[t.accion])}
                        </span>
                        <span className="text-muted-foreground mt-0.5 text-xs">{t.detalle}</span>
                    </li>
                ))}
            </ul>

            <div className="grid items-start gap-5 lg:grid-cols-2">
                {revision.operaciones.length > 0 && (
                    <section aria-labelledby="titulo-operaciones" className="bg-card grid gap-4 rounded-2xl border p-5">
                        <div>
                            <h2 id="titulo-operaciones" className="text-sm font-bold">
                                Empresa de cada operación
                            </h2>
                            <p className="text-muted-foreground mt-1 text-xs">
                                {puedeAsignar
                                    ? 'Las personas nuevas quedan asignadas a esa empresa, con sus líneas, desde su fecha de ingreso.'
                                    : 'Tu rol no crea asignaciones: las personas nuevas quedan sin asignar y se asignan después en Asignaciones.'}
                            </p>
                        </div>
                        {revision.operaciones.map((o) => {
                            const empresa = empresas.find((e) => e.id === o.empresaId);
                            const id = `operacion-${o.clave.replace(/\s+/g, '-')}`;
                            const ayuda =
                                empresa && empresa.lineas === 0
                                    ? `${empresa.nombre} aún no recibe líneas de servicio: las personas quedan sin asignar.`
                                    : empresa && puedeAsignar && !empresa.asignable
                                      ? `${empresa.nombre} está fuera de lo que puedes asignar: las personas quedan sin asignar.`
                                      : o.sugerida && o.empresaId
                                        ? 'Reconocida por el nombre. Cámbiala si no es esta.'
                                        : undefined;
                            return (
                                <Campo key={o.clave} id={id} etiqueta={`«${o.valor}» (${plural(o.personas, 'persona', 'personas')})`} ayuda={ayuda}>
                                    <Selector
                                        id={id}
                                        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
                                        valor={o.empresaId ? String(o.empresaId) : ''}
                                        onCambio={(v) => cambiarEmpresa(o.clave, v)}
                                        opciones={[
                                            { valor: '', texto: 'Sin asignar' },
                                            ...empresas.map((e) => ({ valor: String(e.id), texto: e.nombre })),
                                        ]}
                                    />
                                </Campo>
                            );
                        })}
                    </section>
                )}

                <section aria-labelledby="titulo-rol" className="bg-card grid gap-4 rounded-2xl border p-5">
                    <div>
                        <h2 id="titulo-rol" className="text-sm font-bold">
                            Rol de las personas nuevas
                        </h2>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Quienes ya estaban conservan su rol. Nadie recibe acceso a la plataforma.
                        </p>
                    </div>
                    <Campo id="rol_id" etiqueta="Rol" requerido ayuda={roles.find((r) => String(r.id) === rol)?.resumen} error={errors.rol_id}>
                        <Selector
                            id="rol_id"
                            aria-describedby={
                                [rol ? 'rol_id-ayuda' : null, errors.rol_id ? 'rol_id-error' : null].filter(Boolean).join(' ') || undefined
                            }
                            aria-invalid={errors.rol_id ? true : undefined}
                            valor={rol}
                            onCambio={setRol}
                            placeholder="Elige el rol"
                            opciones={roles.map((r) => ({ valor: String(r.id), texto: r.nombre, detalle: r.resumen }))}
                        />
                    </Campo>
                </section>
            </div>

            <Tabla titulo="Personas del archivo" minimo="min-w-[900px]" columnas={['4.5rem', '27%', '16%', '22%', '14%', '21%']}>
                <thead className="text-muted-foreground border-b">
                    <tr>
                        <th scope="col" className={claseTh}>
                            Fila
                        </th>
                        <th scope="col" className={claseTh}>
                            Persona
                        </th>
                        <th scope="col" className={claseTh}>
                            Cargo
                        </th>
                        <th scope="col" className={claseTh}>
                            Contacto
                        </th>
                        <th scope="col" className={claseTh}>
                            Empresa
                        </th>
                        <th scope="col" className={claseTh}>
                            Qué pasa
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {revision.filas.map((f) => (
                        <tr key={f.fila} className={cn('align-top', f.accion === 'error' && 'bg-critical-soft/30')}>
                            <td className={cn(claseTd, 'text-muted-foreground tabular-nums')}>{f.fila}</td>
                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                <p className="truncate font-semibold" title={f.nombre}>
                                    {f.nombre || 'Sin nombre'}
                                </p>
                                <p className="text-muted-foreground text-xs tabular-nums">{f.cedula ? `C.C. ${f.cedula}` : 'Sin cédula'}</p>
                            </th>
                            <td className={cn(claseTd, 'text-xs')}>{f.cargo ?? <span className="text-muted-foreground">Sin cargo</span>}</td>
                            <td className={cn(claseTd, 'text-xs leading-relaxed')}>
                                {f.telefono || f.email || f.ciudad ? (
                                    <>
                                        {f.telefono && <p className="tabular-nums">{f.telefono}</p>}
                                        {f.email && (
                                            <p className="truncate" title={f.email}>
                                                {f.email}
                                            </p>
                                        )}
                                        {f.ciudad && <p className="text-muted-foreground">{f.ciudad}</p>}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">Sin datos</span>
                                )}
                            </td>
                            <td className={cn(claseTd, 'text-xs')}>
                                {nombreEmpresa(f.empresaId) ?? (
                                    <span className="text-muted-foreground">{f.operacion ? 'Sin asignar' : 'No indica'}</span>
                                )}
                            </td>
                            <td className={cn(claseTd, 'text-xs')}>
                                <span
                                    className={cn('inline-flex rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap', ACCIONES[f.accion].clase)}
                                >
                                    {ACCIONES[f.accion].texto}
                                </span>
                                {f.accion === 'completa' && (
                                    <p className="text-muted-foreground mt-1">{f.completa.map((c) => CAMPOS[c] ?? c).join(', ')}</p>
                                )}
                                {f.errores.map((e) => (
                                    <p key={e} className="text-critical mt-1 flex items-start gap-1.5 font-medium">
                                        <XCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                                        {e}
                                    </p>
                                ))}
                                {f.avisos.map((a) => (
                                    <p key={a} className="text-warning mt-1 flex items-start gap-1.5">
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                                        {a}
                                    </p>
                                ))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Tabla>

            <div className="bg-card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 shadow-[var(--sombra-elevada)]">
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    {porImportar ? (
                        <>
                            <UsersRound className="text-primary size-4 shrink-0" aria-hidden="true" />
                            {[
                                resumen.nueva ? plural(resumen.nueva, 'persona nueva', 'personas nuevas') : null,
                                resumen.completa ? `${plural(resumen.completa, 'persona', 'personas')} con datos por completar` : null,
                            ]
                                .filter(Boolean)
                                .join(' y ')}
                        </>
                    ) : (
                        <>
                            <Info className="size-4 shrink-0" aria-hidden="true" />
                            No hay personas nuevas ni datos por completar.
                        </>
                    )}
                </p>
                <Button onClick={confirmar} disabled={!porImportar || procesando} className="h-10 rounded-lg px-5 font-semibold">
                    {procesando ? 'Importando…' : porImportar === 1 ? 'Importar 1 persona' : `Importar ${fmt.numero(porImportar)} personas`}
                </Button>
            </div>
        </>
    );
}
