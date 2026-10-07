import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, ConteoEnlace, contenedorModulo, EncabezadoModulo, EstadoBadge, EstadoVacio, Paginacion, SinResultados, Tabla } from '@/components/admin/piezas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { MapPin, MapPinned, Plus } from '@/components/iconos';
import { useState } from 'react';
import { Selector } from '@/components/selector';

interface FilaSede {
    id: number;
    nombre: string;
    ciudad: string;
    direccion: string | null;
    empresaId: number | null;
    empresa: string | null;
    activo: boolean;
    usuarios: number;
}

interface Empresa {
    id: number;
    nombre: string;
    activo: boolean;
}

interface Props {
    sedes: Paginado<FilaSede>;
    total: number;
    filtros: { q: string; empresa: string; estado: string };
    empresas: Empresa[];
}

const VACIO = { nombre: '', empresa_id: '', ciudad: '', direccion: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);

/** Sugerencias para el campo Ciudad; se puede escribir cualquier otra. */
const CIUDADES = [
    'Cali', 'Yumbo', 'Jamundí', 'Palmira', 'Candelaria', 'Buga', 'Tuluá', 'Cartago', 'Buenaventura', 'Bogotá', 'Medellín', 'Barranquilla',
    'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales', 'Armenia', 'Ibagué', 'Neiva', 'Pasto', 'Popayán', 'Cúcuta', 'Santa Marta', 'Villavicencio',
];

export default function Sedes({ sedes, total, filtros, empresas }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('sedes.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaSede | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (sede: FilaSede | null, boton: HTMLElement | null = null) => {
        setEditando(sede);
        setOrigen(boton);
        form.clearErrors();
        form.setData(
            sede
                ? { nombre: sede.nombre, empresa_id: sede.empresaId ? String(sede.empresaId) : '', ciudad: sede.ciudad, direccion: sede.direccion ?? '' }
                : // Si la lista está filtrada por una empresa, la sede nueva nace en esa empresa
                  { ...VACIO, empresa_id: /^\d+$/.test(valores.empresa) ? valores.empresa : '' },
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('sedes.update', editando.id), opciones);
        else form.post(route('sedes.store'), opciones);
    };

    // En el formulario: empresas activas, más la actual si quedó inactiva (para no perderla al editar)
    const empresasFormulario = empresas.filter((e) => e.activo || String(e.id) === form.data.empresa_id);

    const botonNueva = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    return (
        <AppLayout breadcrumbs={[{ title: 'Sedes', href: route('sedes.index') }]}>
            <Head title="Sedes" />

            <div className={contenedorModulo}>
                <EncabezadoModulo titulo="Sedes" descripcion="Los lugares donde se presta el servicio: sedes de las empresas clientes y sedes propias de Justo a Tiempo." accion={total > 0 && botonNueva('Nueva sede')} />

                {total === 0 ? (
                    <EstadoVacio
                        icono={MapPinned}
                        titulo="Aún no hay sedes registradas"
                        texto="Crea las sedes de cada empresa cliente (por ejemplo, «Planta Yumbo») o las sedes propias de Justo a Tiempo."
                        accion={botonNueva('Registrar la primera sede')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={sedes.total ? `${sedes.total} ${sedes.total === 1 ? 'sede' : 'sedes'}` : 'Ninguna sede coincide con los filtros.'}
                            soloAnunciar={sedes.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-sedes"
                        >
                            <CampoBusqueda id="buscar-sedes" etiqueta="Buscar sedes" placeholder="Buscar por nombre, ciudad o dirección" valor={valores.q} onCambio={(v) => cambiar('q', v, { inmediato: false })} />
                            <FiltroLista
                                id="filtro-empresa"
                                etiqueta="Empresa"
                                valor={valores.empresa}
                                onCambio={(v) => cambiar('empresa', v)}
                                className="sm:w-60"
                                opciones={[
                                    { valor: '', texto: 'Todas las empresas' },
                                    { valor: 'propias', texto: 'Sedes propias' },
                                    ...empresas.map((e) => ({ valor: String(e.id), texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` })),
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

                        {sedes.data.length === 0 ? (
                            <SinResultados texto="Ninguna sede coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Sedes">
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Sede
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Empresa
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
                                    {sedes.data.map((s) => (
                                        <tr key={s.id} className={cn('hover:bg-muted/40 transition-colors', !s.activo && 'text-muted-foreground')}>
                                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
                                                        <MapPin className="size-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-foreground truncate font-semibold">{s.nombre}</p>
                                                        <p className="text-muted-foreground truncate text-xs">{[s.ciudad, s.direccion].filter(Boolean).join(' · ')}</p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                {s.empresa ?? <span className="bg-brand-coral-soft text-brand-coral-ink rounded-full px-2.5 py-0.5 text-xs font-semibold">Propia</span>}
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace n={s.usuarios} uno="usuario" varios="usuarios" ninguno="Ninguno" de={`la sede ${s.nombre}`} href={route('usuarios.index', { sede: s.id })} />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={s.activo} femenino />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={`la sede ${s.nombre}`}
                                                    activo={s.activo}
                                                    urlEstado={route('sedes.estado', s.id)}
                                                    onEditar={(boton) => abrir(s, boton)}
                                                    consecuencia={`No se le podrán asignar nuevos usuarios; ${s.usuarios === 1 ? 'el usuario que tiene se conserva' : s.usuarios > 1 ? `los ${s.usuarios} usuarios que tiene se conservan` : 'no tiene usuarios asignados'}. Puedes volver a activarla cuando quieras.`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Tabla>
                        )}

                        <Paginacion pagina={sedes} nombre="sedes" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar sede' : 'Nueva sede'}
                descripcion={editando ? `Actualiza los datos de la sede ${editando.nombre}.` : 'Registra un lugar donde se presta el servicio.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear sede'}
                focoAlCerrar={origen}
            >
                <Campo id="nombre" etiqueta="Nombre de la sede" requerido error={form.errors.nombre}>
                    <Input {...propsCampo('nombre', form.errors.nombre)} required autoComplete="off" placeholder="Ej.: Planta Yumbo" value={form.data.nombre} onChange={(e) => form.setData('nombre', e.target.value)} className="h-10 rounded-lg" />
                </Campo>

                <Campo id="empresa_id" etiqueta="Empresa" error={form.errors.empresa_id}>
                    <Selector
                        {...propsCampo('empresa_id', form.errors.empresa_id)}
                        valor={form.data.empresa_id}
                        onCambio={(v) => form.setData('empresa_id', v)}
                        opciones={[
                            { valor: '', texto: 'Ninguna · sede propia de Justo a Tiempo' },
                            ...empresasFormulario.map((e) => ({ valor: String(e.id), texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` })),
                        ]}
                    />
                </Campo>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <Campo id="ciudad" etiqueta="Ciudad" requerido error={form.errors.ciudad}>
                        <Input {...propsCampo('ciudad', form.errors.ciudad)} required list="ciudades" autoComplete="off" placeholder="Ej.: Cali" value={form.data.ciudad} onChange={(e) => form.setData('ciudad', e.target.value)} className="h-10 rounded-lg" />
                        <datalist id="ciudades">
                            {CIUDADES.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </Campo>
                    <Campo id="direccion" etiqueta="Dirección" error={form.errors.direccion}>
                        <Input {...propsCampo('direccion', form.errors.direccion)} autoComplete="off" placeholder="Ej.: Calle 15 # 32-40" value={form.data.direccion} onChange={(e) => form.setData('direccion', e.target.value)} className="h-10 rounded-lg" />
                    </Campo>
                </div>
            </FormularioLateral>
        </AppLayout>
    );
}
