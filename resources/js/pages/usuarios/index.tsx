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
import { CalendarRange, IdCard, Plus, Sparkles, UsersRound, X } from '@/components/iconos';
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
    /** Si quien mira puede editarla o desactivarla: solo a quien tiene, como mucho, sus mismos permisos. */
    editable: boolean;
    /** Su rol ve todas las líneas. */
    todasLasLineas: boolean;
    /** Dónde presta el servicio hoy (sus asignaciones vigentes): el lugar y las líneas que hace allí. */
    asignaciones: { lugar: string; lineas: string[] }[];
    /** Dirección de la foto (solo para la administración), si tiene. */
    foto: string | null;
    /** Dirección del certificado de ARL (solo para la administración), si tiene. */
    arl: string | null;
    arlEsPdf: boolean;
    activo: boolean;
    ultimoAcceso: string | null;
    esUsted: boolean;
}

interface Props {
    usuarios: Paginado<FilaUsuario>;
    total: number;
    filtros: { q: string; rol: string; estado: string; empresa: string; sede: string; sucursal: string; linea: string };
    contexto: { empresa: string | null; sede: string | null; sucursal: string | null };
    /** Roles de la empresa con lo que permite cada uno. asignable: el rol de quien edita lo cubre (nadie da más acceso del que tiene). */
    roles: { id: number; nombre: string; resumen: string; alcance: string; asignable: boolean; activo: boolean }[];
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
    'foto',
    'arl',
    'password',
];

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

export default function Usuarios({ usuarios, total, filtros, contexto, roles, lineas }: Props) {
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
                      foto: null,
                      quitar_foto: false,
                      arl: null,
                      quitar_arl: false,
                      password: '',
                  }
                : VACIO,
        );
        setAbierto(true);
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

    // El rol dice qué puede hacer en la plataforma
    const rolElegido = roles.find((r) => String(r.id) === form.data.rol_id);
    // Se ofrecen los roles activos que el propio rol cubre y, al editar, el que ya tiene
    const rolesFormulario = roles.filter((r) => (r.activo && r.asignable) || r.id === editando?.rolId);

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
                    descripcion="Quién puede ingresar a la plataforma, con qué rol y su carnet. Dónde presta el servicio (empresas, sedes, sucursales y líneas) se maneja en Asignaciones."
                    accion={total > 0 && puede('usuarios.crear') && botonNuevo('Nuevo usuario')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={UsersRound}
                        titulo="Aún no hay usuarios"
                        texto="Crea el acceso de cada persona con su rol y su carnet. Después la asignas a las empresas donde presta el servicio."
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
                                            Dónde presta el servicio
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Líneas
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
                                                {u.asignaciones.length === 0 ? (
                                                    <span className="text-muted-foreground text-xs">Sin asignación</span>
                                                ) : (
                                                    <>
                                                        <p className="text-foreground truncate" title={u.asignaciones.map((a) => a.lugar).join(' / ')}>
                                                            {u.asignaciones[0].lugar}
                                                        </p>
                                                        {u.asignaciones.length > 1 && (
                                                            <p className="text-muted-foreground text-xs">y {u.asignaciones.length - 1 === 1 ? 'otra asignación' : `${u.asignaciones.length - 1} asignaciones más`}</p>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                {(() => {
                                                    const nombres = [...new Set(u.asignaciones.flatMap((a) => a.lineas))];
                                                    return nombres.length === 0 ? (
                                                        <span className="text-muted-foreground text-xs">{u.todasLasLineas ? 'Todas (su rol las ve todas)' : 'Ninguna'}</span>
                                                    ) : (
                                                        <p className="line-clamp-2 text-xs leading-relaxed" title={nombres.join(', ')}>
                                                            {nombres.join(', ')}
                                                        </p>
                                                    );
                                                })()}
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
                                                    enlaces={[
                                                        { texto: 'Ver carnet', href: route('usuarios.carnet', u.id), icono: IdCard },
                                                        ...(puede('asignaciones.ver') ? [{ texto: 'Asignaciones', href: route('asignaciones.index', { usuario: u.id }), icono: CalendarRange }] : []),
                                                    ]}
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
                        onCambio={(v) => form.setData('rol_id', v)}
                        placeholder="Elige el rol"
                        opciones={rolesFormulario.map((r) => ({
                            valor: String(r.id),
                            texto: r.activo ? r.nombre : `${r.nombre} (inactivo)`,
                            // Lo que permite, en corto
                            detalle: r.resumen,
                        }))}
                    />
                </Campo>

                {/* Dónde presta el servicio va aparte, en Asignaciones */}
                <p className="bg-secondary/60 text-secondary-foreground flex items-start gap-3 rounded-xl px-4 py-3 text-sm">
                    <CalendarRange className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                        {editando
                            ? 'Sus empresas, sedes, sucursales y líneas de servicio se cambian en Asignaciones.'
                            : 'Después de crearla, la asignas a las empresas donde presta el servicio, con sus líneas y su periodo.'}
                    </span>
                </p>

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
