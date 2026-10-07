import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, ConteoEnlace, contenedorModulo, EncabezadoModulo, EstadoBadge, EstadoVacio, Iniciales, Paginacion, SinResultados, Tabla } from '@/components/admin/piezas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { digitoVerificacion, formatearNit, partesNit } from '@/lib/nit';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Building2, Plus } from '@/components/iconos';
import { useState } from 'react';

interface FilaEmpresa {
    id: number;
    nombre: string;
    nit: string | null;
    contactoNombre: string | null;
    contactoEmail: string | null;
    contactoTelefono: string | null;
    activo: boolean;
    sedes: number;
    usuarios: number;
}

interface Props {
    empresas: Paginado<FilaEmpresa>;
    total: number;
    filtros: { q: string; estado: string };
}

const VACIO = { nombre: '', nit: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "su sede se conserva", "sus 3 sedes se conservan", "no tiene sedes"… */
function seConserva(n: number, uno: string, varios: string): string {
    if (n === 0) return `no tiene ${varios}`;
    return n === 1 ? `su ${uno} se conserva` : `sus ${n} ${varios} se conservan`;
}

export default function Empresas({ empresas, total, filtros }: Props) {
    const { valores, cambiar, limpiar, activos } = useFiltros(route('empresas.index'), filtros);
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaEmpresa | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (empresa: FilaEmpresa | null, boton: HTMLElement | null = null) => {
        setEditando(empresa);
        setOrigen(boton);
        form.clearErrors();
        form.setData(
            empresa
                ? {
                      nombre: empresa.nombre,
                      nit: formatearNit(empresa.nit),
                      contacto_nombre: empresa.contactoNombre ?? '',
                      contacto_email: empresa.contactoEmail ?? '',
                      contacto_telefono: empresa.contactoTelefono ?? '',
                  }
                : VACIO,
        );
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('empresas.update', editando.id), opciones);
        else form.post(route('empresas.store'), opciones);
    };

    const botonNueva = (texto: string) => (
        <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
            <Plus className="size-4" aria-hidden="true" />
            {texto}
        </Button>
    );

    return (
        <AppLayout breadcrumbs={[{ title: 'Empresas', href: route('empresas.index') }]}>
            <Head title="Empresas" />

            <div className={contenedorModulo}>
                {/* Sin empresas, la acción vive en el estado vacío: un solo botón para crear */}
                <EncabezadoModulo titulo="Empresas" descripcion="Las empresas clientes a las que Justo a Tiempo les presta sus servicios." accion={total > 0 && botonNueva('Nueva empresa')} />

                {total === 0 ? (
                    <EstadoVacio
                        icono={Building2}
                        titulo="Aún no hay empresas registradas"
                        texto="Registra cada empresa cliente con su razón social, NIT y contacto. Después podrás crear sus sedes y asignarles usuarios."
                        accion={botonNueva('Registrar la primera empresa')}
                    />
                ) : (
                    <>
                        <BarraFiltros
                            resumen={empresas.total ? plural(empresas.total, 'empresa', 'empresas') : 'Ninguna empresa coincide con los filtros.'}
                            soloAnunciar={empresas.total === 0}
                            activos={activos}
                            onLimpiar={limpiar}
                            idBusqueda="buscar-empresas"
                        >
                            <CampoBusqueda id="buscar-empresas" etiqueta="Buscar empresas" placeholder="Buscar por razón social, NIT o contacto" valor={valores.q} onCambio={(v) => cambiar('q', v, { inmediato: false })} />
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

                        {empresas.data.length === 0 ? (
                            <SinResultados texto="Ninguna empresa coincide con los filtros." />
                        ) : (
                            <Tabla titulo="Empresas clientes">
                                <thead className="text-muted-foreground border-b">
                                    <tr>
                                        <th scope="col" className={claseTh}>
                                            Empresa
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Contacto
                                        </th>
                                        <th scope="col" className={claseTh}>
                                            Sedes
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
                                    {empresas.data.map((e) => (
                                        <tr key={e.id} className={cn('hover:bg-muted/40 transition-colors', !e.activo && 'text-muted-foreground')}>
                                            <th scope="row" className={cn(claseTd, 'font-normal')}>
                                                <div className="flex items-center gap-3">
                                                    <Iniciales texto={e.nombre} />
                                                    <div className="min-w-0">
                                                        <p className="text-foreground truncate font-semibold">{e.nombre}</p>
                                                        <p className="text-muted-foreground text-xs">{e.nit ? `NIT ${formatearNit(e.nit)}` : 'Sin NIT'}</p>
                                                    </div>
                                                </div>
                                            </th>
                                            <td className={claseTd}>
                                                {e.contactoNombre || e.contactoEmail || e.contactoTelefono ? (
                                                    <div className="min-w-0 text-xs leading-relaxed">
                                                        {e.contactoNombre && <p className="text-foreground text-sm font-medium">{e.contactoNombre}</p>}
                                                        {e.contactoEmail && <p className="truncate">{e.contactoEmail}</p>}
                                                        {e.contactoTelefono && <p>{e.contactoTelefono}</p>}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Sin contacto</span>
                                                )}
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace n={e.sedes} uno="sede" varios="sedes" ninguno="Ninguna" de={e.nombre} href={route('sedes.index', { empresa: e.id })} />
                                            </td>
                                            <td className={claseTd}>
                                                <ConteoEnlace n={e.usuarios} uno="usuario" varios="usuarios" ninguno="Ninguno" de={e.nombre} href={route('usuarios.index', { empresa: e.id })} />
                                            </td>
                                            <td className={claseTd}>
                                                <EstadoBadge activo={e.activo} femenino />
                                            </td>
                                            <td className={cn(claseTd, 'text-right')}>
                                                <AccionesFila
                                                    nombre={e.nombre}
                                                    activo={e.activo}
                                                    urlEstado={route('empresas.estado', e.id)}
                                                    onEditar={(boton) => abrir(e, boton)}
                                                    consecuencia={`No se le podrán asignar nuevas sedes ni usuarios. ${mayuscula(seConserva(e.sedes, 'sede', 'sedes'))} y ${seConserva(e.usuarios, 'usuario', 'usuarios')}. Puedes volver a activarla cuando quieras.`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Tabla>
                        )}

                        <Paginacion pagina={empresas} nombre="empresas" />
                    </>
                )}
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar empresa' : 'Nueva empresa'}
                descripcion={editando ? `Actualiza los datos de ${editando.nombre}.` : 'Registra una empresa cliente para luego crear sus sedes.'}
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear empresa'}
                focoAlCerrar={origen}
            >
                <Campo id="nombre" etiqueta="Razón social" requerido error={form.errors.nombre}>
                    <Input {...propsCampo('nombre', form.errors.nombre)} required autoComplete="organization" value={form.data.nombre} onChange={(e) => form.setData('nombre', e.target.value)} className="h-10 rounded-lg" />
                </Campo>

                <Campo id="nit" etiqueta="NIT" ayuda={form.errors.nit ? undefined : <AyudaNit valor={form.data.nit} />} error={form.errors.nit}>
                    <Input
                        {...propsCampo('nit', form.errors.nit, form.errors.nit ? undefined : 'nit-ayuda')}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="900.123.456-8"
                        value={form.data.nit}
                        onChange={(e) => {
                            form.setData('nit', e.target.value);
                            // Al corregirlo, vuelve la ayuda en vivo en lugar del error anterior
                            if (form.errors.nit) form.clearErrors('nit');
                        }}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <fieldset className="grid gap-4 rounded-xl border p-4">
                    <legend className="px-1 text-sm font-semibold">Contacto principal</legend>
                    <Campo id="contacto_nombre" etiqueta="Nombre" error={form.errors.contacto_nombre}>
                        <Input {...propsCampo('contacto_nombre', form.errors.contacto_nombre)} autoComplete="off" value={form.data.contacto_nombre} onChange={(e) => form.setData('contacto_nombre', e.target.value)} className="h-10 rounded-lg" />
                    </Campo>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Campo id="contacto_email" etiqueta="Correo" error={form.errors.contacto_email}>
                            <Input {...propsCampo('contacto_email', form.errors.contacto_email)} type="email" autoComplete="off" value={form.data.contacto_email} onChange={(e) => form.setData('contacto_email', e.target.value)} className="h-10 rounded-lg" />
                        </Campo>
                        <Campo id="contacto_telefono" etiqueta="Teléfono" error={form.errors.contacto_telefono}>
                            <Input {...propsCampo('contacto_telefono', form.errors.contacto_telefono)} type="tel" autoComplete="off" value={form.data.contacto_telefono} onChange={(e) => form.setData('contacto_telefono', e.target.value)} className="h-10 rounded-lg" />
                        </Campo>
                    </div>
                </fieldset>
            </FormularioLateral>
        </AppLayout>
    );
}

/** Calcula el dígito de verificación mientras se escribe. */
function AyudaNit({ valor }: { valor: string }) {
    if (!valor.trim()) return <>Opcional. Puedes escribirlo con o sin dígito de verificación.</>;
    const partes = partesNit(valor);
    if (!partes) return <>Usa solo números y, si quieres, un guion con el dígito de verificación.</>;
    const dv = digitoVerificacion(partes.numero);
    if (partes.dv === null) return <>Dígito de verificación: {dv}. Se guardará como {formatearNit(`${partes.numero}-${dv}`)}.</>;
    if (partes.dv !== dv) return <span className="text-warning font-medium">El dígito de verificación de {formatearNit(partes.numero)} es {dv}, no {partes.dv}.</span>;
    return <>NIT válido: {formatearNit(`${partes.numero}-${dv}`)}.</>;
}
