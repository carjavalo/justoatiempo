/**
 * Íconos de la plataforma (Phosphor), en tres estilos según su papel:
 * - Conceptos (personas, sedes, servicios, sectores…): duotono, con la capa de relleno en coral de la
 *   marca (ver `.icono-acento` en app.css). Es el sello visual de la app.
 * - Estados (bien, error, alerta, información): rellenos, para leerse de un vistazo.
 * - Controles pequeños (flechas, cerrar, agregar…): trazo grueso, nítido en 16 px.
 * Se conservan los nombres que usaba la app para no tocar cada pantalla; aquí se decide el dibujo.
 *
 * Cada ícono vive en su propio archivo: una pantalla solo descarga los que usa (un barril con todos
 * juntos hacía bajar todos los dibujos, con sus seis grosores, hasta en el inicio de sesión).
 * Para agregar uno: su archivo (copia de cualquiera) y su línea aquí.
 */
export type { PropsIcono, TipoIcono } from './crear';

// --- Conceptos (duotono con acento coral) ---
export { Award } from './award';
export { BadgeCheck } from './badge-check';
export { Building2 } from './building2';
export { CalendarClock } from './calendar-clock';
export { CalendarDays } from './calendar-days';
export { CalendarRange } from './calendar-range';
export { ClipboardCheck } from './clipboard-check';
export { Clock3 } from './clock3';
export { Cog } from './cog';
export { Factory } from './factory';
export { FileSpreadsheet } from './file-spreadsheet';
export { FileText } from './file-text';
export { FileX2 } from './file-x2';
export { FolderUp } from './folder-up';
export { GraduationCap } from './graduation-cap';
export { Hammer } from './hammer';
export { HardHat } from './hard-hat';
export { HeartPulse } from './heart-pulse';
export { IdCard } from './id-card';
export { ImagePlus } from './image-plus';
export { Inicio } from './inicio';
export { KeyRound } from './key-round';
export { Landmark } from './landmark';
export { Layers } from './layers';
export { LayoutGrid } from './layout-grid';
export { Lightbulb } from './lightbulb';
export { Lock } from './lock';
export { LockKeyhole } from './lock-keyhole';
export { Mail } from './mail';
export { Map } from './map';
export { MapPin } from './map-pin';
export { MapPinned } from './map-pinned';
export { MessageCircle } from './message-circle';
export { Monitor } from './monitor';
export { Moon } from './moon';
export { PackageCheck } from './package-check';
export { PackageOpen } from './package-open';
export { PackageSearch } from './package-search';
export { PackageX } from './package-x';
export { Phone } from './phone';
export { Scale } from './scale';
export { Settings } from './settings';
export { ShieldCheck } from './shield-check';
export { Shirt } from './shirt';
export { ShoppingBag } from './shopping-bag';
export { Sparkles } from './sparkles';
export { SprayCan } from './spray-can';
export { Sprout } from './sprout';
export { Store } from './store';
export { Sun } from './sun';
export { Target } from './target';
export { Telescope } from './telescope';
export { TreePine } from './tree-pine';
export { Truck } from './truck';
export { UploadCloud } from './upload-cloud';
export { UserCheck } from './user-check';
export { UserRound } from './user-round';
export { UsersRound } from './users-round';
export { UtensilsCrossed } from './utensils-crossed';
export { Warehouse } from './warehouse';
export { WhatsApp } from './whatsapp';
export { Zap } from './zap';

// Conceptos con dibujo propio en la página principal y el panel (ningún dibujo se repite entre secciones)
export { ApoyoPlantas } from './apoyo-plantas';
export { AseoConstruccion } from './aseo-construccion';
export { AseoIndustrial } from './aseo-industrial';
/** Solicitudes de cotización que llegan desde el sitio web. */
export { Bandeja } from './bandeja';
export { ConjuntoResidencial } from './conjunto-residencial';
export { ListaChequeo } from './lista-chequeo';
export { Sectores } from './sectores';
export { ServicioLogistico } from './servicio-logistico';
export { Vision } from './vision';
/** Estados de desempeño y de carga: rellenos, como los demás estados. */
export { EnRevision } from './en-revision';
export { Felicitacion } from './felicitacion';
export { SinArchivos } from './sin-archivos';

// --- Estados (rellenos) ---
export { AlertTriangle } from './alert-triangle';
export { CheckCircle2 } from './check-circle2';
export { Info } from './info';
export { ShieldAlert } from './shield-alert';
export { XCircle } from './xcircle';

// --- Controles (trazo grueso) ---
export { ArrowDown } from './arrow-down';
export { At } from './at';
export { ArrowDownRight } from './arrow-down-right';
export { ArrowLeft } from './arrow-left';
export { ArrowRight } from './arrow-right';
export { ArrowUp } from './arrow-up';
export { ArrowUpDown } from './arrow-up-down';
export { ArrowUpRight } from './arrow-up-right';
export { Ban } from './ban';
export { Check } from './check';
export { ChevronDown } from './chevron-down';
export { ChevronLeft } from './chevron-left';
export { ChevronRight } from './chevron-right';
export { ChevronUp } from './chevron-up';
export { Circle } from './circle';
export { CircleDashed } from './circle-dashed';
export { Download } from './download';
export { Expand } from './expand';
export { Eye } from './eye';
export { EyeOff } from './eye-off';
export { LoaderCircle } from './loader-circle';
export { LogIn } from './log-in';
export { LogOut } from './log-out';
export { Menu } from './menu';
export { Minus } from './minus';
export { MoreHorizontal } from './more-horizontal';
export { PanelLeft } from './panel-left';
export { Paperclip } from './paperclip';
export { Pencil } from './pencil';
export { Plus } from './plus';
export { Power } from './power';
export { PowerOff } from './power-off';
export { Search } from './search';
export { Trash2 } from './trash2';
export { Undo2 } from './undo2';
export { X } from './x';
