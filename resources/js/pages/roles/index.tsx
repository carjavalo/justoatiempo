import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, ConteoEnlace, contenedorModulo, EncabezadoModulo, EstadoBadge, EstadoVacio, Iniciales, Paginacion, SinResultados, Tabla } from '@/components/admin/piezas';
import { Plus, UserCheck } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado, type Rol } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaRol {
    id: number;
    nombre: string;
    descripcion: string | null;
    /** Nivel de acceso en la plataforma. */
    nivel: Rol;
    nivelLabel: string;
    /** Rol base de la plataforma: no se desactiva ni cambia su acceso. */
    base: boolean;
    activo: boolean;
    usuarios: number;
}

interface Props {
    roles: Paginado<FilaRol>;
    total: number;
    filtros: { q: string; nivel: string; estado: string };
    niveles: { valor: Rol; label: string; descripcion: string }[];
}

const VACIO = { nombre: '', descripcion: '', nivel: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Color del acceso: el administrador resalta porque lo puede todo. */
const claseNivel: Record<Rol, string> = {
    admin: 'bg-brand-navy-deep text-white',
    coordinador: 'bg-secondary text-secondary-foreground',
    auxiliar: 'bg-muted text-foreground',
};

export default function Roles({ roles, total, filtros, niveles }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('roles.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaRol | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (rol: FilaRol | null, boton: HTMLElement | null = null) => {
        setEditando(rol);
        setOrigen(boton);
        form.clearErrors();
        form.setData(rol ? { nombre: rol.nombre, descripcion: rol.descripcion ?? '', nivel: rol.nivel } : VACIO);
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('roles.update', editando.id), opciones);
        else form.post(route('roles.store'), opciones);
    };

    // Cambiar el acceso de un rol en uso cambiaría de golpe lo que pueden hacer sus usuarios: se crea otro rol
    const nivelFijo = editando ? (editando.base ? 'base' : editando.usuarios > 0 ? 'en-uso' : null) : null;

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
                    descripcion="Los roles dentro de la empresa (auxiliar, conductor, supervisor…). Cada uno define qué puede hacer en la plataforma quien lo tenga."
                    accion={total > 0 && botonNuevo('Nuevo rol')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={UserCheck}
                        titulo="Aún no hay roles"
                        texto="Crea los roles de la empresa para asignárselos a cada persona al crear su usuario."
                        accion={botonNuevo('Crear el primer rol')}
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
                                id="filtro-nivel"
                                etiqueta="Acceso en la plataforma"
                                valor={valores.nivel}
                                onCambio={(v) => cambiar('nivel', v)}
                                opciones={[{ valor: '', texto: 'Todos los accesos' }, ...niveles.map((n) => ({ valor: n.valor, texto: n.label }))]}
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
                            <Tabla titulo="Roles de la empresa" columnas={['44%', '20%', '16%', '15%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Rol
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Acceso
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
                                                <span className={cn('inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold', claseNivel[r.nivel])}>
                                                    {r.nivelLabel}
                                                </span>
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace n={r.usuarios} uno="usuario" varios="usuarios" ninguno="Ninguno" de={r.nombre} href={route('usuarios.index', { rol: r.id })} />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={r.activo} />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={r.nombre}
                                                    activo={r.activo}
                                                    // Los roles base siempre están disponibles
                                                    urlEstado={r.base ? undefined : route('roles.estado', r.id)}
                                                    onEditar={(boton) => abrir(r, boton)}
                                                    consecuencia={`Ya no se ofrecerá al crear usuarios. ${
                                                        r.usuarios === 0
                                                            ? 'Nadie lo tiene asignado.'
                                                            : r.usuarios === 1
                                                              ? 'La persona que lo tiene lo conserva, con el mismo acceso.'
                                                              : `Las ${r.usuarios} personas que lo tienen lo conservan, con el mismo acceso.`
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
                descripcion={editando ? `Actualiza el rol ${editando.nombre}.` : 'Un rol de la empresa, para asignárselo a las personas al crear su usuario.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear rol'}
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

                <fieldset className="grid gap-2" aria-describedby={form.errors.nivel ? 'nivel-error' : nivelFijo ? 'nivel-ayuda' : undefined}>
                    <legend className="mb-1.5 text-sm leading-none font-medium">
                        Qué puede hacer en la plataforma <span aria-hidden="true">*</span>
                    </legend>
                    {nivelFijo && (
                        <p id="nivel-ayuda" className="text-muted-foreground mb-1 text-xs">
                            {nivelFijo === 'base'
                                ? 'Es un rol base de la plataforma: su acceso no se cambia.'
                                : `Ya ${editando!.usuarios === 1 ? 'lo tiene 1 usuario' : `lo tienen ${editando!.usuarios} usuarios`}: su acceso no se cambia. Para darles otro, crea un rol nuevo y asígnaselo.`}
                        </p>
                    )}
                    {niveles.map((n, i) => {
                        // El primero lleva el id "nivel" para recibir el foco si el campo tiene error
                        const id = i === 0 ? 'nivel' : `nivel-${n.valor}`;
                        const elegido = form.data.nivel === n.valor;
                        const bloqueado = nivelFijo !== null && !elegido;
                        return (
                            <label
                                key={n.valor}
                                htmlFor={id}
                                className={cn(
                                    'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 flex items-start gap-3 rounded-xl border p-3.5 transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                    elegido ? 'border-primary bg-secondary/60' : bloqueado ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer',
                                    form.errors.nivel && !form.data.nivel && 'border-critical/60',
                                )}
                            >
                                <input
                                    id={id}
                                    type="radio"
                                    name="nivel"
                                    value={n.valor}
                                    checked={elegido}
                                    disabled={bloqueado}
                                    onChange={() => form.setData('nivel', n.valor)}
                                    required
                                    aria-invalid={form.errors.nivel ? true : undefined}
                                    // Nombre: solo el acceso; la descripción se lee como descripción
                                    aria-labelledby={`${id}-nombre`}
                                    aria-describedby={`${id}-descripcion`}
                                    className="accent-primary mt-0.5 size-4 shrink-0 outline-hidden"
                                />
                                <span>
                                    <span id={`${id}-nombre`} className="block text-sm font-semibold">
                                        Como {n.label.toLowerCase()}
                                    </span>
                                    <span id={`${id}-descripcion`} className="text-muted-foreground block text-xs">
                                        {n.descripcion}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                    <InputError id="nivel-error" message={form.errors.nivel} />
                </fieldset>
            </FormularioLateral>
        </AppLayout>
    );
}
