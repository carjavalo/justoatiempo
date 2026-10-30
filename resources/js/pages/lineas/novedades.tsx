import { ConfirmarEliminar } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { BarraFiltros, CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { OpcionesRadio } from '@/components/admin/opciones-radio';
import { Paginacion, SinResultados } from '@/components/admin/piezas';
import { DialogoFormulario } from '@/components/dialogo-formulario';
import { AlertTriangle, Pencil, Plus, Trash2 } from '@/components/iconos';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { type OpcionSelector, Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBorrador } from '@/hooks/use-borrador';
import { usePuede } from '@/hooks/use-puede';
import { fechaHoraCompleta, fmt } from '@/lib/formato';
import { propsCampo } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { useForm } from '@inertiajs/react';
import { type FormEvent, useEffect, useState } from 'react';

type Gravedad = 'ninguna' | 'leve' | 'grave';
type Estado = 'abierta' | 'en_seguimiento' | 'cerrada';

interface Novedad {
    id: number;
    fecha: string;
    lugar: string;
    lugarClave: string;
    personaId: number | null;
    persona: string | null;
    cedula: string | null;
    tipo: string;
    gravedad: Gravedad;
    descripcion: string;
    estado: Estado;
    seguimiento: string | null;
    registradaPor: string | null;
    registradaEn: string | null;
    cerradaPor: string | null;
    cerradaEn: string | null;
    acciones: { id: number; tipo: string; texto: string; fecha: string; descripcion: string | null; registradaPor: string | null }[];
}

interface Props {
    linea: { id: number; slug: string; nombre: string; icono: string | null };
    novedades: Paginado<Novedad>;
    filtros: { estado: string; lugar: string; q: string };
    conteo: Record<Estado, number>;
    lugares: OpcionSelector[];
    /** Las personas de la línea y las claves de los lugares donde trabajan. */
    personas: { id: number; nombre: string; detalle: string; lugares: string[] }[];
    tipos: { valor: string; gravedad: Gravedad }[];
    gravedades: { valor: Gravedad; texto: string }[];
    estados: { valor: Estado; texto: string }[];
    tiposAccion: { valor: string; texto: string }[];
    hoy: string;
}

const GRAVEDAD: Record<Gravedad, { clase: string; marca: string }> = {
    ninguna: { clase: 'bg-good-soft text-good', marca: 'bg-good' },
    leve: { clase: 'bg-warning-soft text-warning', marca: 'bg-warning' },
    grave: { clase: 'bg-critical-soft text-critical', marca: 'bg-critical' },
};

const ESTADO: Record<Estado, string> = {
    abierta: 'bg-critical-soft text-critical',
    en_seguimiento: 'bg-warning-soft text-warning',
    cerrada: 'bg-muted text-muted-foreground',
};

/**
 * Novedades y seguimiento de una línea: lo que pasa en la operación de cada lugar, con quién le da seguimiento hasta
 * cerrarla y la acción de desempeño que se toma con la persona, si hay una.
 */
export default function Novedades({ linea, novedades, filtros, conteo, lugares, personas, tipos, gravedades, estados, tiposAccion, hoy }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar, activos } = useFiltros(route('novedades.index', linea.slug), filtros);
    const [registrando, setRegistrando] = useState(false);
    const [siguiendo, setSiguiendo] = useState<Novedad | null>(null);
    const [corrigiendo, setCorrigiendo] = useState<Novedad | null>(null);
    const [eliminando, setEliminando] = useState<Novedad | null>(null);
    const textoGravedad = (g: Gravedad) => gravedades.find((x) => x.valor === g)?.texto ?? g;
    const textoEstado = (e: Estado) => estados.find((x) => x.valor === e)?.texto ?? e;

    return (
        <MarcoLinea
            slug={linea.slug}
            nombre={linea.nombre}
            icono={linea.icono}
            titulo="Novedades"
            seccion="novedades"
            pestanas
            acciones={
                puede('novedades.registrar') &&
                lugares.length > 0 && (
                    <Button className="h-9 rounded-lg text-xs font-semibold" onClick={() => setRegistrando(true)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Registrar novedad
                    </Button>
                )
            }
        >
            <BarraFiltros
                resumen={
                    novedades.total
                        ? `${novedades.total} ${novedades.total === 1 ? 'novedad' : 'novedades'}`
                        : 'Ninguna novedad coincide con los filtros.'
                }
                soloAnunciar={novedades.total === 0}
                activos={activos}
                onLimpiar={limpiar}
                idBusqueda="buscar-novedades"
            >
                <CampoBusqueda
                    id="buscar-novedades"
                    etiqueta="Buscar novedades"
                    placeholder="Buscar por persona, cédula, tipo o lo que pasó"
                    valor={valores.q}
                    onCambio={(v) => cambiar('q', v, { inmediato: false })}
                />
                <FiltroLista
                    id="filtro-estado"
                    etiqueta="Estado"
                    valor={valores.estado}
                    onCambio={(v) => cambiar('estado', v)}
                    className="sm:w-56"
                    opciones={[
                        { valor: '', texto: `Sin cerrar (${conteo.abierta + conteo.en_seguimiento})` },
                        { valor: 'abierta', texto: `Abiertas (${conteo.abierta})` },
                        { valor: 'en_seguimiento', texto: `En seguimiento (${conteo.en_seguimiento})` },
                        { valor: 'cerrada', texto: `Cerradas (${conteo.cerrada})` },
                    ]}
                />
                {lugares.length > 1 && (
                    <FiltroLista
                        id="filtro-lugar"
                        etiqueta="Lugar"
                        valor={valores.lugar}
                        onCambio={(v) => cambiar('lugar', v)}
                        className="sm:w-64"
                        opciones={[{ valor: '', texto: 'Todos los lugares' }, ...lugares]}
                    />
                )}
            </BarraFiltros>

            {novedades.data.length === 0 ? (
                <SinResultados texto={!activos ? 'No hay novedades sin cerrar.' : 'Ninguna novedad coincide con los filtros.'} />
            ) : (
                <ul role="list" aria-label="Novedades" className="flex flex-col gap-3">
                    {novedades.data.map((n) => (
                        <li key={n.id} className="bg-card rounded-2xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold">{n.tipo}</span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                GRAVEDAD[n.gravedad].clase,
                                            )}
                                        >
                                            <span className={cn('size-1.5 rounded-full', GRAVEDAD[n.gravedad].marca)} aria-hidden="true" />
                                            {textoGravedad(n.gravedad)}
                                        </span>
                                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ESTADO[n.estado])}>
                                            {textoEstado(n.estado)}
                                        </span>
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        <span className="first-letter:uppercase">{fmt.fechaMedia(n.fecha)}</span> · {n.lugar}
                                        {n.persona && (
                                            <>
                                                {' · '}
                                                <span className="text-foreground font-semibold">{n.persona}</span>
                                                {n.cedula && ` (C.C. ${n.cedula})`}
                                            </>
                                        )}
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{n.descripcion}</p>
                                    {n.seguimiento && (
                                        <p className="bg-muted/50 mt-2 rounded-lg px-3 py-2 text-sm whitespace-pre-line">
                                            <span className="font-semibold">Seguimiento: </span>
                                            {n.seguimiento}
                                        </p>
                                    )}
                                    {n.acciones.length > 0 && (
                                        <p className="mt-2 text-xs">
                                            <span className="font-semibold">Acción tomada: </span>
                                            {n.acciones.map((a) => a.texto).join(', ')}
                                        </p>
                                    )}
                                    <p className="text-muted-foreground mt-2 text-[0.7rem]">
                                        {n.registradaPor && `Registrada por ${n.registradaPor}`}
                                        {n.registradaEn && ` el ${fechaHoraCompleta.format(new Date(n.registradaEn))}`}
                                        {n.cerradaPor && ` · Cerrada por ${n.cerradaPor}`}
                                        {n.cerradaEn && ` el ${fechaHoraCompleta.format(new Date(n.cerradaEn))}`}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {puede('novedades.registrar') && n.estado !== 'cerrada' && (
                                        <Button variant="ghost" className="h-9 rounded-lg text-xs font-semibold" onClick={() => setCorrigiendo(n)}>
                                            <Pencil className="size-4" aria-hidden="true" />
                                            Modificar
                                            <span className="sr-only">
                                                {' '}
                                                la novedad {n.tipo} del {fmt.fechaMedia(n.fecha)}
                                            </span>
                                        </Button>
                                    )}
                                    {puede('novedades.eliminar') && (
                                        <Button variant="ghost" className="text-critical hover:bg-critical-soft hover:text-critical h-9 rounded-lg text-xs font-semibold" onClick={() => setEliminando(n)}>
                                            <Trash2 className="size-4" aria-hidden="true" />
                                            Eliminar
                                            <span className="sr-only">
                                                {' '}
                                                la novedad {n.tipo} del {fmt.fechaMedia(n.fecha)}
                                            </span>
                                        </Button>
                                    )}
                                    {puede('novedades.cerrar') && (
                                        <Button variant="outline" className="h-9 rounded-lg text-xs font-semibold" onClick={() => setSiguiendo(n)}>
                                            {n.estado === 'cerrada' ? 'Ver o reabrir' : 'Dar seguimiento'}
                                            <span className="sr-only">
                                                {' '}
                                                a la novedad {n.tipo} del {fmt.fechaMedia(n.fecha)}
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <Paginacion pagina={novedades} nombre="novedades" />

            {(registrando || corrigiendo) && (
                <DialogoRegistrar
                    novedad={corrigiendo}
                    linea={linea}
                    lugares={lugares}
                    personas={personas}
                    tipos={tipos}
                    gravedades={gravedades}
                    hoy={hoy}
                    onCerrar={() => {
                        setRegistrando(false);
                        setCorrigiendo(null);
                    }}
                />
            )}
            {eliminando && (
                <ConfirmarEliminar
                    abierto
                    nombre={`la novedad ${eliminando.tipo}`}
                    url={route('novedades.destroy', eliminando.id)}
                    consecuencia="No se puede deshacer. Si ya se resolvió, mejor ciérrala: así queda en el informe de la jornada."
                    onCerrar={() => setEliminando(null)}
                />
            )}
            {siguiendo && <DialogoSeguimiento novedad={siguiendo} estados={estados} tiposAccion={tiposAccion} onCerrar={() => setSiguiendo(null)} />}
        </MarcoLinea>
    );
}
function DialogoRegistrar({
    novedad,
    linea,
    lugares,
    personas,
    tipos,
    gravedades,
    hoy,
    onCerrar,
}: {
    /** La que se corrige; sin ella se registra una nueva. */
    novedad: Novedad | null;
    linea: Props['linea'];
    lugares: OpcionSelector[];
    personas: Props['personas'];
    tipos: Props['tipos'];
    gravedades: Props['gravedades'];
    hoy: string;
    onCerrar: () => void;
}) {
    const inicial: { fecha: string; lugar: string; user_id: string; tipo: string; gravedad: Gravedad | ''; descripcion: string } = novedad
        ? {
              fecha: novedad.fecha,
              lugar: novedad.lugarClave,
              user_id: novedad.personaId ? String(novedad.personaId) : '',
              tipo: novedad.tipo,
              gravedad: novedad.gravedad,
              descripcion: novedad.descripcion,
          }
        : { fecha: hoy, lugar: lugares.length === 1 ? lugares[0].valor : '', user_id: '', tipo: '', gravedad: '', descripcion: '' };
    const form = useForm(inicial);
    const borrador = useBorrador(`novedades-${linea.slug}`, form);
    // El borrador de esta novedad (o de la nueva) se recupera al abrir
    useEffect(() => {
        borrador.abrir(novedad?.id ?? null, inicial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const delLugar = personas.filter((p) => form.data.lugar && p.lugares.includes(form.data.lugar));
    // Quien ya está en la novedad se conserva aunque hoy no tenga asignación allí
    const personasLugar =
        novedad?.personaId && novedad.persona && !delLugar.some((p) => p.id === novedad.personaId)
            ? [...delLugar, { id: novedad.personaId, nombre: novedad.persona, detalle: novedad.cedula ? `C.C. ${novedad.cedula}` : '', lugares: [] }]
            : delLugar;
    // Un tipo que ya no está en la lista también se conserva
    const opcionesTipo = tipos.some((t) => t.valor === form.data.tipo) || !form.data.tipo ? tipos : [...tipos, { valor: form.data.tipo, gravedad: form.data.gravedad || 'ninguna' }];

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        const opciones = {
            preserveScroll: true,
            onSuccess: () => {
                borrador.limpiar();
                onCerrar();
            },
        };
        if (novedad) form.put(route('novedades.update', novedad.id), opciones);
        else form.post(route('novedades.store', linea.slug), opciones);
    };

    return (
        <DialogoFormulario
            titulo={novedad ? 'Modificar la novedad' : 'Registrar una novedad'}
            descripcion={novedad ? 'Corrige lo que se registró. Su seguimiento no cambia.' : 'Queda abierta hasta que alguien le dé seguimiento y la cierre.'}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={novedad ? 'Guardar cambios' : 'Registrar'}
            textoCancelar="Volver"
        >
            {borrador.recuperado && (
                <p className="bg-secondary/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs">
                    Sigue lo que estabas escribiendo sin guardar.
                    <button type="button" onClick={borrador.descartar} className="text-primary focus-visible:ring-ring rounded-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden">
                        Empezar de nuevo
                    </button>
                </p>
            )}
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <Campo id="fecha" etiqueta="Fecha" requerido error={form.errors.fecha}>
                    <Input
                        {...propsCampo('fecha', form.errors.fecha)}
                        type="date"
                        max={hoy}
                        required
                        value={form.data.fecha}
                        onChange={(e) => form.setData('fecha', e.target.value)}
                        className="h-10 rounded-lg"
                    />
                </Campo>
                <Campo id="lugar" etiqueta="Dónde pasó" requerido error={form.errors.lugar}>
                    <Selector
                        {...propsCampo('lugar', form.errors.lugar)}
                        valor={form.data.lugar}
                        onCambio={(v) => form.setData((d) => ({ ...d, lugar: v, user_id: '' }))}
                        placeholder="Elige el lugar"
                        opciones={lugares}
                    />
                </Campo>
            </div>
            <Campo
                id="user_id"
                etiqueta="A quién le pasó"
                ayuda={
                    form.data.lugar
                        ? delLugar.length
                            ? 'Opcional: si la novedad es de una persona.'
                            : 'Nadie de la línea trabaja en este lugar.'
                        : 'Elige primero el lugar.'
                }
                error={form.errors.user_id}
            >
                <Selector
                    {...propsCampo('user_id', form.errors.user_id, 'user_id-ayuda')}
                    valor={form.data.user_id}
                    onCambio={(v) => form.setData('user_id', v)}
                    disabled={!form.data.lugar || personasLugar.length === 0}
                    opciones={[
                        { valor: '', texto: 'Ninguna persona en particular' },
                        ...personasLugar.map((p) => ({ valor: String(p.id), texto: p.nombre, detalle: p.detalle || undefined })),
                    ]}
                />
            </Campo>
            <Campo id="tipo" etiqueta="Tipo de novedad" requerido error={form.errors.tipo}>
                <Selector
                    {...propsCampo('tipo', form.errors.tipo)}
                    valor={form.data.tipo}
                    // La gravedad sugerida del tipo (se puede cambiar)
                    onCambio={(v) => form.setData((d) => ({ ...d, tipo: v, gravedad: tipos.find((t) => t.valor === v)?.gravedad ?? d.gravedad }))}
                    placeholder="Elige el tipo"
                    opciones={opcionesTipo.map((t) => ({ valor: t.valor, texto: t.valor }))}
                />
            </Campo>
            <OpcionesRadio
                id="gravedad"
                etiqueta="Gravedad"
                requerido
                valor={form.data.gravedad}
                onCambio={(v) => form.setData('gravedad', v)}
                error={form.errors.gravedad}
                opciones={gravedades.map((g) => ({ ...g, marca: GRAVEDAD[g.valor].marca }))}
            />
            <Campo id="descripcion" etiqueta="Qué pasó" requerido error={form.errors.descripcion}>
                <Textarea
                    {...propsCampo('descripcion', form.errors.descripcion)}
                    rows={4}
                    maxLength={2000}
                    required
                    value={form.data.descripcion}
                    onChange={(e) => form.setData('descripcion', e.target.value)}
                />
            </Campo>
        </DialogoFormulario>
    );
}

function DialogoSeguimiento({
    novedad,
    estados,
    tiposAccion,
    onCerrar,
}: {
    novedad: Novedad;
    estados: Props['estados'];
    tiposAccion: Props['tiposAccion'];
    onCerrar: () => void;
}) {
    const form = useForm<{ estado: Estado; seguimiento: string; accion: string; accion_descripcion: string }>({
        estado: novedad.estado === 'abierta' ? 'en_seguimiento' : novedad.estado,
        seguimiento: novedad.seguimiento ?? '',
        accion: '',
        accion_descripcion: '',
    });

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.patch(route('novedades.seguimiento', novedad.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={`Seguimiento: ${novedad.tipo}`}
            descripcion={`${fmt.fechaMedia(novedad.fecha)} · ${novedad.lugar}${novedad.persona ? ` · ${novedad.persona}` : ''}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar="Guardar"
        >
            <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm whitespace-pre-line">{novedad.descripcion}</p>
            <OpcionesRadio
                id="estado"
                etiqueta="Estado"
                requerido
                valor={form.data.estado}
                onCambio={(v) => form.setData('estado', v)}
                error={form.errors.estado}
                opciones={estados}
            />
            <Campo
                id="seguimiento"
                etiqueta="Seguimiento"
                requerido={form.data.estado === 'cerrada'}
                ayuda={form.data.estado === 'cerrada' ? 'Cómo se resolvió.' : 'Qué se ha hecho y qué falta.'}
                error={form.errors.seguimiento}
            >
                <Textarea
                    {...propsCampo('seguimiento', form.errors.seguimiento, 'seguimiento-ayuda')}
                    rows={3}
                    maxLength={2000}
                    value={form.data.seguimiento}
                    onChange={(e) => form.setData('seguimiento', e.target.value)}
                />
            </Campo>
            {novedad.personaId && (
                <div className="grid gap-4 rounded-xl border p-4">
                    {novedad.acciones.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                            Ya se registró: {novedad.acciones.map((a) => `${a.texto} (${fmt.fechaMedia(a.fecha)})`).join(', ')}.
                        </p>
                    )}
                    <Campo
                        id="accion"
                        etiqueta={`Acción de desempeño con ${novedad.persona}`}
                        ayuda="Opcional: queda en su seguimiento."
                        error={form.errors.accion}
                    >
                        <Selector
                            {...propsCampo('accion', form.errors.accion, 'accion-ayuda')}
                            valor={form.data.accion}
                            onCambio={(v) => form.setData('accion', v)}
                            opciones={[{ valor: '', texto: 'Ninguna por ahora' }, ...tiposAccion]}
                        />
                    </Campo>
                    {form.data.accion && (
                        <Campo id="accion_descripcion" etiqueta="Detalle de la acción" error={form.errors.accion_descripcion}>
                            <Textarea
                                {...propsCampo('accion_descripcion', form.errors.accion_descripcion)}
                                rows={2}
                                maxLength={500}
                                placeholder={`Por la novedad «${novedad.tipo}» del ${fmt.fechaMedia(novedad.fecha)}.`}
                                value={form.data.accion_descripcion}
                                onChange={(e) => form.setData('accion_descripcion', e.target.value)}
                            />
                        </Campo>
                    )}
                </div>
            )}
            {!novedad.personaId && (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    Sin una persona en la novedad, no se registra una acción de desempeño.
                </p>
            )}
        </DialogoFormulario>
    );
}
