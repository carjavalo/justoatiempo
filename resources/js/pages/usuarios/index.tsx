import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { CampoDocumento } from '@/components/admin/campo-documento';
import { CampoImagen } from '@/components/admin/campo-imagen';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import {
    claseTd,
    claseTh,
    contenedorModulo,
    EncabezadoModulo,
    EstadoBadge,
    EstadoVacio,
    Iniciales,
    Paginacion,
    SinResultados,
    Tabla,
} from '@/components/admin/piezas';
import { IdCard, Plus, Sparkles, UsersRound, X } from '@/components/iconos';
import { PasswordInput } from '@/components/password-input';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { fechaHoraCompleta, haceCuanto } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaUsuario {
    id: number;
    nombre: string;
    nombres: string | null;
    primerApellido: string | null;
    segundoApellido: string | null;
    cedula: string | null;
    cargo: string | null;
    email: string;
    rolId: number | null;
    /** Rol dentro de la empresa (auxiliar, conductor…). */
    rolNombre: string;
    /** Su rol ve todas las líneas (sin línea asignada, las tiene todas). */
    todasLasLineas: boolean;
    /** Si quien mira puede editarla o desactivarla: solo a quien tiene, como mucho, sus mismos permisos. */
    editable: boolean;
    empresaId: number | null;
    empresa: string | null;
    sedeId: number | null;
    sede: string | null;
    sucursalId: number | null;
    sucursal: string | null;
    /** Dirección de la foto (solo para la administración), si tiene. */
    foto: string | null;
    /** Dirección del certificado de ARL (solo para la administración), si tiene. */
    arl: string | null;
    arlEsPdf: boolean;
    lineaId: number | null;
    linea: string | null;
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
    filtros: { q: string; rol: string; estado: string; empresa: string; sede: string; sucursal: string; linea: string };
    contexto: { empresa: string | null; sede: string | null; sucursal: string | null };
    /**
     * Roles de la empresa con lo que permite cada uno. asignable: el rol de quien edita lo cubre (nadie da más acceso
     * del que tiene); inicio: a dónde entra quien lo tenga al ingresar.
     */
    roles: {
        id: number;
        nombre: string;
        resumen: string;
        alcance: string;
        todasLasLineas: boolean;
        inicio: 'linea' | 'panel' | 'sinTablero';
        asignable: boolean;
        activo: boolean;
    }[];
    /** Dónde puede asignar personas quien crea o edita: su empresa, sede, sucursal y línea fijas (null: sin límite). */
    limites: { empresaId: number | null; sedeId: number | null; sucursalId: number | null; lineaId: number | null; unaLinea: boolean };
    /** Cada empresa con las líneas de servicio que recibe. */
    empresas: (Opcion & { lineas: number[] })[];
    sedes: (Opcion & { empresaId: number })[];
    /** Sin sede son las sucursales propias de Justo a Tiempo. */
    sucursales: (Opcion & { ciudad: string; sedeId: number | null })[];
    lineas: { id: number; slug: string; nombre: string }[];
}

const VACIO = {
    nombres: '',
    primer_apellido: '',
    segundo_apellido: '',
    cedula: '',
    cargo: '',
    email: '',
    rol_id: '',
    linea_id: '',
    empresa_id: '',
    sede_id: '',
    sucursal_id: '',
    foto: null as File | null,
    quitar_foto: false,
    arl: null as File | null,
    quitar_arl: false,
    password: '',
};
const ORDEN_CAMPOS = [
    'nombres',
    'primer_apellido',
    'segundo_apellido',
    'cedula',
    'cargo',
    'email',
    'rol_id',
    'linea_id',
    'empresa_id',
    'sede_id',
    'sucursal_id',
    'foto',
    'arl',
    'password',
];

/** Línea de un administrador que las tiene todas (se guarda sin línea). */
const TODAS = 'todas';

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

export default function Usuarios({ usuarios, total, filtros, contexto, roles, limites, empresas, sedes, sucursales, lineas }: Props) {
    const puede = usePuede();
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
                      cedula: usuario.cedula ?? '',
                      cargo: usuario.cargo ?? '',
                      email: usuario.email,
                      rol_id: usuario.rolId ? String(usuario.rolId) : '',
                      linea_id: usuario.lineaId ? String(usuario.lineaId) : usuario.todasLasLineas ? TODAS : '',
                      empresa_id: usuario.empresaId ? String(usuario.empresaId) : '',
                      sede_id: usuario.sedeId ? String(usuario.sedeId) : '',
                      sucursal_id: usuario.sucursalId ? String(usuario.sucursalId) : '',
                      foto: null,
                      quitar_foto: false,
                      arl: null,
                      quitar_arl: false,
                      password: '',
                  }
                : // Si la lista viene filtrada por empresa, sede o sucursal, el usuario nuevo nace ahí
                  // y siempre dentro de los límites de quien lo crea (su empresa, sede, sucursal y línea, si los tiene)
                  { ...VACIO, ...asignacionFija(), ...asignacionDesdeFiltros() },
        );
        setAbierto(true);
    };

    const asignacionFija = () => ({
        ...(limites.empresaId && { empresa_id: String(limites.empresaId) }),
        ...(limites.sedeId && { sede_id: String(limites.sedeId) }),
        ...(limites.sucursalId && { sucursal_id: String(limites.sucursalId) }),
        ...(limites.unaLinea && limites.lineaId && { linea_id: String(limites.lineaId) }),
    });

    const asignacionDesdeFiltros = () => {
        // Si la lista viene filtrada por línea (desde la página de una línea), el usuario nuevo trabaja en ella
        const lineaFiltro = lineas.find((l) => String(l.id) === valores.linea);
        const linea = lineaFiltro ? { linea_id: String(lineaFiltro.id) } : {};
        const sucursal = sucursales.find((u) => String(u.id) === valores.sucursal && u.activo);
        const sede = sedes.find((x) => (sucursal ? x.id === sucursal.sedeId : String(x.id) === valores.sede) && x.activo);
        // La empresa solo se llena si está activa y recibe la línea del filtro (si no, el formulario no la ofrece)
        const empresa = empresas.find(
            (e) => (sede ? e.id === sede.empresaId : String(e.id) === valores.empresa) && e.activo && (!lineaFiltro || e.lineas.includes(lineaFiltro.id)),
        );
        return {
            ...linea,
            ...(empresa && { empresa_id: String(empresa.id) }),
            ...(sede && empresa && { sede_id: String(sede.id) }),
            // Una sucursal propia solo aplica sin empresa; una de sede, con su sede y su empresa
            ...(sucursal && (sucursal.sedeId === null ? !empresa : sede && empresa) && { sucursal_id: String(sucursal.id) }),
        };
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        // Con una imagen al editar, el envío va como formulario con archivos, que PHP solo lee en POST: se marca como edición
        const conArchivoAlEditar = Boolean(editando && (form.data.foto || form.data.arl));
        form.transform((d) => (conArchivoAlEditar ? { ...d, _method: 'put' } : d));
        if (!editando) form.post(route('usuarios.store'), opciones);
        else if (conArchivoAlEditar) form.post(route('usuarios.update', editando.id), opciones);
        else form.put(route('usuarios.update', editando.id), opciones);
    };

    // El rol dice qué puede hacer en la plataforma; si ve todas las líneas, la persona puede tenerlas todas
    const rolElegido = roles.find((r) => String(r.id) === form.data.rol_id);
    const todasLasLineas = Boolean(rolElegido?.todasLasLineas);
    // Se ofrecen los roles activos que el propio rol cubre y, al editar, el que ya tiene
    const rolesFormulario = roles.filter((r) => (r.activo && r.asignable) || r.id === editando?.rolId);

    // Cascada línea → empresa → sede → sucursal: la empresa (donde presta el servicio) debe recibir la línea, la
    // sede es de la empresa y la sucursal, de la sede. Sin empresa no hay sede: solo las sucursales propias de Justo a Tiempo.
    const lineaId = form.data.linea_id && form.data.linea_id !== TODAS ? Number(form.data.linea_id) : null;
    const empresaId = form.data.empresa_id ? Number(form.data.empresa_id) : null;
    const sedeId = form.data.sede_id ? Number(form.data.sede_id) : null;
    const empresaElegida = empresas.find((e) => e.id === empresaId);
    const sedeElegida = sedes.find((x) => x.id === sedeId);
    const empresasFormulario = empresas.filter((e) => (e.activo || e.id === empresaId) && (!lineaId || e.lineas.includes(lineaId)));
    const sedesFormulario = empresaId ? sedes.filter((x) => x.empresaId === empresaId && (x.activo || x.id === sedeId)) : [];
    const sucursalesFormulario =
        empresaId && !sedeId ? [] : sucursales.filter((u) => u.sedeId === sedeId && (u.activo || String(u.id) === form.data.sucursal_id));
    const lineaElegida = lineas.find((l) => l.id === lineaId);

    /** Lo que sigue valiendo de la sede y la sucursal al cambiar la empresa o la sede. */
    const conservar = (empresa: number | null, sede: number | null) => {
        const sedeSigue = sede !== null && sedes.some((x) => x.id === sede && x.empresaId === empresa);
        const sedeFinal = sedeSigue ? sede : null;
        const sucursalSigue = sucursales.some(
            (u) => String(u.id) === form.data.sucursal_id && u.sedeId === sedeFinal && (sedeFinal !== null || empresa === null),
        );
        return { sede_id: sedeFinal ? String(sedeFinal) : '', sucursal_id: sucursalSigue ? form.data.sucursal_id : '' };
    };

    const cambiarRol = (valor: string) => {
        const todas = Boolean(roles.find((r) => String(r.id) === valor)?.todasLasLineas);
        // "Todas las líneas" es solo para roles que las ven todas: con otro rol hay que elegir una
        const linea = todas ? form.data.linea_id || TODAS : form.data.linea_id === TODAS ? '' : form.data.linea_id;
        form.setData((d) => ({ ...d, rol_id: valor, linea_id: linea }));
    };
    const cambiarLinea = (valor: string) => {
        const id = valor && valor !== TODAS ? Number(valor) : null;
        const empresaSigue = !empresaElegida || !id || empresaElegida.lineas.includes(id);
        form.setData((d) => ({ ...d, linea_id: valor, ...(empresaSigue ? {} : { empresa_id: '', sede_id: '', sucursal_id: '' }) }));
    };
    const cambiarEmpresa = (valor: string) => {
        form.setData((d) => ({ ...d, empresa_id: valor, ...conservar(valor ? Number(valor) : null, sedeId) }));
    };
    const cambiarSede = (valor: string) => {
        form.setData((d) => ({ ...d, ...conservar(empresaId, valor ? Number(valor) : null) }));
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

    type CampoChip = 'empresa' | 'sede' | 'sucursal';
    const chips: { campo: CampoChip; texto: string }[] = [
        contexto.empresa && { campo: 'empresa' as const, texto: `Empresa: ${contexto.empresa}` },
        contexto.sede && { campo: 'sede' as const, texto: `Sede: ${contexto.sede}` },
        contexto.sucursal && { campo: 'sucursal' as const, texto: `Sucursal: ${contexto.sucursal}` },
    ].filter((c): c is { campo: CampoChip; texto: string } => Boolean(c));
    const soloUnChip = chips.length === 1 && !valores.q && !valores.rol && !valores.estado && !valores.linea;

    return (
        <AppLayout>
            <Head title="Usuarios" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Usuarios"
                    descripcion="Quién puede ingresar a la plataforma, con qué rol, en qué línea y dónde trabaja (empresa, sede y sucursal)."
                    accion={total > 0 && puede('usuarios.crear') && botonNuevo('Nuevo usuario')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={UsersRound}
                        titulo="Aún no hay usuarios"
                        texto="Crea el acceso de cada persona con su rol, su línea y dónde trabaja."
                        accion={puede('usuarios.crear') && botonNuevo('Crear el primer usuario')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={
                                usuarios.total
                                    ? `${usuarios.total} ${usuarios.total === 1 ? 'usuario' : 'usuarios'}`
                                    : 'Ningún usuario coincide con los filtros.'
                            }
                            soloAnunciar={usuarios.total === 0}
                            activos={activos && !soloUnChip}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-usuarios"
                        >
                            <CampoBusqueda
                                id="buscar-usuarios"
                                etiqueta="Buscar usuarios"
                                placeholder="Buscar por nombre o correo"
                                valor={valores.q}
                                onCambio={(v) => cambiar('q', v, { inmediato: false })}
                            />
                            <FiltroLista
                                id="filtro-rol"
                                etiqueta="Rol"
                                valor={valores.rol}
                                onCambio={(v) => cambiar('rol', v)}
                                opciones={[{ valor: '', texto: 'Todos los roles' }, ...roles.map((r) => ({ valor: String(r.id), texto: r.nombre }))]}
                            />
                            <FiltroLista
                                id="filtro-linea"
                                etiqueta="Línea de servicio"
                                valor={valores.linea}
                                onCambio={(v) => cambiar('linea', v)}
                                className="sm:w-60"
                                opciones={[
                                    { valor: '', texto: 'Todas las líneas' },
                                    ...lineas.map((l) => ({ valor: String(l.id), texto: l.nombre })),
                                ]}
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
                                <span
                                    key={c.campo}
                                    className="bg-secondary text-secondary-foreground inline-flex h-10 items-center gap-1 rounded-lg pr-1 pl-3 text-sm font-medium"
                                >
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
                            <Tabla titulo="Usuarios de la plataforma" minimo="min-w-[980px]" columnas={['26%', '17%', '16%', '16.5%', '9%', '11%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Usuario
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Rol
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Línea de servicio
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Dónde trabaja
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
                                                    {u.foto ? (
                                                        // Decorativa: el nombre va al lado
                                                        <img
                                                            src={u.foto}
                                                            alt=""
                                                            loading="lazy"
                                                            className="bg-muted size-9 shrink-0 rounded-xl object-cover object-[50%_20%]"
                                                        />
                                                    ) : (
                                                        <Iniciales
                                                            texto={u.nombre}
                                                            className={u.esUsted ? 'bg-brand-coral text-brand-coral-foreground' : undefined}
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-foreground flex items-center gap-2 font-semibold">
                                                            <span className="truncate" title={u.nombre}>
                                                                {u.nombre}
                                                            </span>
                                                            {u.esUsted && (
                                                                <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                                                                    Tú
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs" title={u.email}>
                                                            {u.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                <p className="truncate" title={u.rolNombre}>
                                                    {u.rolNombre}
                                                </p>
                                                {u.cargo && u.cargo !== u.rolNombre && (
                                                    <p className="text-muted-foreground truncate text-xs" title={u.cargo}>
                                                        {u.cargo}
                                                    </p>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                {u.linea ? (
                                                    <p className="truncate" title={u.linea}>
                                                        {u.linea}
                                                    </p>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">{u.todasLasLineas ? 'Todas' : 'Sin línea asignada'}</span>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                {u.empresa ? (
                                                    <>
                                                        <p className="text-foreground truncate" title={u.empresa}>
                                                            {u.empresa}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs" title={[u.sede, u.sucursal].filter(Boolean).join(' · ') || undefined}>
                                                            {[u.sede, u.sucursal].filter(Boolean).join(' · ') || 'Sin sucursal asignada'}
                                                        </p>
                                                    </>
                                                ) : u.sucursal ? (
                                                    <>
                                                        <p className="text-foreground truncate" title={u.sucursal}>
                                                            {u.sucursal}
                                                        </p>
                                                        <p className="text-muted-foreground text-xs">Sucursal propia</p>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Sin empresa asignada</span>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={u.activo} />
                                            </td>
                                            <td className={cn(claseTd, 'text-xs')}>
                                                {u.ultimoAcceso ? (
                                                    <time
                                                        dateTime={u.ultimoAcceso}
                                                        title={fechaHoraCompleta.format(new Date(u.ultimoAcceso))}
                                                        className="inline-block first-letter:uppercase"
                                                    >
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
                                                    // Nadie se desactiva a sí mismo, ni toca a quien tiene más permisos que él
                                                    urlEstado={!u.esUsted && u.editable && puede('usuarios.estado') ? route('usuarios.estado', u.id) : undefined}
                                                    onEditar={u.editable && puede('usuarios.editar') ? (boton) => abrir(u, boton) : undefined}
                                                    consecuencia="Perderá el acceso de inmediato, incluso si tiene la sesión abierta. Podrás devolverle el acceso cuando quieras."
                                                    enlaces={[{ texto: 'Ver carnet', href: route('usuarios.carnet', u.id), icono: IdCard }]}
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
                descripcion={
                    editando ? `Actualiza el acceso de ${editando.nombre}.` : 'La persona ingresará con este correo y la contraseña que le asignes.'
                }
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

                {/* Van en el carnet */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="cedula" etiqueta="Cédula" ayuda="Solo los números." error={form.errors.cedula}>
                        <Input
                            {...propsCampo('cedula', form.errors.cedula, 'cedula-ayuda')}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Ej.: 1144123456"
                            value={form.data.cedula}
                            onChange={(e) => form.setData('cedula', e.target.value)}
                            className="h-10 rounded-lg tabular-nums"
                        />
                    </Campo>
                    <Campo id="cargo" etiqueta="Cargo" requerido ayuda="Como aparece en el carnet." error={form.errors.cargo}>
                        <Input
                            {...propsCampo('cargo', form.errors.cargo, 'cargo-ayuda')}
                            required
                            autoComplete="off"
                            placeholder="Ej.: Auxiliar logístico"
                            maxLength={60}
                            value={form.data.cargo}
                            onChange={(e) => form.setData('cargo', e.target.value)}
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

                <Campo
                    id="rol_id"
                    etiqueta="Rol"
                    requerido
                    ayuda={
                        rolElegido
                            ? `${rolElegido.resumen} · ${rolElegido.alcance}. Sus permisos se cambian en la sección Roles.`
                            : 'Su rol dentro de la empresa. Los roles y sus permisos se crean en la sección Roles.'
                    }
                    error={form.errors.rol_id}
                >
                    <Selector
                        {...propsCampo('rol_id', form.errors.rol_id, 'rol_id-ayuda')}
                        valor={form.data.rol_id}
                        onCambio={cambiarRol}
                        placeholder="Elige el rol"
                        opciones={rolesFormulario.map((r) => ({
                            valor: String(r.id),
                            texto: r.activo ? r.nombre : `${r.nombre} (inactivo)`,
                            // Lo que permite, en corto
                            detalle: r.resumen,
                        }))}
                    />
                </Campo>

                <Campo
                    id="linea_id"
                    etiqueta="Línea de servicio"
                    requerido
                    ayuda={
                        todasLasLineas
                            ? 'Su rol ve todas las líneas: puede tenerlas todas o la línea en la que trabaja.'
                            : rolElegido?.inicio === 'linea'
                              ? 'Al ingresar entrará directo a esta línea.'
                              : rolElegido?.inicio === 'panel'
                                ? 'Al ingresar verá el panel con lo que su rol le permite.'
                                : rolElegido?.inicio === 'sinTablero'
                                  ? 'Su rol no abre el tablero de la línea: al ingresar solo verá su carnet.'
                                  : 'La línea en la que trabaja.'
                    }
                    error={form.errors.linea_id}
                >
                    <Selector
                        {...propsCampo('linea_id', form.errors.linea_id, 'linea_id-ayuda')}
                        valor={form.data.linea_id}
                        onCambio={cambiarLinea}
                        placeholder="Elige la línea en la que trabaja"
                        // "Todas" está siempre en la lista (si apareciera junto con su elección, la lista no la tomaría)
                        opciones={[
                            // Quien solo ve su línea no la ofrece
                            ...(limites.unaLinea
                                ? []
                                : [{ valor: TODAS, texto: 'Todas las líneas', detalle: todasLasLineas ? undefined : 'Solo para roles que ven todas', deshabilitada: !todasLasLineas }]),
                            ...lineas.map((l) => ({ valor: String(l.id), texto: l.nombre })),
                        ]}
                    />
                </Campo>

                <Campo
                    id="empresa_id"
                    etiqueta="Empresa"
                    ayuda={
                        lineaElegida
                            ? empresasFormulario.length > 0
                                ? `Donde presta el servicio: empresas que reciben ${lineaElegida.nombre.toLowerCase()}.`
                                : `Ninguna empresa recibe ${lineaElegida.nombre.toLowerCase()} todavía.`
                            : 'La empresa donde presta el servicio.'
                    }
                    error={form.errors.empresa_id}
                >
                    <Selector
                        {...propsCampo('empresa_id', form.errors.empresa_id, 'empresa_id-ayuda')}
                        valor={form.data.empresa_id}
                        onCambio={cambiarEmpresa}
                        opciones={[
                            // Quien solo ve su empresa asigna personas únicamente a ella
                            ...(limites.empresaId ? [] : [{ valor: '', texto: 'Sin empresa asignada' }]),
                            ...empresasFormulario.map((e) => ({
                                valor: String(e.id),
                                texto: e.activo ? e.nombre : `${e.nombre} (inactiva)`,
                            })),
                        ]}
                    />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo
                        id="sede_id"
                        etiqueta="Sede"
                        ayuda={
                            !empresaElegida
                                ? 'Elige primero la empresa.'
                                : sedesFormulario.length === 0
                                  ? `${empresaElegida.nombre} aún no tiene sedes activas.`
                                  : `Sedes de ${empresaElegida.nombre}.`
                        }
                        error={form.errors.sede_id}
                    >
                        <Selector
                            {...propsCampo('sede_id', form.errors.sede_id, 'sede_id-ayuda')}
                            valor={form.data.sede_id}
                            onCambio={cambiarSede}
                            disabled={sedesFormulario.length === 0}
                            opciones={[
                                ...(limites.sedeId ? [] : [{ valor: '', texto: 'Sin sede asignada' }]),
                                ...sedesFormulario.map((x) => ({
                                    valor: String(x.id),
                                    texto: x.activo ? x.nombre : `${x.nombre} (inactiva)`,
                                })),
                            ]}
                        />
                    </Campo>
                    <Campo
                        id="sucursal_id"
                        etiqueta="Sucursal"
                        ayuda={
                            empresaElegida && !sedeElegida
                                ? 'Elige primero la sede.'
                                : sedeElegida
                                  ? sucursalesFormulario.length === 0
                                      ? `${sedeElegida.nombre} aún no tiene sucursales activas.`
                                      : `Sucursales de ${sedeElegida.nombre}.`
                                  : // Sin empresa solo caben las sucursales propias de Justo a Tiempo, si las hay
                                    sucursalesFormulario.length === 0
                                    ? 'Elige primero la empresa.'
                                    : 'Sin empresa: sucursales propias de Justo a Tiempo.'
                        }
                        error={form.errors.sucursal_id}
                    >
                        <Selector
                            {...propsCampo('sucursal_id', form.errors.sucursal_id, 'sucursal_id-ayuda')}
                            valor={form.data.sucursal_id}
                            onCambio={(v) => form.setData('sucursal_id', v)}
                            disabled={sucursalesFormulario.length === 0}
                            opciones={[
                                ...(limites.sucursalId ? [] : [{ valor: '', texto: 'Sin sucursal asignada' }]),
                                ...sucursalesFormulario.map((u) => ({
                                    valor: String(u.id),
                                    texto: u.activo ? u.nombre : `${u.nombre} (inactiva)`,
                                    detalle: u.ciudad,
                                })),
                            ]}
                        />
                    </Campo>
                </div>

                <CampoImagen
                    id="foto"
                    etiqueta="Foto para el carnet"
                    ayuda="De frente y con fondo blanco o sin fondo (PNG transparente). Con ella la plataforma arma el carnet."
                    error={form.errors.foto}
                    archivo={form.data.foto}
                    actual={editando?.foto ?? null}
                    quitar={form.data.quitar_foto}
                    descripcion={`Foto de ${editando?.nombre ?? ([form.data.nombres, form.data.primer_apellido].filter(Boolean).join(' ') || 'la persona')}`}
                    onArchivo={(archivo) => form.setData('foto', archivo)}
                    onQuitar={(quitar) => form.setData('quitar_foto', quitar)}
                />

                <CampoDocumento
                    id="arl"
                    etiqueta="Certificado de ARL"
                    ayuda="PDF o imagen. Se muestra a quien escanee el QR del carnet."
                    error={form.errors.arl}
                    archivo={form.data.arl}
                    actual={editando?.arl ?? null}
                    actualEsPdf={editando?.arlEsPdf ?? false}
                    quitar={form.data.quitar_arl}
                    nombre="la ARL"
                    onArchivo={(archivo) => form.setData('arl', archivo)}
                    onQuitar={(quitar) => form.setData('quitar_arl', quitar)}
                />

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
                        <button
                            type="button"
                            onClick={generar}
                            className="text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                        >
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
