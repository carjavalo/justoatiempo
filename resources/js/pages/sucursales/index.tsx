import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, POCOS_PARA_FILTRAR, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import {
    agrupar,
    claseTd,
    claseTh,
    contenedorModulo,
    ConteoEnlace,
    DatosBloque,
    EncabezadoGrupo,
    EncabezadoModulo,
    EstadoBadge,
    EstadoVacio,
    Paginacion,
    SinResultados,
    Tabla,
} from '@/components/admin/piezas';
import { MapPinned, Plus } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBorrador } from '@/hooks/use-borrador';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaSucursal {
    id: number;
    nombre: string;
    ciudad: string;
    direccion: string | null;
    aliasDrivin: string | null;
    sedeId: number | null;
    sede: string | null;
    empresa: string | null;
    activo: boolean;
    /** Quienes trabajan en ella: asignados a la sucursal, a toda su sede o a toda su empresa. */
    usuarios: number;
}

interface Sede {
    id: number;
    nombre: string;
    activo: boolean;
    empresa: string | null;
}

interface Props {
    sucursales: Paginado<FilaSucursal>;
    total: number;
    filtros: { q: string; sede: string; estado: string };
    sedes: Sede[];
}

/** Sucursal propia de Justo a Tiempo (sin sede): se elige, no queda así por olvido (el servidor pide una de las dos). */
const PROPIA = 'propia';
const VACIO = { nombre: '', sede_id: '', alias_drivin: '', ciudad: '', direccion: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);

/** Sugerencias para el campo Ciudad; se puede escribir cualquier otra. */
const CIUDADES = [
    'Cali',
    'Yumbo',
    'Jamundí',
    'Palmira',
    'Candelaria',
    'Buga',
    'Tuluá',
    'Cartago',
    'Buenaventura',
    'Bogotá',
    'Medellín',
    'Barranquilla',
    'Cartagena',
    'Bucaramanga',
    'Pereira',
    'Manizales',
    'Armenia',
    'Ibagué',
    'Neiva',
    'Pasto',
    'Popayán',
    'Cúcuta',
    'Santa Marta',
    'Villavicencio',
];

/** Nombre de la sede con su empresa ("TuGo · Ditransa"): dos empresas pueden atender a clientes parecidos. */
const nombreSede = (s: Sede) => [s.nombre, s.empresa].filter(Boolean).join(' · ') + (s.activo ? '' : ' (inactiva)');
/** Mismo texto sin importar mayúsculas: el nombre del plan no dice nada nuevo (CALI NORTE de Cali Norte). */
const mismoTexto = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'accent' }) === 0;

export default function Sucursales({ sucursales, total, filtros, sedes }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar, activos } = useFiltros(route('sucursales.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaSucursal | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);
    const borrador = useBorrador('sucursales', form);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (sucursal: FilaSucursal | null, boton: HTMLElement | null = null) => {
        setEditando(sucursal);
        setOrigen(boton);
        form.clearErrors();
        borrador.abrir(
            sucursal?.id ?? null,
            sucursal
                ? {
                      nombre: sucursal.nombre,
                      sede_id: sucursal.sedeId ? String(sucursal.sedeId) : PROPIA,
                      alias_drivin: sucursal.aliasDrivin ?? '',
                      ciudad: sucursal.ciudad,
                      direccion: sucursal.direccion ?? '',
                  }
                : // Si la lista está filtrada por una sede (o por las propias), la sucursal nueva nace ahí; si no, se elige
                  { ...VACIO, sede_id: /^\d+$/.test(valores.sede) ? valores.sede : valores.sede === 'propias' ? PROPIA : '' },
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => {
                borrador.limpiar();
                setAbierto(false);
            } };
        if (editando) form.put(route('sucursales.update', editando.id), opciones);
        else form.post(route('sucursales.store'), opciones);
    };

    // En el formulario: sedes activas, más la actual si quedó inactiva (para no perderla al editar)
    const sedesFormulario = sedes.filter((s) => s.activo || String(s.id) === form.data.sede_id);
    const deUnaSede = form.data.sede_id !== '' && form.data.sede_id !== PROPIA;

    const botonNueva = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    // Lo de cada sucursal: lo mismo en la tabla (desde 1024 px) y en los bloques (debajo). La sede encabeza su grupo
    // (no se repite en cada fila) y el estado solo se marca si está inactiva
    const sucursalDe = (s: FilaSucursal) => (
        <div className="min-w-0">
            <p className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <span className="break-words">{s.nombre}</span>
                {!s.activo && <EstadoBadge activo={false} femenino />}
            </p>
            {s.aliasDrivin && !mismoTexto(s.aliasDrivin, s.nombre) && (
                <p className="text-muted-foreground mt-0.5 text-xs break-words">Plan en Drivin: {s.aliasDrivin}</p>
            )}
        </div>
    );
    const ciudadDe = (s: FilaSucursal) => (
        <>
            <p>{s.ciudad}</p>
            {s.direccion && <p className="text-muted-foreground text-xs break-words">{s.direccion}</p>}
        </>
    );
    const usuariosDe = (s: FilaSucursal) => (
        <ConteoEnlace
            n={s.usuarios}
            uno="usuario"
            varios="usuarios"
            ninguno="Ninguno"
            de={`la sucursal ${s.nombre}`}
            href={puede('usuarios.ver') ? route('usuarios.index', { sucursal: s.id }) : undefined}
        />
    );
    const accionesDe = (s: FilaSucursal) => (
        <AccionesFila
            nombre={`la sucursal ${s.nombre}`}
            activo={s.activo}
            urlEstado={puede('sucursales.estado') ? route('sucursales.estado', s.id) : undefined}
            onEditar={puede('sucursales.editar') ? (boton) => abrir(s, boton) : undefined}
            urlEliminar={puede('sucursales.eliminar') ? route('sucursales.destroy', s.id) : undefined}
            consecuenciaEliminar="Quienes estaban asignados a ella quedan sin esa asignación (sigue en su historial) y se quita su programación de los días por venir. Sus órdenes e informes se conservan."
            consecuencia="No se le podrán asignar nuevas personas; quien trabaja ahí conserva su asignación. Puedes volver a activarla cuando quieras."
        />
    );
    const grupos = agrupar(sucursales.data, (s) => (s.sedeId ? String(s.sedeId) : 'propias'));
    const tituloGrupo = (s: FilaSucursal) =>
        !s.sedeId ? 'Propias de Justo a Tiempo' : s.sede ? [s.sede, s.empresa].filter(Boolean).join(' · ') : 'Sede eliminada';
    // Los filtros aparecen cuando hay muchas sucursales (o si ya hay uno puesto, para poder quitarlo)
    const conFiltros = total > POCOS_PARA_FILTRAR || activos;

    return (
        <AppLayout>
            <Head title="Sucursales" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Sucursales"
                    descripcion="Los lugares donde se presta el servicio: las sucursales de cada sede (Cali Sur, Cañasgordas…) y las propias de Justo a Tiempo."
                    accion={total > 0 && puede('sucursales.crear') && botonNueva('Nueva sucursal')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={MapPinned}
                        titulo="Aún no hay sucursales registradas"
                        texto="Registra la primera sucursal; después podrás asignarle personal en Usuarios."
                        accion={puede('sucursales.crear') && botonNueva('Registrar la primera sucursal')}
                    />
                ) : (
                    <>
                        {conFiltros && (
                            <BarraFiltros
                                resumen={
                                    sucursales.total
                                        ? `${sucursales.total} ${sucursales.total === 1 ? 'sucursal' : 'sucursales'}`
                                        : 'Ninguna sucursal coincide con los filtros.'
                                }
                                soloAnunciar={sucursales.total === 0}
                                activos={activos}
                                onLimpiar={limpiar}
                                idBusqueda="buscar-sucursales"
                            >
                                <CampoBusqueda
                                    id="buscar-sucursales"
                                    etiqueta="Buscar sucursales"
                                    placeholder="Buscar por nombre, ciudad o dirección"
                                    valor={valores.q}
                                    onCambio={(v) => cambiar('q', v, { inmediato: false })}
                                />
                                <FiltroLista
                                    id="filtro-sede"
                                    etiqueta="Sede"
                                    valor={valores.sede}
                                    onCambio={(v) => cambiar('sede', v)}
                                    className="sm:w-64"
                                    opciones={[
                                        { valor: '', texto: 'Todas las sedes' },
                                        { valor: 'propias', texto: 'Sucursales propias' },
                                        ...sedes.map((s) => ({ valor: String(s.id), texto: nombreSede(s) })),
                                    ]}
                                />
                                <FiltroLista
                                    id="filtro-estado"
                                    etiqueta="Estado"
                                    valor={valores.estado}
                                    onCambio={(v) => cambiar('estado', v)}
                                    opciones={[
                                        { valor: '', texto: 'Activas e inactivas' },
                                        { valor: 'activas', texto: 'Solo activas' },
                                        { valor: 'inactivas', texto: 'Solo inactivas' },
                                    ]}
                                />
                            </BarraFiltros>
                        )}

                        {sucursales.data.length === 0 ? (
                            <SinResultados texto="Ninguna sucursal coincide con los filtros." />
                        ) : (
                            <>
                                {/* Desde 1024 px, la tabla con un grupo por sede; debajo, los mismos grupos en bloques */}
                                <div className="hidden lg:block">
                                    <Tabla titulo="Sucursales por sede" minimo="min-w-[680px]" columnas={['44%', '30%', '18%', '3.5rem']}>
                                        <thead className="text-muted-foreground border-b">
                                            <tr>
                                                <th scope="col" className={claseTh}>
                                                    Sucursal
                                                </th>
                                                <th scope="col" className={claseTh}>
                                                    Ciudad
                                                </th>
                                                <th scope="col" className={claseTh}>
                                                    Usuarios
                                                </th>
                                                <th scope="col" className={cn(claseTh, 'w-14')}>
                                                    <span className="sr-only">Acciones</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        {grupos.map((g, i) => (
                                            <tbody key={g.clave} className={cn('divide-y', i > 0 && 'border-t')}>
                                                <EncabezadoGrupo columnas={4}>{tituloGrupo(g.filas[0])}</EncabezadoGrupo>
                                                {g.filas.map((s) => (
                                                    <tr
                                                        key={s.id}
                                                        className={cn('hover:bg-muted/40 transition-colors', !s.activo && 'text-muted-foreground')}
                                                    >
                                                        <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                            {sucursalDe(s)}
                                                        </th>
                                                        <td className={claseTd}>{ciudadDe(s)}</td>
                                                        <td className={claseTd}>{usuariosDe(s)}</td>
                                                        <td className={cn(claseTd, 'text-right')}>{accionesDe(s)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        ))}
                                    </Tabla>
                                </div>
                                <div className="bg-card overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:hidden">
                                    {grupos.map((g, i) => (
                                        <section key={g.clave} aria-labelledby={`sede-${g.clave}`} className={cn(i > 0 && 'border-t')}>
                                            <h2 id={`sede-${g.clave}`} className="bg-muted/50 border-b px-4 py-2.5 text-sm font-semibold sm:px-5">
                                                {tituloGrupo(g.filas[0])}
                                            </h2>
                                            <ul role="list" className="divide-y">
                                                {g.filas.map((s) => (
                                                    <li
                                                        key={s.id}
                                                        className={cn('grid gap-3 px-4 py-4 sm:px-5', !s.activo && 'text-muted-foreground')}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">{sucursalDe(s)}</div>
                                                            <div className="-mt-1 -mr-1">{accionesDe(s)}</div>
                                                        </div>
                                                        <DatosBloque
                                                            datos={[
                                                                ['Ciudad', ciudadDe(s)],
                                                                ['Usuarios', usuariosDe(s)],
                                                            ]}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </>
                        )}

                        <Paginacion pagina={sucursales} nombre="sucursales" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar sucursal' : 'Nueva sucursal'}
                descripcion={editando ? `Actualiza los datos de la sucursal ${editando.nombre}.` : 'Registra un lugar donde se presta el servicio.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear sucursal'}
                recuperado={borrador.recuperado}
                onDescartar={borrador.descartar}
                focoAlCerrar={origen}
            >
                <Campo id="nombre" etiqueta="Nombre de la sucursal" requerido error={form.errors.nombre}>
                    <Input
                        {...propsCampo('nombre', form.errors.nombre)}
                        required
                        autoComplete="off"
                        placeholder="Ej.: Cali Sur"
                        value={form.data.nombre}
                        onChange={(e) => form.setData('nombre', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <Campo id="sede_id" etiqueta="Sede" requerido error={form.errors.sede_id}>
                    <Selector
                        {...propsCampo('sede_id', form.errors.sede_id)}
                        valor={form.data.sede_id}
                        // Una sucursal propia no recibe órdenes de Drivin: sin sede, sin nombre de plan
                        onCambio={(v) => {
                            form.setData((d) => ({ ...d, sede_id: v, alias_drivin: v !== PROPIA ? d.alias_drivin : '' }));
                            if (form.errors.sede_id) form.clearErrors('sede_id');
                        }}
                        placeholder="Elige la sede de esta sucursal"
                        opciones={[
                            ...sedesFormulario.map((s) => ({ valor: String(s.id), texto: nombreSede(s) })),
                            { valor: PROPIA, texto: 'Propia de Justo a Tiempo (sin sede)' },
                        ]}
                    />
                </Campo>

                {deUnaSede && (
                    <Campo
                        id="alias_drivin"
                        etiqueta="Nombre del plan en Drivin"
                        ayuda="Como empieza el nombre del plan en la preliquidación (p. ej. CALI SUR CROSS): así sus órdenes se asignan solas a esta sucursal."
                        error={form.errors.alias_drivin}
                    >
                        <Input
                            {...propsCampo('alias_drivin', form.errors.alias_drivin, 'alias_drivin-ayuda')}
                            autoComplete="off"
                            placeholder="Ej.: CALI SUR CROSS"
                            value={form.data.alias_drivin}
                            onChange={(e) => form.setData('alias_drivin', e.target.value)}
                            className="h-10 rounded-lg uppercase"
                        />
                    </Campo>
                )}

                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <Campo id="ciudad" etiqueta="Ciudad" requerido error={form.errors.ciudad}>
                        <Input
                            {...propsCampo('ciudad', form.errors.ciudad)}
                            required
                            list="ciudades"
                            autoComplete="off"
                            placeholder="Ej.: Cali"
                            value={form.data.ciudad}
                            onChange={(e) => form.setData('ciudad', e.target.value)}
                            className="h-10 rounded-lg"
                        />
                        <datalist id="ciudades">
                            {CIUDADES.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </Campo>
                    <Campo id="direccion" etiqueta="Dirección" error={form.errors.direccion}>
                        <Input
                            {...propsCampo('direccion', form.errors.direccion)}
                            autoComplete="off"
                            placeholder="Ej.: Calle 15 # 32-40"
                            value={form.data.direccion}
                            onChange={(e) => form.setData('direccion', e.target.value)}
                            className="h-10 rounded-lg"
                        />
                    </Campo>
                </div>
            </FormularioLateral>
        </AppLayout>
    );
}
