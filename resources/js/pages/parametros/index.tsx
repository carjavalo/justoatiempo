import { AccionesFila } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { FormularioLateral } from '@/components/admin/formulario-lateral';
import { claseTd, claseTh, contenedorModulo, EncabezadoModulo, EstadoBadge, Tabla } from '@/components/admin/piezas';
import { BotonEnviar } from '@/components/boton-enviar';
import { Award, ClipboardCheck, PackageX, Plus, type TipoIcono } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePuede } from '@/hooks/use-puede';
import AppLayout from '@/layouts/app-layout';
import { fmt } from '@/lib/formato';
import { propsCampo, useFocoPrimerError } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { type FormEvent, type ReactNode, useState } from 'react';

type Severidad = 'ninguna' | 'leve' | 'grave';

interface CampoNumero {
    clave: 'umbral_felicitacion' | 'umbral_llamado_atencion' | 'meta_efectividad_global';
    etiqueta: string;
    ayuda: string;
    min: number;
    max: number;
}

interface Motivo {
    id: number;
    nombre: string;
    imputable: boolean;
    activo: boolean;
    /** Órdenes que lo tienen. */
    usos: number;
}

interface Novedad {
    id: number;
    nombre: string;
    severidad: Severidad;
    activo: boolean;
    /** La sugiere la auditoría por sí sola: su nombre no se cambia. */
    sistema: boolean;
}

interface Props {
    valores: Record<CampoNumero['clave'], number> & { hora_corte_informe: string };
    campos: CampoNumero[];
    motivos: Motivo[];
    novedades: Novedad[];
}

const SEVERIDADES: { valor: Severidad; texto: string; ayuda: string; clase: string }[] = [
    { valor: 'ninguna', texto: 'Sin falta', ayuda: 'Una entrega bien hecha o una nota informativa.', clase: 'bg-good-soft text-good' },
    { valor: 'leve', texto: 'Leve', ayuda: 'Falta una foto, pero la entrega se puede respaldar.', clase: 'bg-warning-soft text-warning' },
    { valor: 'grave', texto: 'Grave', ayuda: 'Sin la evidencia la entrega no se puede respaldar.', clase: 'bg-critical-soft text-critical' },
];

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * Parámetros de la operación: los umbrales con los que el informe diario sugiere felicitar, retroalimentar o llamar
 * la atención, la meta de las sedes nuevas, la hora del informe y los catálogos de motivos de rechazo y de
 * tipos de novedad.
 */
export default function Parametros({ valores, campos, motivos, novedades }: Props) {
    const puede = usePuede();
    const editable = puede('parametros.editar');

    return (
        <AppLayout>
            <Head title="Parámetros" />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo="Parámetros"
                    descripcion="Las reglas con las que trabaja la operación logística: cuándo el informe sugiere felicitar o llamar la atención, y los catálogos que reconoce al cargar Drivin y al auditar evidencias."
                />

                <Umbrales valores={valores} campos={campos} editable={editable} />
                <Catalogos motivos={motivos} novedades={novedades} editable={editable} />
            </div>
        </AppLayout>
    );
}

function Seccion({
    id,
    icono: Icono,
    titulo,
    descripcion,
    accion,
    children,
}: {
    id: string;
    icono: TipoIcono;
    titulo: string;
    descripcion: string;
    accion?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="bg-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
                        <Icono className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 id={id} className="text-lg font-extrabold tracking-tight">
                            {titulo}
                        </h2>
                        <p className="text-muted-foreground max-w-2xl text-sm">{descripcion}</p>
                    </div>
                </div>
                {accion}
            </div>
            {children}
        </section>
    );
}

function Umbrales({ valores, campos, editable }: { valores: Props['valores']; campos: CampoNumero[]; editable: boolean }) {
    const inicial = {
        umbral_felicitacion: numero.format(valores.umbral_felicitacion),
        umbral_llamado_atencion: numero.format(valores.umbral_llamado_atencion),
        meta_efectividad_global: numero.format(valores.meta_efectividad_global),
        hora_corte_informe: valores.hora_corte_informe,
    };
    const form = useForm(inicial);
    useFocoPrimerError(form.errors, Object.keys(inicial));

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        // "95,5" → 95.5
        form.transform((d) => ({
            ...d,
            umbral_felicitacion: d.umbral_felicitacion.replace(',', '.'),
            umbral_llamado_atencion: d.umbral_llamado_atencion.replace(',', '.'),
            meta_efectividad_global: d.meta_efectividad_global.replace(',', '.'),
        }));
        form.put(route('parametros.valores'), { preserveScroll: true });
    };

    const felicitar = Number(form.data.umbral_felicitacion.replace(',', '.'));
    const llamar = Number(form.data.umbral_llamado_atencion.replace(',', '.'));
    const coherente = Number.isFinite(felicitar) && Number.isFinite(llamar) && llamar < felicitar;

    return (
        <Seccion
            id="titulo-umbrales"
            icono={Award}
            titulo="Informe diario y seguimiento"
            descripcion="Con el cumplimiento de cada persona en el día, el informe sugiere la acción a registrar. Quien la registra siempre puede elegir otra."
        >
            <form onSubmit={enviar} noValidate className="bg-card grid gap-6 rounded-2xl border p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {campos.map((c) => (
                        <Campo key={c.clave} id={c.clave} etiqueta={c.etiqueta} requerido ayuda={c.ayuda} error={form.errors[c.clave]}>
                            <div className="relative w-36">
                                <Input
                                    {...propsCampo(c.clave, form.errors[c.clave], `${c.clave}-ayuda`)}
                                    required
                                    inputMode="decimal"
                                    autoComplete="off"
                                    readOnly={!editable}
                                    value={form.data[c.clave]}
                                    onChange={(e) => form.setData(c.clave, e.target.value)}
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
                    ))}
                    <Campo
                        id="hora_corte_informe"
                        etiqueta="Hora del informe"
                        requerido
                        ayuda="La que lleva el título del Excel descargado (p. ej. 10:00 a. m.)."
                        error={form.errors.hora_corte_informe}
                    >
                        <Input
                            {...propsCampo('hora_corte_informe', form.errors.hora_corte_informe, 'hora_corte_informe-ayuda')}
                            type="time"
                            required
                            readOnly={!editable}
                            value={form.data.hora_corte_informe}
                            onChange={(e) => form.setData('hora_corte_informe', e.target.value)}
                            className="h-10 w-36 rounded-lg tabular-nums"
                        />
                    </Campo>
                </div>

                {/* Lo que sugerirá el informe con los valores escritos */}
                <div className="bg-muted/40 grid gap-2 rounded-xl border p-4 text-sm sm:grid-cols-3" aria-live="polite">
                    {coherente ? (
                        <>
                            <Regla clase="bg-good" titulo="Felicitación">
                                Desde {numero.format(felicitar)} % y sin novedades.
                            </Regla>
                            <Regla clase="bg-warning" titulo="Retroalimentación">
                                Entre {numero.format(llamar)} % y {numero.format(felicitar)} %, o con novedades.
                            </Regla>
                            <Regla clase="bg-critical" titulo="Llamado de atención">
                                Por debajo de {numero.format(llamar)} %.
                            </Regla>
                        </>
                    ) : (
                        <p className="text-muted-foreground sm:col-span-3">
                            El umbral del llamado de atención debe ser menor que el de la felicitación.
                        </p>
                    )}
                </div>

                {editable && (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {form.isDirty && <span className="text-muted-foreground text-sm">Hay cambios sin guardar.</span>}
                        <BotonEnviar procesando={form.processing} textoProcesando="Guardando…" className="h-10 rounded-lg px-5 font-semibold">
                            Guardar parámetros
                        </BotonEnviar>
                    </div>
                )}
            </form>
        </Seccion>
    );
}

function Regla({ clase, titulo, children }: { clase: string; titulo: string; children: ReactNode }) {
    return (
        <p className="flex items-start gap-2">
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', clase)} aria-hidden="true" />
            <span>
                <strong className="font-semibold">{titulo}:</strong> <span className="text-muted-foreground">{children}</span>
            </span>
        </p>
    );
}

type Editor = { tipo: 'motivo'; registro: Motivo | null } | { tipo: 'novedad'; registro: Novedad | null };

function Catalogos({ motivos, novedades, editable }: { motivos: Motivo[]; novedades: Novedad[]; editable: boolean }) {
    const [editor, setEditor] = useState<Editor | null>(null);
    const [abierto, setAbierto] = useState(false);
    const [origen, setOrigen] = useState<HTMLElement | null>(null);
    const formMotivo = useForm<{ nombre: string; imputable: boolean }>({ nombre: '', imputable: false });
    const formNovedad = useForm<{ nombre: string; severidad: Severidad | '' }>({ nombre: '', severidad: '' });

    useFocoPrimerError(editor?.tipo === 'novedad' ? formNovedad.errors : formMotivo.errors, ['nombre', 'imputable', 'severidad']);

    const abrirMotivo = (motivo: Motivo | null, boton: HTMLElement | null = null) => {
        setEditor({ tipo: 'motivo', registro: motivo });
        setOrigen(boton);
        formMotivo.clearErrors();
        formMotivo.setData(motivo ? { nombre: motivo.nombre, imputable: motivo.imputable } : { nombre: '', imputable: false });
        setAbierto(true);
    };

    const abrirNovedad = (novedad: Novedad | null, boton: HTMLElement | null = null) => {
        setEditor({ tipo: 'novedad', registro: novedad });
        setOrigen(boton);
        formNovedad.clearErrors();
        formNovedad.setData(novedad ? { nombre: novedad.nombre, severidad: novedad.severidad } : { nombre: '', severidad: '' });
        setAbierto(true);
    };

    const guardar = () => {
        const opciones = { preserveScroll: true, preserveState: true, onSuccess: () => setAbierto(false) };
        if (editor?.tipo === 'motivo') {
            if (editor.registro) formMotivo.put(route('parametros.motivos.update', editor.registro.id), opciones);
            else formMotivo.post(route('parametros.motivos.store'), opciones);
        } else if (editor?.tipo === 'novedad') {
            if (editor.registro) formNovedad.put(route('parametros.novedades.update', editor.registro.id), opciones);
            else formNovedad.post(route('parametros.novedades.store'), opciones);
        }
    };

    const botonNuevo = (texto: string, abrir: () => void) =>
        editable && (
            <Button variant="outline" onClick={abrir} className="h-10 rounded-lg px-4 font-semibold">
                <Plus className="size-4" aria-hidden="true" />
                {texto}
            </Button>
        );

    const novedadDelSistema = editor?.tipo === 'novedad' && editor.registro?.sistema;

    return (
        <>
            <Seccion
                id="titulo-motivos"
                icono={PackageX}
                titulo="Motivos de rechazo"
                descripcion="Los motivos de devolución como llegan en la preliquidación de Drivin. Al cargarla, cada orden rechazada se clasifica con el suyo; uno inactivo ya no se reconoce (la orden guarda solo el texto)."
                accion={botonNuevo('Nuevo motivo', () => abrirMotivo(null))}
            >
                <Tabla titulo="Motivos de rechazo" minimo="min-w-[640px]" columnas={['44%', '22%', '14%', '12%', '3.5rem']}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            <th scope="col" className={claseTh}>
                                Motivo
                            </th>
                            <th scope="col" className={claseTh}>
                                Responsable
                            </th>
                            <th scope="col" className={claseTh}>
                                Órdenes
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
                        {motivos.map((m) => (
                            <tr key={m.id} className={cn('hover:bg-muted/40 transition-colors', !m.activo && 'text-muted-foreground')}>
                                <th scope="row" className={cn(claseTd, 'font-normal')}>
                                    <p className={cn('truncate font-semibold', m.activo && 'text-foreground')} title={m.nombre}>
                                        {m.nombre}
                                    </p>
                                </th>
                                <td className={claseTd}>{m.imputable ? 'La operación' : 'El cliente u otro'}</td>
                                <td className={cn(claseTd, 'tabular-nums')}>
                                    {m.usos ? fmt.numero(m.usos) : <span className="text-muted-foreground text-xs">Ninguna</span>}
                                </td>
                                <td className={claseTd}>
                                    <EstadoBadge activo={m.activo} />
                                </td>
                                <td className={cn(claseTd, 'text-right')}>
                                    <AccionesFila
                                        nombre={`el motivo ${m.nombre}`}
                                        activo={m.activo}
                                        urlEstado={editable ? route('parametros.motivos.estado', m.id) : undefined}
                                        onEditar={editable ? (boton) => abrirMotivo(m, boton) : undefined}
                                        consecuencia="Las próximas cargas de Drivin ya no lo reconocen: esas órdenes guardan solo el texto del motivo. Las órdenes ya cargadas lo conservan."
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Tabla>
            </Seccion>

            <Seccion
                id="titulo-novedades"
                icono={ClipboardCheck}
                titulo="Tipos de novedad"
                descripcion="Lo que se anota al auditar las evidencias de una entrega. Los que sugiere la auditoría por sí sola conservan su nombre; su gravedad sí se puede ajustar."
                accion={botonNuevo('Nuevo tipo', () => abrirNovedad(null))}
            >
                <Tabla titulo="Tipos de novedad" minimo="min-w-[640px]" columnas={['48%', '18%', '18%', '12%', '3.5rem']}>
                    <thead className="text-muted-foreground border-b">
                        <tr>
                            <th scope="col" className={claseTh}>
                                Tipo
                            </th>
                            <th scope="col" className={claseTh}>
                                Gravedad
                            </th>
                            <th scope="col" className={claseTh}>
                                Origen
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
                        {novedades.map((n) => {
                            const severidad = SEVERIDADES.find((s) => s.valor === n.severidad) ?? SEVERIDADES[0];
                            return (
                                <tr key={n.id} className={cn('hover:bg-muted/40 transition-colors', !n.activo && 'text-muted-foreground')}>
                                    <th scope="row" className={cn(claseTd, 'font-normal')}>
                                        <p className={cn('truncate font-semibold', n.activo && 'text-foreground')} title={n.nombre}>
                                            {n.nombre}
                                        </p>
                                    </th>
                                    <td className={claseTd}>
                                        <span
                                            className={cn(
                                                'rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                                                n.activo ? severidad.clase : 'bg-muted',
                                            )}
                                        >
                                            {severidad.texto}
                                        </span>
                                    </td>
                                    <td className={cn(claseTd, 'text-xs')}>{n.sistema ? 'De la auditoría' : 'Agregado aquí'}</td>
                                    <td className={claseTd}>
                                        <EstadoBadge activo={n.activo} />
                                    </td>
                                    <td className={cn(claseTd, 'text-right')}>
                                        <AccionesFila
                                            nombre={`el tipo ${n.nombre}`}
                                            activo={n.activo}
                                            urlEstado={editable ? route('parametros.novedades.estado', n.id) : undefined}
                                            onEditar={editable ? (boton) => abrirNovedad(n, boton) : undefined}
                                            consecuencia="Ya no se ofrece al auditar las evidencias. Las órdenes que ya lo tienen lo conservan."
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Tabla>
            </Seccion>

            <FormularioLateral
                abierto={abierto}
                onCambio={setAbierto}
                titulo={
                    editor?.tipo === 'novedad'
                        ? editor.registro
                            ? 'Editar tipo de novedad'
                            : 'Nuevo tipo de novedad'
                        : editor?.registro
                          ? 'Editar motivo de rechazo'
                          : 'Nuevo motivo de rechazo'
                }
                descripcion={
                    editor?.tipo === 'novedad'
                        ? 'Se ofrece al auditar las evidencias de cada entrega.'
                        : 'Escríbelo como llega en la columna de motivo de Drivin: así las cargas lo reconocen.'
                }
                onEnviar={guardar}
                procesando={editor?.tipo === 'novedad' ? formNovedad.processing : formMotivo.processing}
                textoEnviar={editor?.registro ? 'Guardar cambios' : 'Agregar'}
                focoAlCerrar={origen}
            >
                {editor?.tipo === 'novedad' ? (
                    <>
                        <Campo
                            id="nombre"
                            etiqueta="Nombre"
                            requerido
                            ayuda={novedadDelSistema ? 'Lo sugiere la auditoría por sí sola: su nombre no se cambia.' : undefined}
                            error={formNovedad.errors.nombre}
                        >
                            <Input
                                {...propsCampo('nombre', formNovedad.errors.nombre, novedadDelSistema ? 'nombre-ayuda' : undefined)}
                                required
                                maxLength={150}
                                autoComplete="off"
                                readOnly={Boolean(novedadDelSistema)}
                                value={formNovedad.data.nombre}
                                onChange={(e) => formNovedad.setData('nombre', e.target.value)}
                                className="read-only:bg-muted/50 h-10 rounded-lg"
                            />
                        </Campo>
                        <OpcionesSeveridad
                            valor={formNovedad.data.severidad}
                            onCambio={(v) => formNovedad.setData('severidad', v)}
                            error={formNovedad.errors.severidad}
                        />
                    </>
                ) : (
                    <>
                        <Campo id="nombre" etiqueta="Motivo" requerido error={formMotivo.errors.nombre}>
                            <Input
                                {...propsCampo('nombre', formMotivo.errors.nombre)}
                                required
                                maxLength={150}
                                autoComplete="off"
                                placeholder="Por ejemplo, Cliente ausente en domicilio"
                                value={formMotivo.data.nombre}
                                onChange={(e) => formMotivo.setData('nombre', e.target.value)}
                                className="h-10 rounded-lg"
                            />
                        </Campo>
                        <OpcionesResponsable
                            valor={formMotivo.data.imputable}
                            onCambio={(v) => formMotivo.setData('imputable', v)}
                            error={formMotivo.errors.imputable}
                        />
                    </>
                )}
            </FormularioLateral>
        </>
    );
}

/** Opciones con su explicación, como tarjetas de radio (el primero lleva el id del campo para el foco del error). */
function GrupoOpciones<T extends string>({
    id,
    etiqueta,
    valor,
    onCambio,
    opciones,
    error,
}: {
    id: string;
    etiqueta: string;
    valor: T | '';
    onCambio: (v: T) => void;
    opciones: { valor: T; texto: string; ayuda: string; marca?: string }[];
    error?: string;
}) {
    return (
        <fieldset className="grid gap-2" aria-describedby={error ? `${id}-error` : undefined}>
            <legend className="mb-1.5 text-sm leading-none font-medium">
                {etiqueta} <span aria-hidden="true">*</span>
            </legend>
            {opciones.map((o, i) => {
                const elegido = valor === o.valor;
                const idOpcion = i === 0 ? id : `${id}-${o.valor}`;
                return (
                    <label
                        key={o.valor}
                        htmlFor={idOpcion}
                        className={cn(
                            'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/25 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-[color,border-color,box-shadow] has-[:focus-visible]:ring-[3px]',
                            elegido ? 'border-primary bg-secondary/60' : 'hover:bg-muted/60',
                        )}
                    >
                        <input
                            id={idOpcion}
                            type="radio"
                            name={id}
                            value={o.valor}
                            checked={elegido}
                            onChange={() => onCambio(o.valor)}
                            aria-invalid={error ? true : undefined}
                            className="accent-primary mt-0.5 size-4 shrink-0"
                        />
                        <span className="grid gap-0.5">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                {o.marca && <span className={cn('size-2 rounded-full', o.marca)} aria-hidden="true" />}
                                {o.texto}
                            </span>
                            <span className="text-muted-foreground text-xs">{o.ayuda}</span>
                        </span>
                    </label>
                );
            })}
            <InputError id={`${id}-error`} message={error} />
        </fieldset>
    );
}

function OpcionesSeveridad({ valor, onCambio, error }: { valor: Severidad | ''; onCambio: (v: Severidad) => void; error?: string }) {
    const marcas: Record<Severidad, string> = { ninguna: 'bg-good', leve: 'bg-warning', grave: 'bg-critical' };
    return (
        <GrupoOpciones
            id="severidad"
            etiqueta="Gravedad"
            valor={valor}
            onCambio={onCambio}
            error={error}
            opciones={SEVERIDADES.map((s) => ({ valor: s.valor, texto: s.texto, ayuda: s.ayuda, marca: marcas[s.valor] }))}
        />
    );
}

function OpcionesResponsable({ valor, onCambio, error }: { valor: boolean; onCambio: (v: boolean) => void; error?: string }) {
    return (
        <GrupoOpciones
            id="imputable"
            etiqueta="¿De quién depende?"
            valor={valor ? 'si' : 'no'}
            onCambio={(v) => onCambio(v === 'si')}
            error={error}
            opciones={[
                { valor: 'no', texto: 'Del cliente u otro', ayuda: 'Cliente ausente, dirección errada, reprogramación…' },
                { valor: 'si', texto: 'De la operación', ayuda: 'Producto averiado, no alcanzó el tiempo en ruta…' },
            ]}
        />
    );
}
