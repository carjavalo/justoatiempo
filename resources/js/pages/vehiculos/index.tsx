import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import {
    claseTd,
    claseTh,
    contenedorModulo,
    EncabezadoModulo,
    EstadoBadge,
    EstadoVacio,
    Paginacion,
    SinResultados,
    Tabla,
} from '@/components/admin/piezas';
import { Plus, Truck } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaVehiculo {
    id: number;
    placa: string;
    codigoInterno: string | null;
    tipo: string | null;
    descripcion: string | null;
    conductorId: number | null;
    conductor: string | null;
    activo: boolean;
    /** Órdenes de los últimos 30 días. */
    ordenesMes: number;
    ultimaJornada: string | null;
}

interface Props {
    vehiculos: Paginado<FilaVehiculo>;
    total: number;
    filtros: { q: string; estado: string };
    personas: { id: number; nombre: string; detalle: string }[];
    tipos: string[];
}

const VACIO = { placa: '', codigo_interno: '', tipo: '', descripcion: '', conductor_id: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);

/**
 * Flota de la operación logística: cada vehículo por su placa (como la trae Drivin), su código interno y su
 * conductor habitual. Los que llegan nuevos en una preliquidación se agregan solos.
 */
export default function Vehiculos({ vehiculos, total, filtros, personas, tipos }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar, activos } = useFiltros(route('vehiculos.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaVehiculo | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (vehiculo: FilaVehiculo | null, boton: HTMLElement | null = null) => {
        setEditando(vehiculo);
        setOrigen(boton);
        form.clearErrors();
        form.setData(
            vehiculo
                ? {
                      placa: vehiculo.placa,
                      codigo_interno: vehiculo.codigoInterno ?? '',
                      tipo: vehiculo.tipo ?? '',
                      descripcion: vehiculo.descripcion ?? '',
                      conductor_id: vehiculo.conductorId ? String(vehiculo.conductorId) : '',
                  }
                : VACIO,
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('vehiculos.update', editando.id), opciones);
        else form.post(route('vehiculos.store'), opciones);
    };

    // El conductor actual se conserva aunque ya no esté activo (para no perderlo al editar otro dato)
    const opcionesConductor = [
        { valor: '', texto: 'Sin conductor habitual' },
        ...personas.map((p) => ({ valor: String(p.id), texto: p.nombre, detalle: p.detalle || undefined })),
        ...(editando?.conductorId && !personas.some((p) => p.id === editando.conductorId)
            ? [{ valor: String(editando.conductorId), texto: editando.conductor ?? 'Persona inactiva', detalle: 'Inactiva' }]
            : []),
    ];
    const tiposSugeridos = tipos.filter((t) => t.toLowerCase() !== form.data.tipo.trim().toLowerCase()).slice(0, 6);

    const botonNuevo = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    return (
        <AppLayout>
            <Head title="Flota" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Flota"
                    descripcion="Los vehículos de la operación urbana por su placa, como los trae Drivin. Los nuevos de una preliquidación se agregan solos."
                    accion={total > 0 && puede('vehiculos.crear') && botonNuevo('Nuevo vehículo')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={Truck}
                        titulo="Aún no hay vehículos"
                        texto="Se agregan solos al confirmar la primera preliquidación de Drivin, o puedes registrarlos aquí con su código interno."
                        accion={puede('vehiculos.crear') && botonNuevo('Registrar el primer vehículo')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={
                                vehiculos.total
                                    ? `${vehiculos.total} ${vehiculos.total === 1 ? 'vehículo' : 'vehículos'}`
                                    : 'Ningún vehículo coincide con los filtros.'
                            }
                            soloAnunciar={vehiculos.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-vehiculos"
                        >
                            <CampoBusqueda
                                id="buscar-vehiculos"
                                etiqueta="Buscar vehículos"
                                placeholder="Buscar por placa, código interno o tipo"
                                valor={valores.q}
                                onCambio={(v) => cambiar('q', v, { inmediato: false })}
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

                        {vehiculos.data.length === 0 ? (
                            <SinResultados texto="Ningún vehículo coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Flota" columnas={['30%', '26%', '20%', '12%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Vehículo
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Conductor habitual
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Últimos 30 días
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
                                    {vehiculos.data.map((v) => {
                                        const detalle = [v.codigoInterno && `Código ${v.codigoInterno}`, v.tipo, v.descripcion]
                                            .filter(Boolean)
                                            .join(' · ');
                                        return (
                                            <tr
                                                key={v.id}
                                                className={cn('hover:bg-muted/40 transition-colors', !v.activo && 'text-muted-foreground')}
                                            >
                                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl"
                                                            aria-hidden="true"
                                                        >
                                                            <Truck className="size-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-foreground font-mono font-semibold tracking-wide">{v.placa}</p>
                                                            <p className="text-muted-foreground truncate text-xs" title={detalle || undefined}>
                                                                {detalle || 'Sin código interno'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </th>
                                                <td className={claseTd}>
                                                    {v.conductor ? (
                                                        <p className="truncate" title={v.conductor}>
                                                            {v.conductor}
                                                        </p>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Sin asignar</span>
                                                    )}
                                                </td>
                                                <td className={claseTd}>
                                                    {v.ordenesMes > 0 ? (
                                                        <>
                                                            <p className="font-semibold tabular-nums">
                                                                {fmt.numero(v.ordenesMes)} {v.ordenesMes === 1 ? 'orden' : 'órdenes'}
                                                            </p>
                                                            {v.ultimaJornada && (
                                                                <p className="text-muted-foreground text-xs">
                                                                    Última jornada: {fmt.fechaMedia(v.ultimaJornada)}
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">
                                                            {v.ultimaJornada
                                                                ? `Sin órdenes · última: ${fmt.fechaMedia(v.ultimaJornada)}`
                                                                : 'Sin órdenes aún'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={claseTd}>
                                                    <EstadoBadge activo={v.activo} />
                                                </td>
                                                <td className={cn(claseTd, 'text-right')}>
                                                    <AccionesFila
                                                        nombre={`el vehículo ${v.placa}`}
                                                        activo={v.activo}
                                                        urlEstado={puede('vehiculos.estado') ? route('vehiculos.estado', v.id) : undefined}
                                                        onEditar={puede('vehiculos.editar') ? (boton) => abrir(v, boton) : undefined}
                                                        consecuencia="Su historial de órdenes se conserva. Si vuelve a llegar en una preliquidación, sus órdenes se cargan igual. Puedes activarlo de nuevo cuando quieras."
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Tabla>
                        )}

                        <Paginacion pagina={vehiculos} nombre="vehículos" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? `Editar ${editando.placa}` : 'Nuevo vehículo'}
                descripcion={
                    editando
                        ? 'Si corriges la placa, las próximas cargas de Drivin lo reconocen con la nueva.'
                        : 'Regístralo con la placa con la que aparece en Drivin.'
                }
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Agregar vehículo'}
                focoAlCerrar={origen}
            >
                <Campo
                    id="placa"
                    etiqueta="Placa"
                    requerido
                    ayuda="Como en Drivin, sin espacios ni guiones (p. ej. SNX708)."
                    error={form.errors.placa}
                >
                    <Input
                        {...propsCampo('placa', form.errors.placa, 'placa-ayuda')}
                        required
                        maxLength={10}
                        autoComplete="off"
                        value={form.data.placa}
                        onChange={(e) => form.setData('placa', e.target.value.toUpperCase())}
                        className="h-10 w-48 rounded-lg font-mono tracking-wide uppercase"
                    />
                </Campo>

                <Campo
                    id="codigo_interno"
                    etiqueta="Código interno"
                    ayuda="Opcional: el número con el que lo conoce la operación."
                    error={form.errors.codigo_interno}
                >
                    <Input
                        {...propsCampo('codigo_interno', form.errors.codigo_interno, 'codigo_interno-ayuda')}
                        maxLength={30}
                        autoComplete="off"
                        value={form.data.codigo_interno}
                        onChange={(e) => form.setData('codigo_interno', e.target.value)}
                        className="h-10 w-48 rounded-lg"
                    />
                </Campo>

                <Campo
                    id="tipo"
                    etiqueta="Tipo"
                    ayuda={
                        tiposSugeridos.length > 0
                            ? 'Opcional. Elige uno de los que ya usa la flota o escribe otro.'
                            : 'Opcional (p. ej. Camión, Furgón, NHR).'
                    }
                    error={form.errors.tipo}
                >
                    <Input
                        {...propsCampo('tipo', form.errors.tipo, 'tipo-ayuda')}
                        maxLength={50}
                        autoComplete="off"
                        value={form.data.tipo}
                        onChange={(e) => form.setData('tipo', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                    {tiposSugeridos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipos que ya usa la flota">
                            {tiposSugeridos.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => form.setData('tipo', t)}
                                    className="bg-muted/60 hover:bg-secondary focus-visible:border-ring focus-visible:ring-ring/25 rounded-full border px-2.5 py-1 text-xs font-medium transition-[color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-hidden"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}
                </Campo>

                <Campo id="descripcion" etiqueta="Descripción" ayuda="Opcional: marca, modelo o capacidad." error={form.errors.descripcion}>
                    <Input
                        {...propsCampo('descripcion', form.errors.descripcion, 'descripcion-ayuda')}
                        maxLength={255}
                        autoComplete="off"
                        value={form.data.descripcion}
                        onChange={(e) => form.setData('descripcion', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <Campo
                    id="conductor_id"
                    etiqueta="Conductor habitual"
                    ayuda="Opcional. Cualquier persona activa del personal; primero quienes tienen «conductor» en su cargo."
                    error={form.errors.conductor_id}
                >
                    <Selector
                        {...propsCampo('conductor_id', form.errors.conductor_id, 'conductor_id-ayuda')}
                        valor={form.data.conductor_id}
                        onCambio={(v) => form.setData('conductor_id', v)}
                        opciones={opcionesConductor}
                    />
                </Campo>
            </FormularioLateral>
        </AppLayout>
    );
}
