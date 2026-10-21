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
import { Plus, Store } from '@/components/iconos';
import { Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaSede {
    id: number;
    nombre: string;
    empresaId: number;
    empresa: string | null;
    codigo: string | null;
    meta: number;
    activo: boolean;
    sucursales: number;
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
    /** La meta con la que nace una sede nueva (Parámetros). */
    metaPorDefecto: number;
}

const VACIO = { nombre: '', codigo: '', empresa_id: '', meta_efectividad: '95' };
const ORDEN_CAMPOS = Object.keys(VACIO);

const formatoMeta = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * Sedes: los clientes que atiende cada empresa (TuGo y Sodimac, de Ditranza). Cada una tiene su meta de
 * efectividad pactada y sus sucursales.
 */
export default function Sedes({ sedes, total, filtros, empresas, metaPorDefecto }: Props) {
    const puede = usePuede();
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
                ? {
                      nombre: sede.nombre,
                      codigo: sede.codigo ?? '',
                      empresa_id: String(sede.empresaId),
                      meta_efectividad: formatoMeta.format(sede.meta),
                  }
                : // Si la lista está filtrada por una empresa, la sede nueva nace en esa empresa
                  { ...VACIO, empresa_id: /^\d+$/.test(valores.empresa) ? valores.empresa : '', meta_efectividad: formatoMeta.format(metaPorDefecto) },
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
        <AppLayout>
            <Head title="Sedes" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Sedes"
                    descripcion="Las sedes de cada empresa (por ejemplo, TuGo y Sodimac, de Ditranza), con su meta de efectividad."
                    accion={total > 0 && puede('sedes.crear') && botonNueva('Nueva sede')}
                />

                {total === 0 ? (
                    <EstadoVacio
                        icono={Store}
                        titulo="Aún no hay sedes registradas"
                        texto="Registra la primera sede; después podrás crear sus sucursales."
                        accion={puede('sedes.crear') && botonNueva('Registrar la primera sede')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={
                                sedes.total ? `${sedes.total} ${sedes.total === 1 ? 'sede' : 'sedes'}` : 'Ninguna sede coincide con los filtros.'
                            }
                            soloAnunciar={sedes.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-sedes"
                        >
                            <CampoBusqueda
                                id="buscar-sedes"
                                etiqueta="Buscar sedes"
                                placeholder="Buscar por nombre o código en Drivin"
                                valor={valores.q}
                                onCambio={(v) => cambiar('q', v, { inmediato: false })}
                            />
                            <FiltroLista
                                id="filtro-empresa"
                                etiqueta="Empresa"
                                valor={valores.empresa}
                                onCambio={(v) => cambiar('empresa', v)}
                                className="sm:w-60"
                                opciones={[
                                    { valor: '', texto: 'Todas las empresas' },
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
                            <Tabla titulo="Sedes" columnas={['31%', '23%', '14%', '13%', '11%', '3.5rem']}>
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Sede
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Empresa
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Sucursales
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
                                                    <span
                                                        className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl"
                                                        aria-hidden="true"
                                                    >
                                                        <Store className="size-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-foreground truncate font-semibold" title={s.nombre}>
                                                            {s.nombre}
                                                        </p>
                                                        <p className="text-muted-foreground truncate text-xs">
                                                            {[s.codigo && `Drivin: ${s.codigo}`, `Meta ${formatoMeta.format(s.meta)} %`]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                <p className="truncate" title={s.empresa ?? undefined}>
                                                    {s.empresa}
                                                </p>
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace
                                                    n={s.sucursales}
                                                    uno="sucursal"
                                                    varios="sucursales"
                                                    ninguno="Ninguna"
                                                    de={`la sede ${s.nombre}`}
                                                    href={puede('sucursales.ver') ? route('sucursales.index', { sede: s.id }) : undefined}
                                                />
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace
                                                    n={s.usuarios}
                                                    uno="usuario"
                                                    varios="usuarios"
                                                    ninguno="Ninguno"
                                                    de={`la sede ${s.nombre}`}
                                                    href={puede('usuarios.ver') ? route('usuarios.index', { sede: s.id }) : undefined}
                                                />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={s.activo} femenino />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={`la sede ${s.nombre}`}
                                                    activo={s.activo}
                                                    urlEstado={puede('sedes.estado') ? route('sedes.estado', s.id) : undefined}
                                                    onEditar={puede('sedes.editar') ? (boton) => abrir(s, boton) : undefined}
                                                    consecuencia={`No se le podrán asignar nuevas sucursales ni usuarios; ${s.sucursales === 1 ? 'su sucursal se conserva' : s.sucursales > 1 ? `sus ${s.sucursales} sucursales se conservan` : 'no tiene sucursales'}. Puedes volver a activarla cuando quieras.`}
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
                descripcion={editando ? `Actualiza los datos de la sede ${editando.nombre}.` : 'Registra una sede de una empresa.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear sede'}
                focoAlCerrar={origen}
            >
                <Campo
                    id="nombre"
                    etiqueta="Nombre de la sede"
                    requerido
                    ayuda="Drivin la reconoce por este nombre o por su código, en la columna «Cliente corporativo»."
                    error={form.errors.nombre}
                >
                    <Input
                        {...propsCampo('nombre', form.errors.nombre, 'nombre-ayuda')}
                        required
                        autoComplete="off"
                        placeholder="Ej.: TuGo"
                        value={form.data.nombre}
                        onChange={(e) => form.setData('nombre', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <Campo
                    id="codigo"
                    etiqueta="Código en Drivin"
                    ayuda="Opcional: como la escribe Drivin si es distinto del nombre (p. ej. TUGO)."
                    error={form.errors.codigo}
                >
                    <Input
                        {...propsCampo('codigo', form.errors.codigo, 'codigo-ayuda')}
                        autoComplete="off"
                        value={form.data.codigo}
                        onChange={(e) => form.setData('codigo', e.target.value)}
                        className="h-10 w-48 rounded-lg uppercase"
                    />
                </Campo>

                <Campo
                    id="empresa_id"
                    etiqueta="Empresa"
                    requerido
                    ayuda={editando ? 'Si la cambias, la sede pasa a la otra empresa con sus sucursales, su operación y su personal.' : undefined}
                    error={form.errors.empresa_id}
                >
                    <Selector
                        {...propsCampo('empresa_id', form.errors.empresa_id, editando ? 'empresa_id-ayuda' : undefined)}
                        valor={form.data.empresa_id}
                        onCambio={(v) => form.setData('empresa_id', v)}
                        placeholder="Elige la empresa a la que pertenece esta sede"
                        opciones={empresasFormulario.map((e) => ({ valor: String(e.id), texto: e.activo ? e.nombre : `${e.nombre} (inactiva)` }))}
                    />
                </Campo>

                <Campo
                    id="meta_efectividad"
                    etiqueta="Meta de efectividad"
                    requerido
                    ayuda="De cada 100 entregas, cuántas deben salir bien (aprobadas, sin devolución). Es lo pactado con el cliente; el tablero de logística compara la efectividad real contra esta meta. Si no hay un acuerdo, deja la de Parámetros (${formatoMeta.format(metaPorDefecto)} %)."
                    error={form.errors.meta_efectividad}
                >
                    <div className="relative w-36">
                        <Input
                            {...propsCampo('meta_efectividad', form.errors.meta_efectividad, 'meta_efectividad-ayuda')}
                            required
                            inputMode="decimal"
                            autoComplete="off"
                            value={form.data.meta_efectividad}
                            onChange={(e) => form.setData('meta_efectividad', e.target.value)}
                            className="h-10 rounded-lg pr-9 tabular-nums"
                        />
                        <span
                            className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm"
                            aria-hidden="true"
                        >
                            %
                        </span>
                    </div>
                </Campo>
            </FormularioLateral>
        </AppLayout>
    );
}
