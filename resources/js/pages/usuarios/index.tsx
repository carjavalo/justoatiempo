import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, contenedorModulo, EncabezadoModulo, EstadoBadge, EstadoVacio, Iniciales, Paginacion, SinResultados, Tabla } from '@/components/admin/piezas';
import InputError from '@/components/input-error';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { fechaHoraCompleta, haceCuanto } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado, type Rol } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, Sparkles, UsersRound, X } from '@/components/iconos';
import { useState } from 'react';
import { Selector } from '@/components/selector';

interface FilaUsuario {
    id: number;
    nombre: string;
    nombres: string | null;
    primerApellido: string | null;
    segundoApellido: string | null;
    email: string;
    rol: Rol;
    rolLabel: string;
    empresaId: number | null;
    empresa: string | null;
    sedeId: number | null;
    sede: string | null;
    activo: boolean;
    ultimoAcceso: string | null;
    esUsted: boolean;
}

interface Opcion {
    id: number;
    nombre: string;
    activo: boolean;
}

interface Props {
    usuarios: Paginado<FilaUsuario>;
    total: number;
    filtros: { q: string; rol: string; estado: string; empresa: string; sede: string };
    contexto: { empresa: string | null; sede: string | null };
    roles: { valor: Rol; label: string; descripcion: string }[];
    empresas: Opcion[];
    sedes: (Opcion & { ciudad: string; empresaId: number | null })[];
}

const VACIO = { nombres: '', primer_apellido: '', segundo_apellido: '', email: '', rol: '', empresa_id: '', sede_id: '', password: '' };
const ORDEN_CAMPOS = ['nombres', 'primer_apellido', 'segundo_apellido', 'email', 'rol', 'empresa_id', 'sede_id', 'password'];

/** Contraseña aleatoria legible (sin 0/O ni 1/l/I) con mayúsculas, minúsculas, números y un símbolo. */
function generarContrasena(): string {
    const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#$%&*+?'];
    const todos = grupos.join('');
    const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    const letras = [...grupos.map((g) => g[azar(g.length)]), ...Array.from({ length: 10 }, () => todos[azar(todos.length)])];
    for (let i = letras.length - 1; i > 0; i--) {
        const j = azar(i + 1);
        [letras[i], letras[j]] = [letras[j], letras[i]];
    }
    return letras.join('');
}

export default function Usuarios({ usuarios, total, filtros, contexto, roles, empresas, sedes }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('usuarios.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaUsuario | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const [verContrasena, setVerContrasena] = useState(false);
    const [generada, setGenerada] = useState(false);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (usuario: FilaUsuario | null, boton: HTMLElement | null = null) => {
        setEditando(usuario);
        setOrigen(boton);
        setVerContrasena(false);
        setGenerada(false);
        form.clearErrors();
        form.setData(
            usuario
                ? {
                      nombres: usuario.nombres ?? '',
                      primer_apellido: usuario.primerApellido ?? '',
                      segundo_apellido: usuario.segundoApellido ?? '',
                      email: usuario.email,
                      rol: usuario.rol,
                      empresa_id: usuario.empresaId ? String(usuario.empresaId) : '',
                      sede_id: usuario.sedeId ? String(usuario.sedeId) : '',
                      password: '',
                  }
                : // Si la lista viene filtrada por empresa o sede, el usuario nuevo nace ahí
                  { ...VACIO, ...asignacionDesdeFiltros() },
        );
        setAbierto(true);
    };

    const asignacionDesdeFiltros = () => {
        const sede = sedes.find((s) => String(s.id) === valores.sede && s.activo);
        if (sede) return { empresa_id: sede.empresaId ? String(sede.empresaId) : '', sede_id: String(sede.id) };
        const empresa = empresas.find((e) => String(e.id) === valores.empresa && e.activo);
        return empresa ? { empresa_id: String(empresa.id) } : {};
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('usuarios.update', editando.id), opciones);
        else form.post(route('usuarios.store'), opciones);
    };

    // La sede depende de la empresa: sin empresa se listan las sedes propias de Justo a Tiempo
    const empresaId = form.data.empresa_id ? Number(form.data.empresa_id) : null;
    const empresaElegida = empresas.find((e) => e.id === empresaId);
    const empresasFormulario = empresas.filter((e) => e.activo || e.id === empresaId);
    const sedesFormulario = sedes.filter((s) => s.empresaId === empresaId && (s.activo || String(s.id) === form.data.sede_id));

    const cambiarEmpresa = (valor: string) => {
        const id = valor ? Number(valor) : null;
        const sedeSigue = sedes.some((s) => String(s.id) === form.data.sede_id && s.empresaId === id);
        form.setData((d) => ({ ...d, empresa_id: valor, sede_id: sedeSigue ? d.sede_id : '' }));
    };

    const generar = () => {
        form.setData('password', generarContrasena());
        setVerContrasena(true);
        setGenerada(true);
    };

    const botonNuevo = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    const chips: { campo: 'empresa' | 'sede'; texto: string }[] = [
        contexto.empresa && { campo: 'empresa' as const, texto: `Empresa: ${contexto.empresa}` },
        contexto.sede && { campo: 'sede' as const, texto: `Sede: ${contexto.sede}` },
    ].filter((c): c is { campo: 'empresa' | 'sede'; texto: string } => Boolean(c));
    const soloUnChip = chips.length === 1 && !valores.q && !valores.rol && !valores.estado;

    return (
        <AppLayout breadcrumbs={[{ title: 'Usuarios', href: route('usuarios.index') }]}>
            <Head title="Usuarios" />

            <div className={contenedorModulo}>
                <EncabezadoModulo titulo="Usuarios" descripcion="Quién puede ingresar a la plataforma, con qué rol y en qué empresa y sede trabaja." accion={total > 0 && botonNuevo('Nuevo usuario')} />

                {total === 0 ? (
                    <EstadoVacio icono={UsersRound} titulo="Aún no hay usuarios" texto="Crea el acceso de cada persona con su rol, empresa y sede." accion={botonNuevo('Crear el primer usuario')} />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={usuarios.total ? `${usuarios.total} ${usuarios.total === 1 ? 'usuario' : 'usuarios'}` : 'Ningún usuario coincide con los filtros.'}
                            soloAnunciar={usuarios.total === 0}
                            activos={activos && !soloUnChip}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-usuarios"
                        >
                            <CampoBusqueda id="buscar-usuarios" etiqueta="Buscar usuarios" placeholder="Buscar por nombre o correo" valor={valores.q} onCambio={(v) => cambiar('q', v, { inmediato: false })} />
                            <FiltroLista
                                id="filtro-rol"
                                etiqueta="Rol"
                                valor={valores.rol}
                                onCambio={(v) => cambiar('rol', v)}
                                opciones={[{ valor: '', texto: 'Todos los roles' }, ...roles.map((r) => ({ valor: r.valor, texto: r.label }))]}
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
                            {chips.map((c) => (
                                <span key={c.campo} className="bg-secondary text-secondary-foreground inline-flex h-10 items-center gap-1 rounded-lg pr-1 pl-3 text-sm font-medium">
                                    {c.texto}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // El chip desaparece: el foco pasa a la búsqueda
                                            document.getElementById('buscar-usuarios')?.focus();
                                            cambiar(c.campo, '');
                                        }}
                                        className="hover:bg-background/70 focus-visible:ring-ring flex size-8 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-hidden"
                                    >
                                        <X className="size-4" aria-hidden="true" />
                                        <span className="sr-only">Quitar filtro {c.texto}</span>
                                    </button>
                                </span>
                            ))}
                        </BarraFiltros>

                        {usuarios.data.length === 0 ? (
                            <SinResultados texto="Ningún usuario coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Usuarios de la plataforma" minimo="min-w-[820px]">
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Usuario
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Rol
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Empresa y sede
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Estado
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Último ingreso
                                        </th>
                                        <th scope="col" className={cn(claseTh, 'w-14')}>
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {usuarios.data.map((u) => (
                                        <tr key={u.id} className={cn('hover:bg-muted/40 transition-colors', !u.activo && 'text-muted-foreground')}>
                                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                <div className="flex items-center gap-3">
                                                    <Iniciales texto={u.nombre} className={u.esUsted ? 'bg-brand-coral text-brand-coral-foreground' : undefined} />
                                                    <div className="min-w-0">
                                                        <p className="text-foreground flex items-center gap-2 font-semibold">
                                                            <span className="truncate">{u.nombre}</span>
                                                            {u.esUsted && <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">Tú</span>}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={cn(claseTd, 'whitespace-nowrap')}>{u.rolLabel}</td>
                                            <td className={claseTd}>
                                                <p className="text-foreground">{u.empresa ?? 'Justo a Tiempo SP'}</p>
                                                <p className="text-muted-foreground text-xs">{u.sede ?? 'Sin sede asignada'}</p>
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={u.activo} />
                                            </td>
                                            <td className={cn(claseTd, 'text-xs whitespace-nowrap')}>
                                                {u.ultimoAcceso ? (
                                                    <time dateTime={u.ultimoAcceso} title={fechaHoraCompleta.format(new Date(u.ultimoAcceso))} className="inline-block first-letter:uppercase">
                                                        {haceCuanto(u.ultimoAcceso)}
                                                    </time>
                                                ) : (
                                                    <span className="text-muted-foreground">Nunca ha ingresado</span>
                                                )}
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={u.nombre}
                                                    activo={u.activo}
                                                    // Nadie se desactiva a sí mismo
                                                    urlEstado={u.esUsted ? undefined : route('usuarios.estado', u.id)}
                                                    onEditar={(boton) => abrir(u, boton)}
                                                    consecuencia="Perderá el acceso de inmediato, incluso si tiene la sesión abierta. Podrás devolverle el acceso cuando quieras."
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Tabla>
                        )}

                        <Paginacion pagina={usuarios} nombre="usuarios" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar usuario' : 'Nuevo usuario'}
                descripcion={editando ? `Actualiza el acceso de ${editando.nombre}.` : 'La persona ingresará con este correo y la contraseña que le asignes.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear usuario'}
                focoAlCerrar={origen}
            >
                <Campo id="nombres" etiqueta="Nombres" requerido error={form.errors.nombres}>
                    <Input
                        {...propsCampo('nombres', form.errors.nombres)}
                        required
                        autoComplete="off"
                        placeholder="Ej.: Ana María"
                        value={form.data.nombres}
                        onChange={(e) => form.setData('nombres', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="primer_apellido" etiqueta="Primer apellido" requerido error={form.errors.primer_apellido}>
                        <Input
                            {...propsCampo('primer_apellido', form.errors.primer_apellido)}
                            required
                            autoComplete="off"
                            value={form.data.primer_apellido}
                            onChange={(e) => form.setData('primer_apellido', e.target.value)}
                            className="h-10 rounded-lg"
                        />
                    </Campo>
                    <Campo id="segundo_apellido" etiqueta="Segundo apellido" error={form.errors.segundo_apellido}>
                        <Input
                            {...propsCampo('segundo_apellido', form.errors.segundo_apellido)}
                            autoComplete="off"
                            value={form.data.segundo_apellido}
                            onChange={(e) => form.setData('segundo_apellido', e.target.value)}
                            className="h-10 rounded-lg"
                        />
                    </Campo>
                </div>

                <Campo id="email" etiqueta="Correo electrónico" requerido error={form.errors.email}>
                    <Input
                        {...propsCampo('email', form.errors.email)}
                        type="email"
                        required
                        autoComplete="off"
                        spellCheck={false}
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <fieldset className="grid gap-2" aria-describedby={form.errors.rol ? 'rol-error' : undefined}>
                    <legend className="mb-1.5 text-sm leading-none font-medium">
                        Rol <span aria-hidden="true">*</span>
                    </legend>
                    {roles.map((r, i) => {
                        // El primero lleva el id "rol" para recibir el foco si el campo tiene error
                        const id = i === 0 ? 'rol' : `rol-${r.valor}`;
                        const elegido = form.data.rol === r.valor;
                        return (
                            <label
                                key={r.valor}
                                htmlFor={id}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-[color,border-color,box-shadow] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/25',
                                    elegido ? 'border-primary bg-secondary/60' : 'hover:bg-muted/50',
                                    form.errors.rol && !form.data.rol && 'border-critical/60',
                                )}
                            >
                                <input
                                    id={id}
                                    type="radio"
                                    name="rol"
                                    value={r.valor}
                                    checked={elegido}
                                    onChange={() => form.setData('rol', r.valor)}
                                    required
                                    aria-invalid={form.errors.rol ? true : undefined}
                                    // Nombre: solo el rol; la descripción se lee como descripción
                                    aria-labelledby={`${id}-nombre`}
                                    aria-describedby={`${id}-descripcion`}
                                    className="accent-primary mt-0.5 size-4 shrink-0 outline-hidden"
                                />
                                <span>
                                    <span id={`${id}-nombre`} className="block text-sm font-semibold">
                                        {r.label}
                                    </span>
                                    <span id={`${id}-descripcion`} className="text-muted-foreground block text-xs">
                                        {r.descripcion}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                    <InputError id="rol-error" message={form.errors.rol} />
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="empresa_id" etiqueta="Empresa" error={form.errors.empresa_id}>
                        <Selector
                            {...propsCampo('empresa_id', form.errors.empresa_id)}
                            valor={form.data.empresa_id}
                            onCambio={cambiarEmpresa}
                            opciones={[
                                { valor: '', texto: 'Ninguna · personal propio' },
                                ...empresasFormulario.map((e) => ({ valor: String(e.id), texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` })),
                            ]}
                        />
                    </Campo>
                    <Campo
                        id="sede_id"
                        etiqueta="Sede"
                        ayuda={
                            sedesFormulario.length === 0
                                ? empresaElegida
                                    ? `${empresaElegida.nombre} aún no tiene sedes activas.`
                                    : 'Aún no hay sedes propias activas.'
                                : empresaElegida
                                  ? `Sedes de ${empresaElegida.nombre}.`
                                  : 'Sedes propias de Justo a Tiempo.'
                        }
                        error={form.errors.sede_id}
                    >
                        <Selector
                            {...propsCampo('sede_id', form.errors.sede_id, 'sede_id-ayuda')}
                            valor={form.data.sede_id}
                            onCambio={(v) => form.setData('sede_id', v)}
                            disabled={sedesFormulario.length === 0}
                            opciones={[
                                { valor: '', texto: 'Sin sede asignada' },
                                ...sedesFormulario.map((s) => ({ valor: String(s.id), texto: s.activo ? s.nombre : `${s.nombre} (inactiva)`, detalle: s.ciudad })),
                            ]}
                        />
                    </Campo>
                </div>

                <Campo
                    id="password"
                    etiqueta={editando ? 'Nueva contraseña' : 'Contraseña'}
                    requerido={!editando}
                    ayuda={editando ? 'Déjala en blanco para conservar la actual.' : 'Compártela con la persona por un medio seguro.'}
                    error={form.errors.password}
                >
                    <PasswordInput
                        {...propsCampo('password', form.errors.password, 'password-ayuda')}
                        required={!editando}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        value={form.data.password}
                        onChange={(e) => {
                            form.setData('password', e.target.value);
                            setGenerada(false);
                        }}
                        visible={verContrasena}
                        onVisibleChange={setVerContrasena}
                        // Monoespaciada solo para lo escrito: distingue l, I y 1 al dictarla; el texto guía queda normal
                        className={cn('h-10 rounded-lg', form.data.password && 'font-mono')}
                    />
                    <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={generar} className="text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden">
                            <Sparkles weight="bold" className="size-3.5" aria-hidden="true" />
                            Generar una segura
                        </button>
                        <span role="status" className="text-good text-xs font-medium">
                            {generada ? 'Contraseña generada: cópiala antes de guardar.' : ''}
                        </span>
                    </div>
                </Campo>
            </FormularioLateral>
        </AppLayout>
    );
}
