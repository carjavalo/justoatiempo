import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import {
    claseTd,
    claseTh,
    contenedorModulo,
    ConteoEnlace,
    EncabezadoModulo,
    EstadoBadge,
    EstadoVacio,
    Paginacion,
    SinResultados,
    Tabla,
} from '@/components/admin/piezas';
import { MapPin, MapPinned, Plus } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

/** Nombre de la sede con su empresa ("TuGo · Ditranza"): dos empresas pueden atender a clientes parecidos. */
const nombreSede = (s: Sede) => [s.nombre, s.empresa].filter(Boolean).join(' · ') + (s.activo ? '' : ' (inactiva)');

export default function Sucursales({ sucursales, total, filtros, sedes }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('sucursales.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaSucursal | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (sucursal: FilaSucursal | null, boton: HTMLElement | null = null) => {
        setEditando(sucursal);
        setOrigen(boton);
        form.clearErrors();
        form.setData(
            sucursal
                ? {
                      nombre: sucursal.nombre,
                      sede_id: sucursal.sedeId ? String(sucursal.sedeId) : '',
                      alias_drivin: sucursal.aliasDrivin ?? '',
                      ciudad: sucursal.ciudad,
                      direccion: sucursal.direccion ?? '',
                  }
                : // Si la lista está filtrada por una sede, la sucursal nueva nace en esa sede
                  { ...VACIO, sede_id: /^\d+$/.test(valores.sede) ? valores.sede : '' },
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('sucursales.update', editando.id), opciones);
        else form.post(route('sucursales.store'), opciones);
    };

    // En el formulario: sedes activas, más la actual si quedó inactiva (para no perderla al editar)
    const sedesFormulario = sedes.filter((s) => s.activo || String(s.id) === form.data.sede_id);

    const botonNueva = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    return (
        <AppLayout>
            <Head title="Sucursales" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Sucursales"
                    descripcion="Los lugares donde se presta el servicio: las sucursales de cada sede (Cali Sur, Cañasgordas…) y las propias de Justo a Tiempo."
                    accion={total > 0 && botonNueva('Nueva sucursal')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={MapPinned}
                        titulo="Aún no hay sucursales registradas"
                        texto="Registra la primera sucursal; después podrás asignarle personal en Usuarios."
                        accion={botonNueva('Registrar la primera sucursal')}
                    />
                ) : (
                    <>
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

                        {sucursales.data.length === 0 ? (
                            <SinResultados texto="Ninguna sucursal coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Sucursales" columnas={['37%', '27%', '15%', '12%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Sucursal
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Sede y empresa
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
                                    {sucursales.data.map((s) => (
                                        <tr key={s.id} className={cn('hover:bg-muted/40 transition-colors', !s.activo && 'text-muted-foreground')}>
                                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl"
                                                        aria-hidden="true"
                                                    >
                                                        <MapPin className="size-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-foreground truncate font-semibold" title={s.nombre}>
                                                            {s.nombre}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs">
                                                            {[s.ciudad, s.direccion, s.aliasDrivin && `Plan Drivin: ${s.aliasDrivin}`]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                {s.sede ? (
                                                    <>
                                                        <p className="text-foreground truncate" title={s.sede}>
                                                            {s.sede}
                                                        </p>
                                                        {s.empresa && (
                                                            <p className="text-muted-foreground truncate text-xs" title={s.empresa}>
                                                                {s.empresa}
                                                            </p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="bg-brand-coral-soft text-brand-coral-ink rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                                        Propia
                                                    </span>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace
                                                    n={s.usuarios}
                                                    uno="usuario"
                                                    varios="usuarios"
                                                    ninguno="Ninguno"
                                                    de={`la sucursal ${s.nombre}`}
                                                    href={route('usuarios.index', { sucursal: s.id })}
                                                />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={s.activo} femenino />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={`la sucursal ${s.nombre}`}
                                                    activo={s.activo}
                                                    urlEstado={route('sucursales.estado', s.id)}
                                                    onEditar={(boton) => abrir(s, boton)}
                                                    consecuencia={`No se le podrán asignar nuevos usuarios; ${s.usuarios === 1 ? 'el usuario que tiene se conserva' : s.usuarios > 1 ? `los ${s.usuarios} usuarios que tiene se conservan` : 'no tiene usuarios asignados'}. Puedes volver a activarla cuando quieras.`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Tabla>
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

                <Campo id="sede_id" etiqueta="Sede" error={form.errors.sede_id}>
                    <Selector
                        {...propsCampo('sede_id', form.errors.sede_id)}
                        valor={form.data.sede_id}
                        // Una sucursal propia no recibe órdenes de Drivin: sin sede, sin nombre de plan
                        onCambio={(v) => form.setData((d) => ({ ...d, sede_id: v, alias_drivin: v ? d.alias_drivin : '' }))}
                        opciones={[
                            { valor: '', texto: 'Ninguna · sucursal propia de Justo a Tiempo' },
                            ...sedesFormulario.map((s) => ({ valor: String(s.id), texto: nombreSede(s) })),
                        ]}
                    />
                </Campo>

                {form.data.sede_id && (
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
