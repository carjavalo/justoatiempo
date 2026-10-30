import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, ConteoEnlace, contenedorModulo, EncabezadoModulo, EstadoBadge, EstadoVacio, Iniciales, Paginacion, SinResultados, Tabla } from '@/components/admin/piezas';
import { Hammer, Lock, Plus, ShieldCheck, UserCheck } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useBorrador } from '@/hooks/use-borrador';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaRol {
    id: number;
    nombre: string;
    descripcion: string | null;
    permisos: string[];
    alcance: string;
    /** "Acceso total" o los módulos que ve. */
    resumen: string;
    /** Rol base de la plataforma: no se desactiva. */
    base: boolean;
    /** El Administrador de la plataforma: siempre lo puede todo, sus permisos no se cambian. */
    fijo: boolean;
    activo: boolean;
    usuarios: number;
    /** Si quien mira lo puede cambiar: solo roles con, como mucho, sus mismos permisos. */
    editable: boolean;
}

interface Modulo {
    titulo: string;
    descripcion: string;
    acciones: Record<string, string>;
    /** En construcción: el permiso ya se puede dar. */
    pendiente?: boolean;
}

interface Grupo {
    clave: string;
    titulo: string;
    modulos: Record<string, Modulo>;
}

interface Alcance {
    valor: string;
    label: string;
    descripcion: string;
}

interface Props {
    roles: Paginado<FilaRol>;
    total: number;
    filtros: { q: string; alcance: string; estado: string };
    catalogo: Grupo[];
    /** Permiso de ver todas las líneas de servicio ("lineas.todas"). */
    todasLasLineas: string;
    alcances: Alcance[];
    /** Lo que quien edita puede dar: los permisos y el alcance de su propio rol. */
    miRol: { id: number | null; permisos: string[]; alcance: string };
    /** Roles de los que se pueden copiar los permisos. */
    modelos: { id: number; nombre: string; permisos: string[]; alcance: string }[];
}

const VACIO = { nombre: '', descripcion: '', permisos: [] as string[], alcance: 'asignacion' };
const ORDEN_CAMPOS = ['nombre', 'descripcion', 'alcance', 'permisos'];
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Módulos que se usan desde el tablero de la línea: darlos incluye ver el tablero. */
const DESDE_EL_TABLERO = ['cargas', 'auditoria', 'informes', 'seguimiento', 'programacion'];
/** Con el alcance "solo lo suyo" solo aplican su tablero (su desempeño) y sus entregas. */
const SOLO_LO_SUYO = ['tablero', 'entregas', 'lineas'];
const aplica = (alcance: string, modulo: string) => alcance !== 'propio' || SOLO_LO_SUYO.includes(modulo);

export default function Roles({ roles, total, filtros, catalogo, todasLasLineas, alcances, miRol, modelos }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar, activos } = useFiltros(route('roles.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaRol | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const [copiado, setCopiado] = useState('');
    const form = useForm(VACIO);
    const borrador = useBorrador('roles', form);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (rol: FilaRol | null, boton: HTMLElement | null = null) => {
        setEditando(rol);
        setOrigen(boton);
        setCopiado('');
        form.clearErrors();
        // Un rol nuevo arranca con un alcance que quien lo crea sí puede dar
        borrador.abrir(
            rol?.id ?? null,
            rol
                ? { nombre: rol.nombre, descripcion: rol.descripcion ?? '', permisos: rol.permisos, alcance: rol.alcance }
                : { ...VACIO, alcance: alcancePermitido(VACIO.alcance) ? VACIO.alcance : miRol.alcance },
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => {
                borrador.limpiar();
                setAbierto(false);
            } };
        if (editando) form.put(route('roles.update', editando.id), opciones);
        else form.post(route('roles.store'), opciones);
    };

    const fijo = Boolean(editando?.fijo);
    // Solo se dan permisos que el propio rol tiene, y un alcance igual o más limitado que el propio
    const puedeDar = (permiso: string) => miRol.permisos.includes(permiso);
    const ordenAlcance = alcances.map((a) => a.valor);
    const alcancePermitido = (valor: string) => ordenAlcance.indexOf(valor) >= ordenAlcance.indexOf(miRol.alcance);

    /** Marca o quita un permiso con lo que implica: cualquier acción incluye "ver" su módulo (y las herramientas, el tablero). */
    const alternar = (modulo: string, accion: string, marcado: boolean) => {
        const permiso = `${modulo}.${accion}`;
        form.setData((d) => {
            let permisos = new Set(d.permisos);
            if (marcado) {
                permisos.add(permiso);
                permisos.add(`${modulo}.ver`);
                if (DESDE_EL_TABLERO.includes(modulo)) permisos.add('tablero.ver');
            } else if (accion === 'ver') {
                // Sin ver el módulo no se puede hacer nada en él; sin el tablero, tampoco usar sus herramientas ni ver todas las líneas
                const quitar = (m: string) => [...permisos].filter((p) => p.startsWith(`${m}.`)).forEach((p) => permisos.delete(p));
                quitar(modulo);
                if (modulo === 'tablero') [...DESDE_EL_TABLERO, 'lineas'].forEach(quitar);
            } else {
                permisos.delete(permiso);
            }
            permisos = new Set([...permisos].filter(puedeDar));
            return { ...d, permisos: [...permisos] };
        });
    };

    const copiarDe = (valor: string) => {
        const modelo = modelos.find((m) => String(m.id) === valor);
        if (!modelo) return;
        const alcance = alcancePermitido(modelo.alcance) ? modelo.alcance : miRol.alcance;
        form.setData((d) => ({
            ...d,
            permisos: modelo.permisos.filter((p) => puedeDar(p) && aplica(alcance, p.split('.')[0])),
            alcance,
        }));
        setCopiado(`Se copiaron los permisos de ${modelo.nombre}. Ajústalos abajo si hace falta.`);
    };

    /** Con "solo lo suyo" se quitan los permisos que no le aplican (el servidor hace lo mismo al guardar). */
    const cambiarAlcance = (alcance: string) => {
        form.setData((d) => ({ ...d, alcance, permisos: d.permisos.filter((p) => aplica(alcance, p.split('.')[0])) }));
    };

    const motivoNoDisponible = (permiso: string, modulo: string) =>
        !aplica(form.data.alcance, modulo) ? 'No aplica con «Solo lo suyo»' : !puedeDar(permiso) ? 'Tu rol no tiene este permiso' : '';

    const nombreAlcance = (valor: string) => alcances.find((a) => a.valor === valor)?.label ?? valor;
    const totalPermisos = catalogo.reduce((n, g) => n + Object.values(g.modulos).reduce((m, mod) => m + Object.keys(mod.acciones).length, 0), 1);

    const botonNuevo = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    return (
        <AppLayout>
            <Head title="Roles" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Roles"
                    descripcion="Los roles dentro de la empresa (auxiliar, conductor, supervisor…). En cada uno decides qué módulos ve quien lo tenga, qué puede hacer en cada uno y cuánto ve de la operación."
                    accion={total > 0 && puede('roles.crear') && botonNuevo('Nuevo rol')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={UserCheck}
                        titulo="Aún no hay roles"
                        texto="Crea los roles de la empresa para asignárselos a cada persona al crear su usuario."
                        accion={puede('roles.crear') && botonNuevo('Crear el primer rol')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={roles.total ? plural(roles.total, 'rol', 'roles') : 'Ningún rol coincide con los filtros.'}
                            soloAnunciar={roles.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-roles"
                        >
                            <CampoBusqueda id="buscar-roles" etiqueta="Buscar roles" placeholder="Buscar por nombre" valor={valores.q} onCambio={(v) => cambiar('q', v, { inmediato: false })} />
                            <FiltroLista
                                id="filtro-alcance"
                                etiqueta="Qué ve de la operación"
                                valor={valores.alcance}
                                onCambio={(v) => cambiar('alcance', v)}
                                opciones={[{ valor: '', texto: 'Cualquier alcance' }, ...alcances.map((a) => ({ valor: a.valor, texto: a.label }))]}
                            />
                            <FiltroLista
                                id="filtro-estado"
                                etiqueta="Estado"
                                valor={valores.estado}
                                onCambio={(v) => cambiar('estado', v)}
                                opciones={[
                                    { valor: '', texto: 'Activos e inactivos' },
                                    { valor: 'activos', texto: 'Solo activos' },
                                    { valor: 'inactivos', texto: 'Solo inactivos' },
                                ]}
                            />
                        </BarraFiltros>

                        {roles.data.length === 0 ? (
                            <SinResultados texto="Ningún rol coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Roles de la empresa" minimo="min-w-[860px]" columnas={['30%', '28%', '14%', '11%', '11%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Rol
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Qué puede ver
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Alcance
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Usuarios
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Estado
                                        </th>
                                        <th scope="col" className={cn(claseTh, 'w-14')}>
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {roles.data.map((r) => (
                                        <tr key={r.id} className={cn('hover:bg-muted/40 transition-colors', !r.activo && 'text-muted-foreground')}>
                                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                <div className="flex items-center gap-3">
                                                    <Iniciales texto={r.nombre} />
                                                    <div className="min-w-0">
                                                        <p className="text-foreground flex items-center gap-2 font-semibold">
                                                            <span className="truncate" title={r.nombre}>
                                                                {r.nombre}
                                                            </span>
                                                            {r.base && (
                                                                <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                                                                    Base
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs" title={r.descripcion ?? undefined}>
                                                            {r.descripcion ?? 'Sin descripción'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                {r.resumen === 'Acceso total' ? (
                                                    <span className="bg-brand-navy-deep inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
                                                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                                                        Acceso total
                                                    </span>
                                                ) : (
                                                    <p className="line-clamp-2 text-xs leading-relaxed" title={r.resumen}>
                                                        {r.resumen}
                                                    </p>
                                                )}
                                            </td>
                                            <td className={cn(claseTd, 'text-xs')}>{nombreAlcance(r.alcance)}</td>
                                            <td className={claseTd}>
                                                <ConteoEnlace
                                                    n={r.usuarios}
                                                    uno="usuario"
                                                    varios="usuarios"
                                                    ninguno="Ninguno"
                                                    de={r.nombre}
                                                    href={puede('usuarios.ver') ? route('usuarios.index', { rol: r.id }) : undefined}
                                                />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={r.activo} />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={r.nombre}
                                                    activo={r.activo}
                                                    // Los roles base siempre están disponibles; nadie toca un rol con más permisos que el suyo
                                                    urlEstado={!r.base && r.editable && puede('roles.estado') ? route('roles.estado', r.id) : undefined}
                                                    onEditar={r.editable && puede('roles.editar') ? (boton) => abrir(r, boton) : undefined}
                                                    urlEliminar={!r.base && r.editable && puede('roles.eliminar') ? route('roles.destroy', r.id) : undefined}
                                                    consecuencia={`Ya no se ofrecerá al crear usuarios. ${
                                                        r.usuarios === 0
                                                            ? 'Nadie lo tiene asignado.'
                                                            : r.usuarios === 1
                                                              ? 'La persona que lo tiene lo conserva, con los mismos permisos.'
                                                              : `Las ${r.usuarios} personas que lo tienen lo conservan, con los mismos permisos.`
                                                    } Puedes volver a activarlo cuando quieras.`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Tabla>
                        )}

                        <Paginacion pagina={roles} nombre="roles" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar rol' : 'Nuevo rol'}
                descripcion={
                    editando
                        ? editando.usuarios > 0
                            ? `Lo ${editando.usuarios === 1 ? 'tiene 1 persona' : `tienen ${editando.usuarios} personas`}: los cambios les aplican de inmediato.`
                            : `Actualiza el rol ${editando.nombre}.`
                        : 'Un rol de la empresa con lo que puede ver y hacer en la plataforma.'
                }
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear rol'}
                recuperado={borrador.recuperado}
                onDescartar={borrador.descartar}
                focoAlCerrar={origen}
            >
                <Campo id="nombre" etiqueta="Nombre" requerido error={form.errors.nombre}>
                    <Input
                        {...propsCampo('nombre', form.errors.nombre)}
                        required
                        autoComplete="off"
                        placeholder="Ej.: Conductor"
                        maxLength={60}
                        value={form.data.nombre}
                        onChange={(e) => form.setData('nombre', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <Campo id="descripcion" etiqueta="Descripción" ayuda="Opcional. Qué hace en la empresa." error={form.errors.descripcion}>
                    <Input
                        {...propsCampo('descripcion', form.errors.descripcion, 'descripcion-ayuda')}
                        autoComplete="off"
                        placeholder="Ej.: Hace las entregas en la ruta asignada"
                        maxLength={200}
                        value={form.data.descripcion}
                        onChange={(e) => form.setData('descripcion', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                {fijo ? (
                    <p className="bg-secondary/60 text-secondary-foreground flex items-start gap-3 rounded-xl px-4 py-3 text-sm">
                        <Lock className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                            <strong className="font-semibold">El Administrador de la plataforma lo puede todo.</strong> Sus permisos no se cambian: así
                            siempre hay quien gestione usuarios y roles. Para dar menos acceso, crea otro rol.
                        </span>
                    </p>
                ) : (
                    <>
                        {/* Punto de partida: los permisos de otro rol */}
                        <Campo id="copiar" etiqueta="Copiar los permisos de otro rol" ayuda="Opcional. Después puedes ajustarlos uno por uno.">
                            <Selector
                                {...propsCampo('copiar', undefined, 'copiar-ayuda')}
                                valor=""
                                onCambio={copiarDe}
                                placeholder="Elige un rol para copiar sus permisos"
                                opciones={modelos.filter((m) => m.id !== editando?.id).map((m) => ({ valor: String(m.id), texto: m.nombre }))}
                            />
                            <span role="status" className="text-good text-xs font-medium empty:hidden">
                                {copiado}
                            </span>
                        </Campo>

                        {/* Cuánto ve de la operación */}
                        <fieldset className="grid gap-2" aria-describedby={form.errors.alcance ? 'alcance-error' : undefined}>
                            <legend className="mb-1.5 text-sm leading-none font-medium">
                                Qué ve de la operación <span aria-hidden="true">*</span>
                            </legend>
                            {alcances.map((a, i) => {
                                // El primero lleva el id "alcance" para recibir el foco si el campo tiene error
                                const id = i === 0 ? 'alcance' : `alcance-${a.valor}`;
                                const elegido = form.data.alcance === a.valor;
                                const bloqueado = !alcancePermitido(a.valor);
                                return (
                                    <label
                                        key={a.valor}
                                        htmlFor={id}
                                        className={cn(
                                            'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 flex items-start gap-3 rounded-xl border p-3.5 transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                            elegido ? 'border-primary bg-secondary/60' : bloqueado ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer',
                                        )}
                                    >
                                        <input
                                            id={id}
                                            type="radio"
                                            name="alcance"
                                            value={a.valor}
                                            checked={elegido}
                                            disabled={bloqueado}
                                            onChange={() => cambiarAlcance(a.valor)}
                                            aria-invalid={form.errors.alcance ? true : undefined}
                                            aria-labelledby={`${id}-nombre`}
                                            aria-describedby={`${id}-descripcion`}
                                            className="accent-primary mt-0.5 size-4 shrink-0 outline-hidden"
                                        />
                                        <span>
                                            <span id={`${id}-nombre`} className="block text-sm font-semibold">
                                                {a.label}
                                            </span>
                                            <span id={`${id}-descripcion`} className="text-muted-foreground block text-xs">
                                                {bloqueado ? 'Tu propio rol no ve tanto: no puedes darlo.' : a.descripcion}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                            <InputError id="alcance-error" message={form.errors.alcance} />

                            <label
                                htmlFor="todas-las-lineas"
                                className={cn(
                                    'mt-1 flex items-start gap-3 rounded-xl border p-3.5',
                                    puedeDar(todasLasLineas) ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60',
                                )}
                            >
                                <Checkbox
                                    id="todas-las-lineas"
                                    checked={form.data.permisos.includes(todasLasLineas)}
                                    disabled={!puedeDar(todasLasLineas)}
                                    // Ver todas las líneas pasa por su tablero: lo incluye
                                    onCheckedChange={(v) =>
                                        form.setData((d) => ({
                                            ...d,
                                            permisos:
                                                v === true
                                                    ? [...new Set([...d.permisos, todasLasLineas, 'tablero.ver'])]
                                                    : d.permisos.filter((p) => p !== todasLasLineas),
                                        }))
                                    }
                                    aria-describedby="todas-las-lineas-descripcion"
                                    className="mt-0.5"
                                />
                                <span>
                                    <span className="block text-sm font-semibold">Todas las líneas de servicio</span>
                                    <span id="todas-las-lineas-descripcion" className="text-muted-foreground block text-xs">
                                        Si no, solo ve la línea en la que trabaja.
                                    </span>
                                </span>
                            </label>
                        </fieldset>

                        {/* Módulos y acciones */}
                        <div className="grid gap-2">
                            <div id="permisos" tabIndex={-1} className="flex items-baseline justify-between gap-3 outline-hidden">
                                <h3 className="text-sm leading-none font-medium">Qué puede ver y hacer</h3>
                                <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
                                    {plural(form.data.permisos.length, 'permiso', 'permisos')} de {totalPermisos}
                                </p>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                Cualquier acción incluye ver el módulo. Mi carnet lo ve siempre todo el mundo.
                                {form.data.alcance === 'propio' && ' Con «Solo lo suyo» solo aplican el tablero y Mis entregas.'}
                                {miRol.permisos.length < totalPermisos && ' Solo puedes dar los permisos que tu propio rol tiene.'}
                            </p>
                            <InputError id="permisos-error" message={form.errors.permisos} />

                            {catalogo.map((grupo) => (
                                <fieldset key={grupo.clave} className="mt-2 grid gap-2">
                                    <legend className="text-muted-foreground mb-1 text-[0.72rem] font-semibold tracking-wide uppercase">{grupo.titulo}</legend>
                                    {Object.entries(grupo.modulos).map(([clave, modulo]) => {
                                        const activo = form.data.permisos.includes(`${clave}.ver`);
                                        return (
                                            <fieldset
                                                key={clave}
                                                aria-describedby={`modulo-${clave}`}
                                                className={cn('rounded-xl border px-3.5 py-3 transition-colors', activo && 'border-primary/40 bg-secondary/40')}
                                            >
                                                <legend className="sr-only">{modulo.titulo}</legend>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-hidden="true">
                                                    <span className="text-sm font-semibold">{modulo.titulo}</span>
                                                    {modulo.pendiente && (
                                                        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                                                            <Hammer className="size-3" aria-hidden="true" />
                                                            En construcción
                                                        </span>
                                                    )}
                                                </div>
                                                <p id={`modulo-${clave}`} className="text-muted-foreground mt-0.5 text-xs">
                                                    {modulo.descripcion}
                                                    {modulo.pendiente && <span className="sr-only"> En construcción.</span>}
                                                </p>
                                                <ul role="list" className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
                                                    {Object.entries(modulo.acciones).map(([accion, texto]) => {
                                                        const permiso = `${clave}.${accion}`;
                                                        const id = `permiso-${clave}-${accion}`;
                                                        const disponible = puedeDar(permiso) && aplica(form.data.alcance, clave);
                                                        return (
                                                            <li key={accion} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={id}
                                                                    checked={form.data.permisos.includes(permiso)}
                                                                    disabled={!disponible}
                                                                    onCheckedChange={(v) => alternar(clave, accion, v === true)}
                                                                    aria-invalid={form.errors.permisos ? true : undefined}
                                                                />
                                                                <label
                                                                    htmlFor={id}
                                                                    className={cn('text-sm', disponible ? 'cursor-pointer' : 'text-muted-foreground')}
                                                                    title={disponible ? undefined : motivoNoDisponible(permiso, clave)}
                                                                >
                                                                    {texto}
                                                                    <span className="sr-only">
                                                                        {' '}
                                                                        {modulo.titulo}
                                                                        {!disponible && ` (${motivoNoDisponible(permiso, clave).toLowerCase()})`}
                                                                    </span>
                                                                </label>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </fieldset>
                                        );
                                    })}
                                </fieldset>
                            ))}
                        </div>
                    </>
                )}
            </FormularioLateral>
        </AppLayout>
    );
}
