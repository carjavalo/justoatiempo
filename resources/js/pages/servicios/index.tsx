import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, contenedorModulo, ConteoEnlace, EncabezadoModulo, EstadoBadge, Tabla } from '@/components/admin/piezas';
import { CalendarRange, LayoutGrid, Plus } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { iconoLinea, ICONOS_LINEA } from '@/lib/iconos-linea';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface FilaLinea {
    id: number;
    slug: string;
    nombre: string;
    descripcion: string | null;
    icono: string | null;
    activa: boolean;
    /** Si tiene las herramientas de Drivin (logística). Todas tienen tablero, programación e informe diario. */
    drivin: boolean;
    empresas: number;
    personas: number;
    /** Si quien mira puede entrar a la página de la línea. */
    verLinea: boolean;
}

interface Props {
    lineas: FilaLinea[];
}

const VACIO = { nombre: '', descripcion: '', icono: '' };
const ORDEN_CAMPOS = Object.keys(VACIO);
const MAX_DESCRIPCION = 300;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const claseTextarea =
    'border-input bg-background w-full rounded-lg border px-3 py-2 text-base leading-relaxed transition-[color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:outline-hidden aria-invalid:border-critical aria-invalid:focus-visible:border-critical aria-invalid:focus-visible:ring-critical/25 md:text-sm';

export default function Servicios({ lineas }: Props) {
    const puede = usePuede();
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<FilaLinea | null>(null);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const form = useForm(VACIO);

    useFocoPrimerError(form.errors, ORDEN_CAMPOS);

    const abrir = (linea: FilaLinea | null, boton: HTMLElement | null = null) => {
        setEditando(linea);
        setOrigen(boton);
        form.clearErrors();
        form.setData(linea ? { nombre: linea.nombre, descripcion: linea.descripcion ?? '', icono: linea.icono ?? '' } : VACIO);
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editando) form.put(route('servicios.update', editando.id), opciones);
        else form.post(route('servicios.store'), opciones);
    };

    const activas = lineas.filter((l) => l.activa).length;
    const IconoVista = iconoLinea({ icono: form.data.icono });
    const iconoElegido = ICONOS_LINEA.find((i) => i.clave === form.data.icono);

    return (
        <AppLayout>
            <Head title="Líneas de servicio" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Líneas de servicio"
                    descripcion="Lo que presta Justo a Tiempo. Cada empresa recibe las suyas y cada persona se asigna a las que hace allí."
                    accion={
                        puede('servicios.crear') && (
                            <Button onClick={() => abrir(null)} className="h-10 rounded-lg px-4 font-semibold">
                                <Plus className="size-4" aria-hidden="true" />
                                Nueva línea
                            </Button>
                        )
                    }
                />

                <p className="text-muted-foreground -mt-2 text-sm">
                    {plural(activas, 'línea activa', 'líneas activas')}
                    {lineas.length > activas && ` · ${plural(lineas.length - activas, 'inactiva', 'inactivas')}`}
                </p>

                <Tabla titulo="Líneas de servicio" columnas={['40%', '17%', '12%', '13%', '10%', '3.5rem']}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            <th scope="col" className={claseTh}>
                                Línea
                            </th>
                            <th scope="col" className={claseTh}>
                                Herramientas
                            </th>
                            <th scope="col" className={claseTh}>
                                Empresas
                            </th>
                            <th scope="col" className={claseTh}>
                                Personal hoy
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
                        {lineas.map((l) => {
                            const Icono = iconoLinea(l);
                            return (
                                <tr key={l.id} className={cn('hover:bg-muted/40 transition-colors', !l.activa && 'text-muted-foreground')}>
                                    <th scope="row" className={cn(claseTd, 'font-normal')}>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                                    l.activa ? 'bg-secondary text-primary' : 'bg-muted',
                                                )}
                                            >
                                                <Icono className="size-5" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-foreground truncate font-semibold" title={l.nombre}>
                                                    {l.nombre}
                                                </p>
                                                {l.descripcion ? (
                                                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed" title={l.descripcion}>
                                                        {l.descripcion}
                                                    </p>
                                                ) : (
                                                    <p className="text-muted-foreground text-xs">Sin descripción</p>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                    <td className={claseTd}>
                                        <span className="text-muted-foreground text-xs">
                                            {l.drivin ? 'Drivin, auditoría e informe' : 'Programación, novedades e informe'}
                                        </span>
                                    </td>
                                    <td className={claseTd}>
                                        <ConteoEnlace n={l.empresas} uno="empresa" varios="empresas" ninguno="Ninguna" de={l.nombre} />
                                    </td>
                                    <td className={claseTd}>
                                        <ConteoEnlace
                                            n={l.personas}
                                            uno="persona"
                                            varios="personas"
                                            ninguno="Nadie"
                                            de={l.nombre}
                                            href={
                                                puede('asignaciones.ver')
                                                    ? route('asignaciones.index', { linea: l.id, estado: 'vigentes' })
                                                    : undefined
                                            }
                                        />
                                    </td>
                                    <td className={claseTd}>
                                        <EstadoBadge activo={l.activa} femenino />
                                    </td>
                                    <td className={cn(claseTd, 'text-right')}>
                                        <AccionesFila
                                            nombre={l.nombre}
                                            activo={l.activa}
                                            // Logística no se desactiva: de ella dependen las herramientas de Drivin
                                            urlEstado={
                                                puede('servicios.estado') && !(l.drivin && l.activa) ? route('servicios.estado', l.id) : undefined
                                            }
                                            onEditar={puede('servicios.editar') ? (boton) => abrir(l, boton) : undefined}
                                            consecuencia="Ya no se ofrecerá al marcar las líneas de una empresa ni al crear asignaciones. Las empresas que la reciben la conservan y su historial se mantiene. Si alguien tiene una asignación vigente o por empezar en ella, primero hay que terminarla."
                                            enlaces={[
                                                ...(l.verLinea
                                                    ? [{ texto: 'Ver la línea', href: route('lineas.show', l.slug), icono: LayoutGrid }]
                                                    : []),
                                                ...(puede('asignaciones.ver')
                                                    ? [
                                                          {
                                                              texto: 'Asignaciones',
                                                              href: route('asignaciones.index', { linea: l.id }),
                                                              icono: CalendarRange,
                                                          },
                                                      ]
                                                    : []),
                                            ]}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Tabla>
            </div>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={editando ? 'Editar línea de servicio' : 'Nueva línea de servicio'}
                descripcion={
                    editando
                        ? 'El nombre nuevo se verá en toda la plataforma y en los carnets; la dirección de su página no cambia.'
                        : 'Nace con su tablero, su programación diaria, sus novedades y su informe diario.'
                }
                onEnviar={guardar}
                procesando={form.processing}
                textoEnviar={editando ? 'Guardar cambios' : 'Crear línea'}
                focoAlCerrar={origen}
            >
                <Campo id="nombre" etiqueta="Nombre" requerido error={form.errors.nombre}>
                    <Input
                        {...propsCampo('nombre', form.errors.nombre)}
                        required
                        maxLength={120}
                        autoComplete="off"
                        placeholder="Por ejemplo, Vigilancia y portería"
                        value={form.data.nombre}
                        onChange={(e) => form.setData('nombre', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>

                <Campo
                    id="descripcion"
                    etiqueta="Qué hace"
                    ayuda={`Una o dos frases; se ve en la página de la línea. ${form.data.descripcion.length}/${MAX_DESCRIPCION}`}
                    error={form.errors.descripcion}
                >
                    <textarea
                        {...propsCampo('descripcion', form.errors.descripcion, 'descripcion-ayuda')}
                        rows={3}
                        maxLength={MAX_DESCRIPCION}
                        value={form.data.descripcion}
                        onChange={(e) => form.setData('descripcion', e.target.value)}
                        className={claseTextarea}
                    />
                </Campo>

                <fieldset className="grid gap-2" aria-describedby={form.errors.icono ? 'icono-error' : 'icono-ayuda'}>
                    <legend className="mb-1.5 text-sm leading-none font-medium">
                        Ícono <span aria-hidden="true">*</span>
                    </legend>
                    <p id="icono-ayuda" className="text-muted-foreground -mt-1 mb-1 text-xs">
                        {iconoElegido ? `Elegido: ${iconoElegido.nombre}.` : 'Lo identifica en el panel, en los formularios y en su página.'}
                    </p>
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                        {ICONOS_LINEA.map((i, n) => {
                            const elegido = form.data.icono === i.clave;
                            // El primero lleva el id "icono" para recibir el foco si el campo tiene error
                            const id = n === 0 ? 'icono' : `icono-${i.clave}`;
                            return (
                                <label
                                    key={i.clave}
                                    htmlFor={id}
                                    title={i.nombre}
                                    className={cn(
                                        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 flex aspect-square cursor-pointer items-center justify-center rounded-lg border transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                                        elegido
                                            ? 'border-primary bg-secondary text-primary'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )}
                                >
                                    <input
                                        id={id}
                                        type="radio"
                                        name="icono"
                                        value={i.clave}
                                        checked={elegido}
                                        onChange={() => form.setData('icono', i.clave)}
                                        aria-invalid={form.errors.icono ? true : undefined}
                                        className="sr-only"
                                    />
                                    <i.icono className="size-5" aria-hidden="true" />
                                    <span className="sr-only">{i.nombre}</span>
                                </label>
                            );
                        })}
                    </div>
                    <InputError id="icono-error" message={form.errors.icono} />
                </fieldset>

                {/* Cómo se verá en el panel, con lo que se va escribiendo */}
                <div className="grid gap-2" aria-hidden="true">
                    <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Vista previa</span>
                    <div className="bg-muted/40 flex items-center gap-3 rounded-xl border p-3">
                        <span className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                            <IconoVista className="size-6" />
                        </span>
                        <span className="min-w-0">
                            <span className={cn('block truncate text-sm font-bold', !form.data.nombre.trim() && 'text-muted-foreground font-medium')}>
                                {form.data.nombre.trim() || 'Nombre de la línea'}
                            </span>
                            <span className="text-muted-foreground line-clamp-2 text-xs">{form.data.descripcion.trim() || 'Qué hace la línea'}</span>
                        </span>
                    </div>
                </div>
            </FormularioLateral>
        </AppLayout>
    );
}
