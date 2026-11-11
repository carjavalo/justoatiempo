import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, POCOS_PARA_FILTRAR, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import {
    claseTd,
    claseTh,
    contenedorModulo,
    DatosBloque,
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
import { useBorrador } from '@/hooks/use-borrador';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ReactNode, useState } from 'react';

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
    const borrador = useBorrador('vehiculos', form);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (vehiculo: FilaVehiculo | null, boton: HTMLElement | null = null) => {
        setEditando(vehiculo);
        setOrigen(boton);
        form.clearErrors();
        borrador.abrir(
            vehiculo?.id ?? null,
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
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => {
                borrador.limpiar();
                setAbierto(false);
            } };
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

    // Lo de cada vehículo: lo mismo en la tabla (desde 1024 px) y en los bloques (debajo). Solo se marca lo que
    // distingue: el estado si está inactivo, y el código, el tipo o la descripción cuando los hay
    const vehiculoDe = (v: FilaVehiculo) => {
        const detalle = [v.codigoInterno && `Código ${v.codigoInterno}`, v.tipo, v.descripcion].filter(Boolean).join(' · ');
        return (
            <div className="min-w-0">
                <p className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* La placa se ve como placa: es como la reconoce la operación en la calle y en Drivin */}
                    <span className="bg-background border-foreground/70 inline-flex rounded-md border-[1.5px] px-1.5 py-px font-mono text-sm font-bold tracking-[0.12em]">
                        {v.placa}
                    </span>
                    {!v.activo && <EstadoBadge activo={false} />}
                </p>
                {detalle && <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{detalle}</p>}
            </div>
        );
    };
    const conductorDe = (v: FilaVehiculo) =>
        v.conductor ? (
            <p className="break-words">{v.conductor}</p>
        ) : (
            <span className="text-muted-foreground text-xs">
                <span aria-hidden="true">—</span>
                <span className="sr-only">Sin conductor habitual</span>
            </span>
        );
    // La última vez que salió y, si salió en el último mes, cuántas órdenes llevó
    const usoDe = (v: FilaVehiculo) =>
        v.ultimaJornada ? (
            <>
                <p>{fmt.fechaMedia(v.ultimaJornada)}</p>
                {v.ordenesMes > 0 && (
                    <p className="text-muted-foreground text-xs tabular-nums">
                        {fmt.numero(v.ordenesMes)} {v.ordenesMes === 1 ? 'orden' : 'órdenes'} en los últimos 30 días
                    </p>
                )}
            </>
        ) : (
            <span className="text-muted-foreground text-xs">Aún no ha salido</span>
        );
    const accionesDe = (v: FilaVehiculo) => (
        <AccionesFila
            nombre={`el vehículo ${v.placa}`}
            activo={v.activo}
            urlEstado={puede('vehiculos.estado') ? route('vehiculos.estado', v.id) : undefined}
            onEditar={puede('vehiculos.editar') ? (boton) => abrir(v, boton) : undefined}
            urlEliminar={puede('vehiculos.eliminar') ? route('vehiculos.destroy', v.id) : undefined}
            consecuenciaEliminar="Deja de ofrecerse en la programación. Sus órdenes lo conservan y su placa queda libre por si vuelve a llegar. No se borra: queda en el historial."
            consecuencia="Su historial de órdenes se conserva. Si vuelve a llegar en una preliquidación, sus órdenes se cargan igual. Puedes activarlo de nuevo cuando quieras."
        />
    );
    // Los filtros aparecen cuando hay muchos vehículos (o si ya hay uno puesto, para poder quitarlo)
    const conFiltros = total > POCOS_PARA_FILTRAR || activos;

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
                        {conFiltros && (
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
                        )}

                        {vehiculos.data.length === 0 ? (
                            <SinResultados texto="Ningún vehículo coincide con los filtros." />
                        ) : (
                            <>
                                {/* Desde 1024 px, la tabla; debajo, un bloque por vehículo (nada se desplaza de lado) */}
                                <div className="hidden lg:block">
                                    <Tabla titulo="Flota" minimo="min-w-[680px]" columnas={['40%', '28%', '24%', '3.5rem']}>
                                        <thead className="text-muted-foreground border-b">
                                            <tr>
                                                <th scope="col" className={claseTh}>
                                                    Vehículo
                                                </th>
                                                <th scope="col" className={claseTh}>
                                                    Conductor habitual
                                                </th>
                                                <th scope="col" className={claseTh}>
                                                    Última jornada
                                                </th>
                                                <th scope="col" className={cn(claseTh, 'w-14')}>
                                                    <span className="sr-only">Acciones</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {vehiculos.data.map((v) => (
                                                <tr
                                                    key={v.id}
                                                    className={cn('hover:bg-muted/40 transition-colors', !v.activo && 'text-muted-foreground')}
                                                >
                                                    <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                        {vehiculoDe(v)}
                                                    </th>
                                                    <td className={claseTd}>{conductorDe(v)}</td>
                                                    <td className={claseTd}>{usoDe(v)}</td>
                                                    <td className={cn(claseTd, 'text-right')}>{accionesDe(v)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Tabla>
                                </div>
                                <ul
                                    role="list"
                                    aria-label="Flota"
                                    className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:hidden"
                                >
                                    {vehiculos.data.map((v) => (
                                        <li key={v.id} className={cn('grid gap-3 px-4 py-4 sm:px-5', !v.activo && 'text-muted-foreground')}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">{vehiculoDe(v)}</div>
                                                <div className="-mt-1 -mr-1">{accionesDe(v)}</div>
                                            </div>
                                            <DatosBloque
                                                datos={[
                                                    ...(v.conductor ? [['Conductor', conductorDe(v)] as [string, ReactNode]] : []),
                                                    ['Última jornada', usoDe(v)],
                                                ]}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </>
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
                recuperado={borrador.recuperado}
                onDescartar={borrador.descartar}
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
