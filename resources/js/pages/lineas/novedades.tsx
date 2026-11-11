import { ConfirmarEliminar } from '@/components/admin/acciones';
import { Campo } from '@/components/admin/campo';
import { CampoBusqueda, FiltroLista, useFiltros } from '@/components/admin/filtros';
import { OpcionesRadio } from '@/components/admin/opciones-radio';
import { Paginacion, SinResultados } from '@/components/admin/piezas';
import { DialogoFormulario } from '@/components/dialogo-formulario';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    CircleDashed,
    EnRevision,
    Felicitacion,
    MoreHorizontal,
    Pencil,
    Plus,
    type TipoIcono,
    Trash2,
    X,
    XCircle,
} from '@/components/iconos';
import { fechaDia } from '@/components/linea/dia';
import { MarcoLinea } from '@/components/linea/marco-linea';
import { type OpcionSelector, Selector } from '@/components/selector';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBorrador } from '@/hooks/use-borrador';
import { usePuede } from '@/hooks/use-puede';
import { aFecha, fmt, haceCuanto } from '@/lib/formato';
import { propsCampo } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { type Paginado } from '@/types';
import { router, useForm } from '@inertiajs/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

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
    /** Cuántas hay en cada estado con el lugar y la búsqueda elegidos (cuadran con la lista). */
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

/**
 * La gravedad es lo único que lleva color (con su dibujo y su texto): una novedad sin falta, como una felicitación del
 * cliente, se ve en verde aunque siga abierta. El punto acompaña a la gravedad en el formulario.
 */
const GRAVEDAD: Record<Gravedad, { icono: TipoIcono; caja: string; texto: string; marca: string }> = {
    grave: { icono: XCircle, caja: 'bg-critical-soft text-critical', texto: 'text-critical', marca: 'bg-critical' },
    leve: { icono: AlertTriangle, caja: 'bg-warning-soft text-warning', texto: 'text-warning', marca: 'bg-warning' },
    ninguna: { icono: CheckCircle2, caja: 'bg-good-soft text-good', texto: 'text-good', marca: 'bg-good' },
};

/** El estado, en texto neutro con su dibujo: no compite con la gravedad. */
const ESTADO: Record<Estado, TipoIcono> = { abierta: CircleDashed, en_seguimiento: EnRevision, cerrada: CheckCircle2 };

const FELICITACION = 'Felicitación del cliente';

/** Cuánto hace que pasó: "hoy", "ayer" o "hace 3 días" (frente al hoy del servidor). */
function hace(fecha: string, hoy: string) {
    const dias = Math.round((aFecha(hoy).getTime() - aFecha(fecha).getTime()) / 86_400_000);
    return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${fmt.numero(dias)} días`;
}

/**
 * Novedades y seguimiento de una línea: lo que pasa en la operación de cada lugar, con quién le da seguimiento hasta
 * cerrarla y la acción de desempeño que se toma con la persona, si hay una. Las que siguen sin cerrar van por atender:
 * primero las graves y, en cada gravedad, la que más lleva abierta.
 */
export default function Novedades({ linea, novedades, filtros, conteo, lugares, personas, tipos, gravedades, estados, tiposAccion, hoy }: Props) {
    const puede = usePuede();
    const { valores, cambiar, limpiar } = useFiltros(route('novedades.index', linea.slug), filtros);
    const [registrando, setRegistrando] = useState(false);
    const [siguiendo, setSiguiendo] = useState<Novedad | null>(null);
    const [corrigiendo, setCorrigiendo] = useState<Novedad | null>(null);
    const [eliminando, setEliminando] = useState<Novedad | null>(null);
    const lista = useRef<HTMLUListElement>(null);
    const textoGravedad = (g: Gravedad) => gravedades.find((x) => x.valor === g)?.texto ?? g;
    const textoEstado = (e: Estado) => estados.find((x) => x.valor === e)?.texto ?? e;
    // El estado tiene su propio control: "Quitar filtros" deja el estado y quita la búsqueda y el lugar
    const buscando = valores.q !== '' || valores.lugar !== '';

    const segmentos: { valor: string; texto: string; total: number }[] = [
        { valor: '', texto: 'Sin cerrar', total: conteo.abierta + conteo.en_seguimiento },
        { valor: 'abierta', texto: 'Abiertas', total: conteo.abierta },
        { valor: 'en_seguimiento', texto: 'En seguimiento', total: conteo.en_seguimiento },
        { valor: 'cerrada', texto: 'Cerradas', total: conteo.cerrada },
    ];
    const vacio = buscando
        ? 'Ninguna novedad coincide con la búsqueda.'
        : valores.estado === ''
          ? 'Todo al día: ninguna novedad sin cerrar.'
          : `No hay novedades ${segmentos.find((s) => s.valor === valores.estado)?.texto.toLowerCase()}.`;

    // Una sin falta se cierra de un toque, sin contar cómo se resolvió (no hubo nada que resolver)
    const cerrar = (n: Novedad) =>
        router.patch(
            route('novedades.seguimiento', n.id),
            { estado: 'cerrada', seguimiento: n.seguimiento ?? '' },
            {
                preserveScroll: true,
                preserveState: true,
                // Cerrada, sale de la lista: el foco queda en ella y no se pierde
                onSuccess: () => requestAnimationFrame(() => document.activeElement === document.body && lista.current?.focus()),
            },
        );

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
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                {/* Los estados con cuántas hay en cada uno, a la vista (el total no se repite debajo) */}
                <div
                    role="group"
                    aria-label="Estado de las novedades"
                    className="bg-muted flex shrink-0 gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
                >
                    {segmentos.map((s) => {
                        const elegido = valores.estado === s.valor;
                        return (
                            <button
                                key={s.valor || 'sin-cerrar'}
                                type="button"
                                aria-pressed={elegido}
                                onClick={() => !elegido && cambiar('estado', s.valor)}
                                className={cn(
                                    'focus-visible:ring-ring flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:outline-hidden',
                                    elegido
                                        ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {s.texto}{' '}
                                <span className={cn('tabular-nums', elegido ? 'text-foreground' : 'text-muted-foreground')}>
                                    {fmt.numero(s.total)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div role="search" className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
                    <CampoBusqueda
                        id="buscar-novedades"
                        etiqueta="Buscar novedades"
                        placeholder="Buscar por persona, cédula, tipo o lo que pasó"
                        valor={valores.q}
                        onCambio={(v) => cambiar('q', v, { inmediato: false })}
                    />
                    {lugares.length > 1 && (
                        <FiltroLista
                            id="filtro-lugar"
                            etiqueta="Lugar"
                            valor={valores.lugar}
                            onCambio={(v) => cambiar('lugar', v)}
                            className="sm:w-60"
                            opciones={[{ valor: '', texto: 'Todos los lugares' }, ...lugares]}
                        />
                    )}
                    {buscando && (
                        <button
                            type="button"
                            onClick={() => {
                                document.getElementById('buscar-novedades')?.focus();
                                limpiar(['estado']);
                            }}
                            className="text-primary focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 self-start rounded-md text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden sm:self-center"
                        >
                            <X className="size-4" aria-hidden="true" />
                            Quitar filtros
                        </button>
                    )}
                </div>
            </div>
            {/* Se anuncia al cambiar los filtros; a la vista ya están los conteos */}
            <p role="status" className="sr-only">
                {novedades.total ? plural(novedades.total) : vacio}
            </p>

            {novedades.data.length === 0 ? (
                <SinResultados texto={vacio} />
            ) : (
                <ul
                    ref={lista}
                    role="list"
                    aria-label="Novedades"
                    tabIndex={-1}
                    className="bg-card divide-y overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-hidden"
                >
                    {novedades.data.map((n) => (
                        <FilaNovedad
                            key={n.id}
                            novedad={n}
                            hoy={hoy}
                            textoGravedad={textoGravedad(n.gravedad)}
                            textoEstado={textoEstado(n.estado)}
                            puedeCerrar={puede('novedades.cerrar')}
                            puedeEditar={puede('novedades.registrar')}
                            puedeEliminar={puede('novedades.eliminar')}
                            onSeguimiento={() => setSiguiendo(n)}
                            onCerrar={() => cerrar(n)}
                            onEditar={() => setCorrigiendo(n)}
                            onEliminar={() => setEliminando(n)}
                        />
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
                    consecuencia="Para una novedad registrada por error: deja de verse. No se borra: queda en el historial. Si ya se resolvió, mejor ciérrala: así queda en el informe de la jornada."
                    onCerrar={() => setEliminando(null)}
                />
            )}
            {siguiendo && <DialogoSeguimiento novedad={siguiendo} estados={estados} tiposAccion={tiposAccion} onCerrar={() => setSiguiendo(null)} />}
        </MarcoLinea>
    );
}

const plural = (n: number) => `${fmt.numero(n)} ${n === 1 ? 'novedad' : 'novedades'}`;

/**
 * Una novedad: su gravedad a la izquierda (dibujo y color), qué pasó, y su estado y quién la registró al pie. A la vista,
 * solo la acción que sigue (dar seguimiento; cerrar, si no fue una falta; ver o reabrir, si ya se cerró); editar y
 * eliminar, en "Más acciones".
 */
function FilaNovedad({
    novedad: n,
    hoy,
    textoGravedad,
    textoEstado,
    puedeCerrar,
    puedeEditar,
    puedeEliminar,
    onSeguimiento,
    onCerrar,
    onEditar,
    onEliminar,
}: {
    novedad: Novedad;
    hoy: string;
    textoGravedad: string;
    textoEstado: string;
    puedeCerrar: boolean;
    puedeEditar: boolean;
    puedeEliminar: boolean;
    onSeguimiento: () => void;
    onCerrar: () => void;
    onEditar: () => void;
    onEliminar: () => void;
}) {
    const cerrada = n.estado === 'cerrada';
    const sinFalta = n.gravedad === 'ninguna';
    const gravedad = GRAVEDAD[n.gravedad];
    const Icono = n.tipo === FELICITACION ? Felicitacion : gravedad.icono;
    const IconoEstado = ESTADO[n.estado];
    const deCual = ` la novedad ${n.tipo} del ${fechaDia(n.fecha)}`;
    // Lo que no es la acción principal; sin nada, no hay menú
    const masDarSeguimiento = puedeCerrar && !cerrada && sinFalta;
    const masEditar = puedeEditar && !cerrada;
    const conMenu = masDarSeguimiento || masEditar || puedeEliminar;

    return (
        <li className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            {/* Resuelta, su gravedad ya no llama la atención */}
            <span
                className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                    cerrada ? 'bg-muted text-muted-foreground' : gravedad.caja,
                )}
            >
                <Icono className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                        <h3 className="leading-snug font-bold text-balance">{n.tipo}</h3>
                        <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                            <span className={cn('font-semibold', cerrada ? 'text-foreground' : gravedad.texto)}>{textoGravedad}</span>
                            {' · '}
                            <span className="first-letter:uppercase">{fechaDia(n.fecha)}</span>
                            {!cerrada && `, ${hace(n.fecha, hoy)}`}
                            {' · '}
                            {n.lugar}
                            {n.persona && (
                                <>
                                    {' · '}
                                    <span className="text-foreground font-semibold">{n.persona}</span>
                                    {n.cedula && ` (C.C. ${n.cedula})`}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        {puedeCerrar &&
                            (cerrada ? (
                                <Button variant="outline" className="h-9 rounded-lg text-xs font-semibold" onClick={onSeguimiento}>
                                    Ver o reabrir
                                    <span className="sr-only">{deCual}</span>
                                </Button>
                            ) : sinFalta ? (
                                <Button variant="outline" className="h-9 rounded-lg text-xs font-semibold" onClick={onCerrar}>
                                    <Check className="size-4" aria-hidden="true" />
                                    Cerrar
                                    <span className="sr-only">{deCual}</span>
                                </Button>
                            ) : (
                                <Button variant="outline" className="h-9 rounded-lg text-xs font-semibold" onClick={onSeguimiento}>
                                    Dar seguimiento
                                    <span className="sr-only"> a{deCual}</span>
                                </Button>
                            ))}
                        {conMenu && (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-9 rounded-lg">
                                        <MoreHorizontal className="size-5" aria-hidden="true" />
                                        <span className="sr-only">Más acciones para{deCual}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-44">
                                    {masDarSeguimiento && (
                                        <DropdownMenuItem onSelect={onSeguimiento} className="gap-2">
                                            <EnRevision className="size-4" aria-hidden="true" />
                                            Dar seguimiento
                                        </DropdownMenuItem>
                                    )}
                                    {masEditar && (
                                        <DropdownMenuItem onSelect={onEditar} className="gap-2">
                                            <Pencil className="size-4" aria-hidden="true" />
                                            Editar
                                        </DropdownMenuItem>
                                    )}
                                    {puedeEliminar && (
                                        <DropdownMenuItem onSelect={onEliminar} className="text-critical focus:text-critical gap-2">
                                            <Trash2 className="size-4" aria-hidden="true" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{n.descripcion}</p>
                {n.seguimiento && (
                    <p className="bg-muted/50 mt-2 rounded-lg px-3 py-2 text-sm whitespace-pre-line">
                        <span className="font-semibold">Seguimiento: </span>
                        {n.seguimiento}
                    </p>
                )}
                {n.acciones.length > 0 && (
                    <p className="mt-2 text-sm">
                        <span className="font-semibold">Acción con {n.persona ?? 'la persona'}: </span>
                        {n.acciones.map((a) => a.texto).join(', ')}
                    </p>
                )}
                <p className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    <span className="text-foreground inline-flex items-center gap-1 font-semibold">
                        <IconoEstado className="size-3.5 shrink-0" aria-hidden="true" />
                        {textoEstado}
                    </span>
                    {cerrada && n.cerradaEn && (
                        <span>
                            {n.cerradaPor ? `por ${n.cerradaPor} ` : ''}
                            <time dateTime={n.cerradaEn} title={new Date(n.cerradaEn).toLocaleString('es-CO')}>
                                {haceCuanto(n.cerradaEn)}
                            </time>
                        </span>
                    )}
                    {n.registradaEn && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>
                                Registrada {n.registradaPor ? `por ${n.registradaPor} ` : ''}
                                <time dateTime={n.registradaEn} title={new Date(n.registradaEn).toLocaleString('es-CO')}>
                                    {haceCuanto(n.registradaEn)}
                                </time>
                            </span>
                        </>
                    )}
                </p>
            </div>
        </li>
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
    const opcionesTipo =
        tipos.some((t) => t.valor === form.data.tipo) || !form.data.tipo
            ? tipos
            : [...tipos, { valor: form.data.tipo, gravedad: form.data.gravedad || 'ninguna' }];

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
            titulo={novedad ? 'Editar la novedad' : 'Registrar una novedad'}
            descripcion={
                novedad ? 'Corrige lo que se registró. Su seguimiento no cambia.' : 'Queda abierta hasta que alguien le dé seguimiento y la cierre.'
            }
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={novedad ? 'Guardar cambios' : 'Registrar'}
        >
            {borrador.recuperado && (
                <p className="bg-secondary/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs">
                    Sigue lo que estabas escribiendo sin guardar.
                    <button
                        type="button"
                        onClick={borrador.descartar}
                        className="text-primary focus-visible:ring-ring rounded-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                    >
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
    // Para cerrarla hay que contar cómo se resolvió, salvo que no haya sido una falta
    const pideCierre = form.data.estado === 'cerrada' && novedad.gravedad !== 'ninguna';

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        if (form.processing) return;
        form.patch(route('novedades.seguimiento', novedad.id), { preserveScroll: true, onSuccess: onCerrar });
    };

    return (
        <DialogoFormulario
            titulo={`Seguimiento: ${novedad.tipo}`}
            descripcion={`${fechaDia(novedad.fecha)} · ${novedad.lugar}${novedad.persona ? ` · ${novedad.persona}` : ''}`}
            onCerrar={onCerrar}
            onEnviar={enviar}
            procesando={form.processing}
            textoEnviar={
                form.data.estado === 'cerrada'
                    ? novedad.estado === 'cerrada'
                        ? 'Guardar'
                        : 'Cerrar la novedad'
                    : novedad.estado === 'cerrada'
                      ? 'Reabrir'
                      : 'Guardar seguimiento'
            }
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
                requerido={pideCierre}
                ayuda={
                    form.data.estado !== 'cerrada' ? 'Qué se ha hecho y qué falta.' : pideCierre ? 'Cómo se resolvió.' : 'Opcional: no fue una falta.'
                }
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
                            Ya se registró: {novedad.acciones.map((a) => `${a.texto} (${fechaDia(a.fecha)})`).join(', ')}.
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
                                placeholder={`Por la novedad «${novedad.tipo}» del ${fechaDia(novedad.fecha)}.`}
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
