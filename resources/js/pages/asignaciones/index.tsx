import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { contenedorModulo, EncabezadoModulo, EstadoVacio, Iniciales, Paginacion, SinResultados } from '@/components/admin/piezas';
import { Building2, CalendarClock, CalendarRange, Layers, MapPinned, MoreHorizontal, Pencil, Plus, Undo2, UsersRound } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { aFecha, fmt } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { SERVICIOS } from '@/lib/portafolio';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

type Estado = 'vigente' | 'programada' | 'terminada';

interface Asignacion {
    id: number;
    empresaId: number | null;
    empresa: string | null;
    sedeId: number | null;
    sede: string | null;
    sucursalId: number | null;
    sucursal: string | null;
    lineas: { id: number; slug: string; nombre: string }[];
    fechaInicio: string;
    fechaFin: string | null;
    duracion: string;
    cantidad: number | null;
    duracionTexto: string;
    estado: Estado;
    /** Si quien mira puede editarla y terminarla. */
    editable: boolean;
}

interface Persona {
    id: number;
    nombre: string;
    cargo: string;
    rol: string;
    activo: boolean;
    foto: string | null;
    /** Si quien mira puede asignarla (a quien cubre su rol y nunca a sí mismo, salvo quien lo ve todo). */
    asignable: boolean;
    asignaciones: Asignacion[];
}

interface Opcion {
    id: number;
    nombre: string;
    activo: boolean;
}

interface Props {
    personas: Paginado<Persona>;
    filtros: { q: string; empresa: string; linea: string; estado: string; usuario: string };
    resumen: { vigentes: number; programadas: number; terminanPronto: number; sinAsignacion: number };
    opciones: {
        personas: { id: number; nombre: string; detalle: string }[];
        empresas: (Opcion & { lineas: number[] })[];
        sedes: (Opcion & { empresaId: number })[];
        sucursales: (Opcion & { ciudad: string; sedeId: number | null })[];
        lineas: { id: number; slug: string; nombre: string }[];
        /** Si puede asignar a toda una línea, sin empresa. */
        sinEmpresa: boolean;
        duraciones: { valor: string; texto: string }[];
    };
    empresasFiltro: { id: number; nombre: string }[];
}

const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const VACIO = {
    usuario_id: '',
    empresa_id: '',
    sede_id: '',
    sucursal_id: '',
    lineas: [] as number[],
    fecha_inicio: hoy(),
    duracion: 'indefinida',
    duracion_cantidad: '',
    fecha_fin: '',
};
const ORDEN_CAMPOS = ['usuario_id', 'empresa_id', 'sede_id', 'sucursal_id', 'lineas', 'fecha_inicio', 'duracion', 'duracion_cantidad', 'fecha_fin'];
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fecha de fin según la duración, igual que el servidor (contando el día de inicio). */
function calcularFin(inicio: string, duracion: string, cantidad: number, fin: string): string | null {
    if (!inicio) return null;
    const d = aFecha(inicio);
    const n = Math.max(1, cantidad || 1);
    switch (duracion) {
        case 'dias':
            d.setDate(d.getDate() + n - 1);
            return iso(d);
        case 'semanas':
            d.setDate(d.getDate() + n * 7 - 1);
            return iso(d);
        case 'meses': {
            const dia = d.getDate();
            d.setDate(1);
            d.setMonth(d.getMonth() + n);
            // Sin desbordar: el 31 de enero + 1 mes es el 28 (o 29) de febrero
            d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
            d.setDate(d.getDate() - 1);
            return iso(d);
        }
        case 'fechas':
            return fin || null;
        default:
            return null;
    }
}

const diasEntre = (a: string, b: string) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);

const ESTADOS: Record<Estado, { texto: string; clase: string; punto: string }> = {
    vigente: { texto: 'Vigente', clase: 'bg-good-soft text-good', punto: 'bg-good' },
    programada: { texto: 'Programada', clase: 'bg-secondary text-secondary-foreground', punto: 'bg-primary' },
    terminada: { texto: 'Terminada', clase: 'bg-muted text-muted-foreground', punto: 'bg-muted-foreground/60' },
};

export default function Asignaciones({ personas, filtros, resumen, opciones, empresasFiltro }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar, activos } = useFiltros(route('asignaciones.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<{ persona: Persona | null; asignacion: Asignacion } | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const [terminando, setTerminando] = useState<{ persona: Persona; asignacion: Asignacion } | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrirNueva = (personaId: number | null, boton: HTMLElement | null = null) => {
        setEditando(null);
        setOrigen(boton);
        form.clearErrors();
        form.setData({ ...VACIO, fecha_inicio: hoy(), usuario_id: personaId ? String(personaId) : '' });
        setAbierto(true);
    };

    const abrirEdicion = (persona: Persona, a: Asignacion, boton: HTMLElement | null) => {
        setEditando({ persona, asignacion: a });
        setOrigen(boton);
        form.clearErrors();
        form.setData({
            usuario_id: String(persona.id),
            empresa_id: a.empresaId ? String(a.empresaId) : '',
            sede_id: a.sedeId ? String(a.sedeId) : '',
            sucursal_id: a.sucursalId ? String(a.sucursalId) : '',
            lineas: a.lineas.map((l) => l.id),
            fecha_inicio: a.fechaInicio,
            duracion: a.duracion,
            duracion_cantidad: a.cantidad ? String(a.cantidad) : '',
            fecha_fin: a.duracion === 'fechas' ? (a.fechaFin ?? '') : '',
        });
        setAbierto(true);
    };

    // Recién creado un usuario, se llega aquí para asignarlo: el formulario se abre con la persona elegida
    const abrioAlLlegar = useRef(false);
    useEffect(() => {
        if (abrioAlLlegar.current) return;
        abrioAlLlegar.current = true;
        const parametros = new URLSearchParams(window.location.search);
        const id = Number(parametros.get('usuario'));
        if (parametros.get('nueva') && id && opciones.personas.some((p) => p.id === id) && puede('asignaciones.crear')) abrirNueva(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const guardar = () => {
        const opcionesEnvio = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        form.transform(({ usuario_id, ...d }) => (editando ? d : { ...d, usuario_id }));
        if (editando) form.put(route('asignaciones.update', editando.asignacion.id), opcionesEnvio);
        else form.post(route('asignaciones.store'), opcionesEnvio);
    };

    // Cascada empresa → sede → sucursal; las líneas, las que la empresa recibe (sin empresa, todas las suyas)
    const empresaId = form.data.empresa_id ? Number(form.data.empresa_id) : null;
    const sedeId = form.data.sede_id ? Number(form.data.sede_id) : null;
    const empresaElegida = opciones.empresas.find((e) => e.id === empresaId);
    const sedeElegida = opciones.sedes.find((s) => s.id === sedeId);
    const sedesFormulario = empresaId ? opciones.sedes.filter((s) => s.empresaId === empresaId && (s.activo || s.id === sedeId)) : [];
    const sucursalesFormulario =
        empresaId && !sedeId ? [] : opciones.sucursales.filter((u) => u.sedeId === sedeId && (u.activo || String(u.id) === form.data.sucursal_id));
    const lineasFormulario = empresaElegida ? opciones.lineas.filter((l) => empresaElegida.lineas.includes(l.id)) : opciones.lineas;
    const empresasFormulario = opciones.empresas.filter((e) => e.activo || e.id === empresaId);

    const cambiarEmpresa = (valor: string) => {
        const empresa = opciones.empresas.find((e) => String(e.id) === valor);
        form.setData((d) => ({
            ...d,
            empresa_id: valor,
            sede_id: '',
            sucursal_id: '',
            // Se quitan las líneas que la nueva empresa no recibe
            lineas: empresa ? d.lineas.filter((l) => empresa.lineas.includes(l)) : d.lineas,
        }));
    };
    const cambiarSede = (valor: string) => form.setData((d) => ({ ...d, sede_id: valor, sucursal_id: '' }));
    const alternarLinea = (id: number, marcada: boolean) =>
        form.setData('lineas', marcada ? [...form.data.lineas, id] : form.data.lineas.filter((l) => l !== id));

    // Resumen del periodo, en vivo
    const fin = calcularFin(form.data.fecha_inicio, form.data.duracion, Number(form.data.duracion_cantidad), form.data.fecha_fin);
    const resumenPeriodo = !form.data.fecha_inicio
        ? ''
        : form.data.duracion === 'indefinida'
          ? `Desde el ${fmt.fechaMedia(form.data.fecha_inicio)}, sin fecha de fin.`
          : fin && fin >= form.data.fecha_inicio
            ? `Del ${fmt.fechaMedia(form.data.fecha_inicio)} al ${fmt.fechaMedia(fin)} (${plural(diasEntre(form.data.fecha_inicio, fin) + 1, 'día', 'días')}).`
            : '';

    const nombrePersona = editando?.persona?.nombre ?? opciones.personas.find((p) => String(p.id) === form.data.usuario_id)?.nombre;

    const botonNueva = (
        <Button onClick={() => abrirNueva(filtros.usuario ? Number(filtros.usuario) : null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            Nueva asignación
        </Button>
    );

    const tarjetas: { id: string; titulo: string; valor: number; estado?: string; detalle: string }[] = [
        { id: 'vigentes', titulo: 'Vigentes', valor: resumen.vigentes, estado: 'vigentes', detalle: 'En curso hoy' },
        { id: 'programadas', titulo: 'Programadas', valor: resumen.programadas, estado: 'programadas', detalle: 'Empiezan más adelante' },
        { id: 'pronto', titulo: 'Terminan esta semana', valor: resumen.terminanPronto, detalle: 'En los próximos 7 días' },
        { id: 'sin', titulo: 'Sin asignación', valor: resumen.sinAsignacion, estado: 'sin', detalle: 'Personas activas sin dónde trabajar hoy' },
    ];

    return (
        <AppLayout>
            <Head title="Asignaciones" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Asignaciones"
                    descripcion="Dónde presta el servicio cada persona, qué líneas hace allí y por cuánto tiempo. Una persona puede estar en varias empresas a la vez; su carnet muestra las asignaciones vigentes."
                    accion={puede('asignaciones.crear') && opciones.personas.length > 0 && botonNueva}
                />

                {/* Resumen: cada cifra filtra la lista (salvo "terminan esta semana", que es solo un aviso) */}
                <ul role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {tarjetas.map((t) => {
                        const activa = t.estado !== undefined && valores.estado === t.estado;
                        const contenido = (
                            <>
                                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{t.titulo}</span>
                                <span className={cn('mt-1 text-3xl font-extrabold tabular-nums', t.id === 'pronto' && t.valor > 0 && 'text-warning')}>{t.valor}</span>
                                <span className="text-muted-foreground mt-0.5 text-xs">{t.detalle}</span>
                            </>
                        );
                        const clase = cn(
                            'bg-card flex h-full w-full flex-col items-start rounded-2xl border px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
                            activa && 'border-primary bg-secondary/60',
                        );
                        return (
                            <li key={t.id}>
                                {t.estado ? (
                                    <button
                                        type="button"
                                        aria-pressed={activa}
                                        onClick={() => cambiar('estado', activa ? '' : t.estado!)}
                                        className={cn(clase, 'hover:border-primary/40 focus-visible:ring-ring/25 focus-visible:border-ring transition-colors focus-visible:ring-[3px] focus-visible:outline-hidden')}
                                    >
                                        {contenido}
                                    </button>
                                ) : (
                                    <div className={clase}>{contenido}</div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                <BarraFiltros
                    resumen={personas.total ? plural(personas.total, 'persona', 'personas') : 'Ninguna persona coincide con los filtros.'}
                    soloAnunciar={personas.total === 0}
                    activos={activos}
                    onLimpiar={limpiar}
                    idBusqueda="buscar-personas"
                >
                    <CampoBusqueda id="buscar-personas" etiqueta="Buscar personas" placeholder="Buscar por nombre, correo o cédula" valor={valores.q} onCambio={(v) => cambiar('q', v, { inmediato: false })} />
                    <FiltroLista
                        id="filtro-empresa"
                        etiqueta="Empresa"
                        valor={valores.empresa}
                        onCambio={(v) => cambiar('empresa', v)}
                        opciones={[{ valor: '', texto: 'Todas las empresas' }, ...empresasFiltro.map((e) => ({ valor: String(e.id), texto: e.nombre }))]}
                    />
                    <FiltroLista
                        id="filtro-linea"
                        etiqueta="Línea de servicio"
                        valor={valores.linea}
                        onCambio={(v) => cambiar('linea', v)}
                        className="sm:w-60"
                        opciones={[{ valor: '', texto: 'Todas las líneas' }, ...opciones.lineas.map((l) => ({ valor: String(l.id), texto: l.nombre }))]}
                    />
                    <FiltroLista
                        id="filtro-estado"
                        etiqueta="Estado"
                        valor={valores.estado}
                        onCambio={(v) => cambiar('estado', v)}
                        opciones={[
                            { valor: '', texto: 'Vigentes y programadas' },
                            { valor: 'vigentes', texto: 'Solo vigentes' },
                            { valor: 'programadas', texto: 'Solo programadas' },
                            { valor: 'terminadas', texto: 'Terminadas' },
                            { valor: 'sin', texto: 'Personas sin asignación' },
                        ]}
                    />
                </BarraFiltros>

                {personas.data.length === 0 ? (
                    activos ? (
                        <SinResultados texto="Ninguna persona coincide con los filtros." />
                    ) : (
                        <EstadoVacio
                            icono={CalendarRange}
                            titulo="Aún no hay asignaciones"
                            texto="Asigna a cada persona a la empresa donde presta el servicio, con su sede y su sucursal si aplica, las líneas que hace allí y por cuánto tiempo."
                            accion={puede('asignaciones.crear') && opciones.personas.length > 0 && botonNueva}
                        />
                    )
                ) : (
                    <ul role="list" className="grid gap-4">
                        {personas.data.map((p) => (
                            <TarjetaPersona
                                key={p.id}
                                persona={p}
                                onAsignar={(boton) => abrirNueva(p.id, boton)}
                                onEditar={(a, boton) => abrirEdicion(p, a, boton)}
                                onTerminar={(a) => setTerminando({ persona: p, asignacion: a })}
                            />
                        ))}
                    </ul>
                )}

                <Paginacion pagina={personas} nombre="personas" />
            </div>

            <ConfirmarTerminar objetivo={terminando} onCerrar={() => setTerminando(null)} />

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar asignación' : 'Nueva asignación'}
                descripcion={
                    editando
                        ? `De ${editando.persona?.nombre}: dónde presta el servicio, qué hace allí y hasta cuándo.`
                        : nombrePersona
                          ? `Dónde presta el servicio ${nombrePersona}, qué hace allí y por cuánto tiempo.`
                          : 'Dónde presta el servicio la persona, qué hace allí y por cuánto tiempo.'
                }
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Asignar'}
                focoAlCerrar={origen}
            >
                <Campo id="usuario_id" etiqueta="Persona" requerido error={form.errors.usuario_id}>
                    <Selector
                        {...propsCampo('usuario_id', form.errors.usuario_id)}
                        valor={form.data.usuario_id}
                        onCambio={(v) => form.setData('usuario_id', v)}
                        disabled={Boolean(editando)}
                        placeholder="Elige a la persona"
                        opciones={
                            editando
                                ? [{ valor: form.data.usuario_id, texto: editando.persona?.nombre ?? '' }]
                                : opciones.personas.map((p) => ({ valor: String(p.id), texto: p.nombre, detalle: p.detalle }))
                        }
                    />
                </Campo>

                <Campo
                    id="empresa_id"
                    etiqueta="Empresa"
                    requerido={!opciones.sinEmpresa}
                    ayuda={opciones.sinEmpresa ? 'Sin empresa, presta el servicio en toda la línea (todas sus empresas).' : 'Solo las empresas donde tú trabajas.'}
                    error={form.errors.empresa_id}
                >
                    <Selector
                        {...propsCampo('empresa_id', form.errors.empresa_id, 'empresa_id-ayuda')}
                        valor={form.data.empresa_id}
                        onCambio={cambiarEmpresa}
                        placeholder={opciones.sinEmpresa ? undefined : 'Elige la empresa'}
                        opciones={[
                            ...(opciones.sinEmpresa ? [{ valor: '', texto: 'Toda la línea', detalle: 'Sin una empresa en particular' }] : []),
                            ...empresasFormulario.map((e) => ({ valor: String(e.id), texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` })),
                        ]}
                    />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Campo
                        id="sede_id"
                        etiqueta="Sede"
                        ayuda={!empresaElegida ? 'Elige primero la empresa.' : sedesFormulario.length === 0 ? `${empresaElegida.nombre} aún no tiene sedes activas.` : 'Opcional.'}
                        error={form.errors.sede_id}
                    >
                        <Selector
                            {...propsCampo('sede_id', form.errors.sede_id, 'sede_id-ayuda')}
                            valor={form.data.sede_id}
                            onCambio={cambiarSede}
                            disabled={sedesFormulario.length === 0}
                            opciones={[{ valor: '', texto: 'Toda la empresa' }, ...sedesFormulario.map((s) => ({ valor: String(s.id), texto: s.activo ? s.nombre : `${s.nombre} (inactiva)` }))]}
                        />
                    </Campo>
                    <Campo
                        id="sucursal_id"
                        etiqueta="Sucursal"
                        ayuda={
                            empresaElegida && !sedeElegida
                                ? 'Elige primero la sede.'
                                : sucursalesFormulario.length === 0
                                  ? sedeElegida
                                      ? `${sedeElegida.nombre} aún no tiene sucursales activas.`
                                      : 'Elige primero la empresa.'
                                  : sedeElegida
                                    ? 'Opcional.'
                                    : 'Opcional: una sucursal propia de Justo a Tiempo.'
                        }
                        error={form.errors.sucursal_id}
                    >
                        <Selector
                            {...propsCampo('sucursal_id', form.errors.sucursal_id, 'sucursal_id-ayuda')}
                            valor={form.data.sucursal_id}
                            onCambio={(v) => form.setData('sucursal_id', v)}
                            disabled={sucursalesFormulario.length === 0}
                            opciones={[
                                { valor: '', texto: sedeElegida ? 'Toda la sede' : 'Sin sucursal' },
                                ...sucursalesFormulario.map((u) => ({ valor: String(u.id), texto: u.activo ? u.nombre : `${u.nombre} (inactiva)`, detalle: u.ciudad })),
                            ]}
                        />
                    </Campo>
                </div>

                <fieldset className="grid gap-2" aria-describedby={form.errors.lineas ? 'lineas-error' : 'lineas-ayuda'}>
                    <legend className="mb-1.5 text-sm leading-none font-medium">
                        Líneas de servicio que hará <span aria-hidden="true">*</span>
                    </legend>
                    <p id="lineas-ayuda" className="text-muted-foreground -mt-1 mb-1 text-xs">
                        {empresaElegida ? `Las que recibe ${empresaElegida.nombre}.` : 'Puede hacer varias.'}
                    </p>
                    {lineasFormulario.length === 0 ? (
                        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-sm">
                            {empresaElegida ? `${empresaElegida.nombre} aún no recibe ninguna de tus líneas.` : 'No tienes líneas para asignar.'}
                        </p>
                    ) : (
                        <ul role="list" className="grid gap-1.5">
                            {lineasFormulario.map((l, i) => {
                                const Icono = SERVICIOS.find((s) => s.id === l.slug)?.icono ?? Layers;
                                // La primera casilla lleva el id "lineas" para recibir el foco si el campo tiene error
                                const id = i === 0 ? 'lineas' : `linea-${l.id}`;
                                const marcada = form.data.lineas.includes(l.id);
                                return (
                                    <li
                                        key={l.id}
                                        className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors', marcada ? 'border-primary/40 bg-secondary/60' : 'hover:bg-muted/50')}
                                    >
                                        <Checkbox id={id} checked={marcada} onCheckedChange={(v) => alternarLinea(l.id, v === true)} aria-invalid={form.errors.lineas ? true : undefined} />
                                        <Icono className="text-primary size-4" aria-hidden="true" />
                                        <label htmlFor={id} className="flex-1 cursor-pointer text-sm">
                                            {l.nombre}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <InputError id="lineas-error" message={form.errors.lineas} />
                </fieldset>

                {/* Periodo: desde cuándo y por cuánto tiempo */}
                <fieldset className="grid gap-4 rounded-xl border p-4">
                    <legend className="px-1 text-sm font-semibold">Periodo</legend>
                    <Campo id="fecha_inicio" etiqueta="Desde" requerido error={form.errors.fecha_inicio}>
                        <Input
                            {...propsCampo('fecha_inicio', form.errors.fecha_inicio)}
                            type="date"
                            required
                            value={form.data.fecha_inicio}
                            onChange={(e) => form.setData('fecha_inicio', e.target.value)}
                            className="h-10 w-48 rounded-lg"
                        />
                    </Campo>

                    <div className="grid gap-2" role="radiogroup" aria-labelledby="duracion-etiqueta" aria-describedby={form.errors.duracion ? 'duracion-error' : undefined}>
                        <span id="duracion-etiqueta" className="text-sm leading-none font-medium">
                            Por cuánto tiempo
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {opciones.duraciones.map((d, i) => {
                                const elegido = form.data.duracion === d.valor;
                                const id = i === 0 ? 'duracion' : `duracion-${d.valor}`;
                                return (
                                    <label
                                        key={d.valor}
                                        htmlFor={id}
                                        className={cn(
                                            'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                            elegido ? 'border-primary bg-secondary text-secondary-foreground font-semibold' : 'hover:bg-muted/60',
                                        )}
                                    >
                                        <input
                                            id={id}
                                            type="radio"
                                            name="duracion"
                                            value={d.valor}
                                            checked={elegido}
                                            onChange={() => form.setData((f) => ({ ...f, duracion: d.valor, duracion_cantidad: f.duracion_cantidad || '1' }))}
                                            className="sr-only"
                                        />
                                        {d.texto}
                                    </label>
                                );
                            })}
                        </div>
                        <InputError id="duracion-error" message={form.errors.duracion} />
                    </div>

                    {['dias', 'semanas', 'meses'].includes(form.data.duracion) && (
                        <Campo id="duracion_cantidad" etiqueta={`¿Cuántos ${form.data.duracion === 'dias' ? 'días' : form.data.duracion}?`} requerido error={form.errors.duracion_cantidad}>
                            <Input
                                {...propsCampo('duracion_cantidad', form.errors.duracion_cantidad)}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={999}
                                required
                                value={form.data.duracion_cantidad}
                                onChange={(e) => form.setData('duracion_cantidad', e.target.value)}
                                className="h-10 w-28 rounded-lg tabular-nums"
                            />
                        </Campo>
                    )}
                    {form.data.duracion === 'fechas' && (
                        <Campo id="fecha_fin" etiqueta="Hasta" requerido error={form.errors.fecha_fin}>
                            <Input
                                {...propsCampo('fecha_fin', form.errors.fecha_fin)}
                                type="date"
                                required
                                min={form.data.fecha_inicio || undefined}
                                value={form.data.fecha_fin}
                                onChange={(e) => form.setData('fecha_fin', e.target.value)}
                                className="h-10 w-48 rounded-lg"
                            />
                        </Campo>
                    )}

                    <p role="status" className="bg-muted/60 flex items-start gap-2 rounded-lg px-3 py-2 text-sm empty:hidden">
                        {resumenPeriodo && (
                            <>
                                <CalendarClock className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{resumenPeriodo}</span>
                            </>
                        )}
                    </p>
                </fieldset>
            </FormularioLateral>
        </AppLayout>
    );
}

/** Una persona con sus asignaciones: dónde presta el servicio, qué hace allí y hasta cuándo. */
function TarjetaPersona({
    persona: p,
    onAsignar,
    onEditar,
    onTerminar,
}: {
    persona: Persona;
    onAsignar: (boton: HTMLElement | null) => void;
    onEditar: (a: Asignacion, boton: HTMLElement | null) => void;
    onTerminar: (a: Asignacion) => void;
}) {
    const titulo = `persona-${p.id}`;
    return (
        <li>
            <article aria-labelledby={titulo} className={cn('bg-card overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]', !p.activo && 'opacity-75')}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        {p.foto ? (
                            <img src={p.foto} alt="" loading="lazy" className="bg-muted size-11 shrink-0 rounded-xl object-cover object-[50%_20%]" />
                        ) : (
                            <Iniciales texto={p.nombre} className="size-11" />
                        )}
                        <div className="min-w-0">
                            <h2 id={titulo} className="truncate font-extrabold" title={p.nombre}>
                                {p.nombre}
                            </h2>
                            <p className="text-muted-foreground truncate text-xs">
                                {p.cargo}
                                {p.cargo !== p.rol && ` · ${p.rol}`}
                                {!p.activo && ' · Inactivo'}
                            </p>
                        </div>
                    </div>
                    {p.asignable && (
                        <Button variant="outline" size="sm" onClick={(e) => onAsignar(e.currentTarget)} className="h-9 rounded-lg font-semibold">
                            <Plus className="size-4" aria-hidden="true" />
                            Asignar<span className="sr-only"> a {p.nombre}</span>
                        </Button>
                    )}
                </header>

                {p.asignaciones.length === 0 ? (
                    <p className="text-muted-foreground flex items-center gap-2 px-5 py-4 text-sm">
                        <UsersRound className="size-4" aria-hidden="true" />
                        Hoy no tiene dónde prestar el servicio.
                    </p>
                ) : (
                    <ul role="list" className="divide-y">
                        {p.asignaciones.map((a) => (
                            <FilaAsignacion key={a.id} persona={p} asignacion={a} onEditar={onEditar} onTerminar={onTerminar} />
                        ))}
                    </ul>
                )}
            </article>
        </li>
    );
}

function FilaAsignacion({
    persona,
    asignacion: a,
    onEditar,
    onTerminar,
}: {
    persona: Persona;
    asignacion: Asignacion;
    onEditar: (a: Asignacion, boton: HTMLElement | null) => void;
    onTerminar: (a: Asignacion) => void;
}) {
    const puede = usePuede();
    const boton = useRef<HTMLButtonElement>(null);
    const estado = ESTADOS[a.estado];
    const lugar = a.empresa ?? 'Toda la línea';
    const detalleLugar = [a.sede, a.sucursal].filter(Boolean).join(' · ');
    const hoyIso = hoy();
    // Cuánto lleva y cuánto le queda (solo con fecha de fin)
    const total = a.fechaFin ? diasEntre(a.fechaInicio, a.fechaFin) + 1 : null;
    const pasados = a.estado === 'vigente' ? diasEntre(a.fechaInicio, hoyIso) + 1 : 0;
    const quedan = a.fechaFin && a.estado === 'vigente' ? diasEntre(hoyIso, a.fechaFin) + 1 : null;
    const empiezaEn = a.estado === 'programada' ? diasEntre(hoyIso, a.fechaInicio) : null;
    const puedeEditar = a.editable && a.estado !== 'terminada' && puede('asignaciones.editar');
    const puedeTerminar = a.editable && a.estado !== 'terminada' && puede('asignaciones.terminar');

    return (
        <li className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
                <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    {a.empresa ? <Building2 className="size-5" aria-hidden="true" /> : <Layers className="size-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                    <p className="truncate font-semibold" title={lugar}>
                        {lugar}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs" title={detalleLugar || undefined}>
                        {detalleLugar ? (
                            <>
                                <MapPinned className="size-3.5 shrink-0" aria-hidden="true" />
                                {detalleLugar}
                            </>
                        ) : a.empresa ? (
                            'Toda la empresa'
                        ) : (
                            'En todas las empresas de la línea'
                        )}
                    </p>
                </div>
            </div>

            <ul role="list" aria-label="Líneas de servicio" className="flex flex-wrap gap-1.5">
                {a.lineas.map((l) => {
                    const Icono = SERVICIOS.find((s) => s.id === l.slug)?.icono ?? Layers;
                    return (
                        <li key={l.id} className="bg-muted/70 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                            <Icono className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate" title={l.nombre}>
                                {l.nombre}
                            </span>
                        </li>
                    );
                })}
            </ul>

            <div className="min-w-0 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap', estado.clase)}>
                        <span className={cn('size-1.5 rounded-full', estado.punto)} aria-hidden="true" />
                        {estado.texto}
                    </span>
                    <span className="text-muted-foreground">{a.duracion === 'fechas' ? 'Entre fechas' : a.duracionTexto}</span>
                </div>
                <p className="mt-1.5 tabular-nums">
                    {a.fechaFin ? `${fmt.fechaMedia(a.fechaInicio)} – ${fmt.fechaMedia(a.fechaFin)}` : `Desde el ${fmt.fechaMedia(a.fechaInicio)}`}
                </p>
                {total !== null && a.estado === 'vigente' && (
                    <div className="mt-1.5 flex items-center gap-2">
                        <span className="bg-muted h-1.5 w-24 overflow-hidden rounded-full" aria-hidden="true">
                            <span className="bg-primary block h-full rounded-full" style={{ width: `${Math.min(100, Math.round((pasados / total) * 100))}%` }} />
                        </span>
                        <span className={cn('font-medium', quedan !== null && quedan <= 7 && 'text-warning')}>
                            {quedan === 1 ? 'Termina hoy' : `Quedan ${plural(quedan ?? 0, 'día', 'días')}`}
                        </span>
                    </div>
                )}
                {empiezaEn !== null && <p className="text-muted-foreground mt-1">{empiezaEn === 1 ? 'Empieza mañana' : `Empieza en ${plural(empiezaEn, 'día', 'días')}`}</p>}
            </div>

            <div className="flex justify-end">
                {(puedeEditar || puedeTerminar) && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button ref={boton} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-9 rounded-lg">
                                <MoreHorizontal className="size-5" aria-hidden="true" />
                                <span className="sr-only">
                                    Acciones de la asignación de {persona.nombre} en {lugar}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                            {puedeEditar && (
                                <DropdownMenuItem onSelect={() => onEditar(a, boton.current)} className="gap-2">
                                    <Pencil className="size-4" aria-hidden="true" />
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {puedeTerminar && (
                                <DropdownMenuItem onSelect={() => onTerminar(a)} className="text-critical focus:text-critical gap-2">
                                    <Undo2 className="size-4" aria-hidden="true" />
                                    {a.estado === 'programada' ? 'Quitar' : 'Terminar'}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </li>
    );
}

/** Terminar (o quitar, si aún no empieza) pide confirmación: cambia dónde puede trabajar la persona. */
function ConfirmarTerminar({ objetivo, onCerrar }: { objetivo: { persona: Persona; asignacion: Asignacion } | null; onCerrar: () => void }) {
    const [procesando, setProcesando] = useState(false);
    const programada = objetivo?.asignacion.estado === 'programada' || (objetivo && objetivo.asignacion.fechaInicio >= hoy());
    const lugar = objetivo ? [objetivo.asignacion.empresa ?? 'Toda la línea', objetivo.asignacion.sede, objetivo.asignacion.sucursal].filter(Boolean).join(' · ') : '';

    const terminar = () => {
        if (!objetivo) return;
        router.patch(
            route('asignaciones.terminar', objetivo.asignacion.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcesando(true),
                onFinish: () => {
                    setProcesando(false);
                    onCerrar();
                },
            },
        );
    };

    return (
        <Dialog open={objetivo !== null} onOpenChange={(v) => !v && !procesando && onCerrar()}>
            <DialogContent role="alertdialog" sinBotonCerrar className="max-w-md rounded-2xl">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-lg font-extrabold">
                        {programada ? '¿Quitar' : '¿Terminar'} la asignación de {objetivo?.persona.nombre}?
                    </DialogTitle>
                    <DialogDescription>
                        {programada
                            ? `Su asignación en ${lugar} aún no había empezado: se quita.`
                            : `Su asignación en ${lugar} queda terminada hasta ayer: ya no aparecerá en su carnet ni le dará acceso a esa operación. Su historial se conserva.`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onCerrar} className="rounded-lg">
                        Cancelar
                    </Button>
                    <Button onClick={terminar} aria-disabled={procesando || undefined} className="rounded-lg bg-[#c2352f] text-white hover:bg-[#a92c27] aria-disabled:opacity-70">
                        {procesando ? 'Un momento…' : programada ? 'Quitar' : 'Terminar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
