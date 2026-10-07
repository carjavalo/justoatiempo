/**
 * Íconos de la plataforma (Phosphor), en tres estilos según su papel:
 * - Conceptos (personas, sedes, servicios, sectores…): duotono, con la capa de relleno en coral de la
 *   marca (ver `.icono-acento` en app.css). Es el sello visual de la app.
 * - Estados (bien, error, alerta, información): rellenos, para leerse de un vistazo.
 * - Controles pequeños (flechas, cerrar, agregar…): trazo grueso, nítido en 16 px.
 * Se conservan los nombres que usaba la app para no tocar cada pantalla; aquí se decide el dibujo.
 */
import {
    ArrowCounterClockwiseIcon,
    ArrowDownIcon,
    ArrowDownRightIcon,
    ArrowRightIcon,
    ArrowsDownUpIcon,
    ArrowsOutIcon,
    ArrowUpIcon,
    ArrowUpRightIcon,
    ArrowUUpLeftIcon,
    BankIcon,
    BinocularsIcon,
    BroomIcon,
    BuildingsIcon,
    CalendarBlankIcon,
    CalendarDotsIcon,
    CaretDownIcon,
    CaretLeftIcon,
    CaretRightIcon,
    CaretUpIcon,
    ChartPieSliceIcon,
    ChatCircleIcon,
    CheckCircleIcon,
    CheckIcon,
    CircleDashedIcon,
    CircleIcon,
    CircleNotchIcon,
    ClipboardTextIcon,
    ClockCountdownIcon,
    ClockIcon,
    CloudArrowUpIcon,
    DotsThreeIcon,
    DownloadSimpleIcon,
    EnvelopeSimpleIcon,
    EyeIcon,
    EyeSlashIcon,
    FactoryIcon,
    FilePlusIcon,
    FileTextIcon,
    FileXIcon,
    FileXlsIcon,
    FolderSimplePlusIcon,
    ForkKnifeIcon,
    GearIcon,
    GearSixIcon,
    GraduationCapIcon,
    HammerIcon,
    HardHatIcon,
    HeartbeatIcon,
    HouseLineIcon,
    type Icon as IconoPhosphor,
    type IconProps,
    type IconWeight,
    InfoIcon,
    KeyIcon,
    LightbulbIcon,
    LightningIcon,
    ListChecksIcon,
    ListIcon,
    LockIcon,
    LockKeyIcon,
    MagnifyingGlassIcon,
    MapPinAreaIcon,
    MapPinIcon,
    MapTrifoldIcon,
    MedalIcon,
    MinusIcon,
    MonitorIcon,
    MoonIcon,
    PackageIcon,
    PaintRollerIcon,
    PaperclipIcon,
    PencilSimpleIcon,
    PlantIcon,
    PlusIcon,
    ProhibitIcon,
    ScalesIcon,
    SealCheckIcon,
    ShieldCheckIcon,
    ShieldWarningIcon,
    ShippingContainerIcon,
    ShoppingBagIcon,
    SidebarSimpleIcon,
    SignInIcon,
    SignOutIcon,
    SlidersHorizontalIcon,
    SparkleIcon,
    SprayBottleIcon,
    SquaresFourIcon,
    StackIcon,
    StorefrontIcon,
    SunHorizonIcon,
    SunIcon,
    TargetIcon,
    ToggleLeftIcon,
    ToggleRightIcon,
    TrashIcon,
    TrayIcon,
    TreeEvergreenIcon,
    TruckIcon,
    TShirtIcon,
    UserCheckIcon,
    UserGearIcon,
    UserIcon,
    UsersIcon,
    WarehouseIcon,
    WarningIcon,
    XCircleIcon,
    XIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export type PropsIcono = Omit<IconProps, 'ref'> & {
    /** Compatibilidad: un trazo fino (≤1.25) usa el peso ligero; uno grueso (≥2.5), el negrita. */
    strokeWidth?: number;
};

export type TipoIcono = React.ForwardRefExoticComponent<PropsIcono & React.RefAttributes<SVGSVGElement>>;

type Papel = 'concepto' | 'estado' | 'control';
const PESO: Record<Papel, IconWeight> = { concepto: 'duotone', estado: 'fill', control: 'bold' };

function icono(Base: IconoPhosphor, papel: Papel, nombre: string): TipoIcono {
    const Componente = forwardRef<SVGSVGElement, PropsIcono>(({ className, strokeWidth, weight, size = 24, ...props }, ref) => {
        const peso = weight ?? (strokeWidth !== undefined && strokeWidth <= 1.25 ? 'light' : strokeWidth !== undefined && strokeWidth >= 2.5 ? 'bold' : PESO[papel]);
        // El tamaño real lo da la clase (size-4, size-5…); 24 solo aplica si no hay clase
        return <Base ref={ref} weight={peso} size={size} className={cn('icono shrink-0', peso === 'duotone' && 'icono-acento', className)} {...props} />;
    });
    Componente.displayName = nombre;
    return Componente;
}

// --- Conceptos (duotono con acento coral) ---
export const Award = icono(MedalIcon, 'concepto', 'Award');
export const BadgeCheck = icono(SealCheckIcon, 'concepto', 'BadgeCheck');
export const Building2 = icono(BuildingsIcon, 'concepto', 'Building2');
export const CalendarClock = icono(CalendarDotsIcon, 'concepto', 'CalendarClock');
export const CalendarDays = icono(CalendarBlankIcon, 'concepto', 'CalendarDays');
export const CalendarRange = icono(SlidersHorizontalIcon, 'concepto', 'CalendarRange');
export const ClipboardCheck = icono(ClipboardTextIcon, 'concepto', 'ClipboardCheck');
export const Clock3 = icono(ClockIcon, 'concepto', 'Clock3');
export const Cog = icono(GearIcon, 'concepto', 'Cog');
export const Factory = icono(FactoryIcon, 'concepto', 'Factory');
export const FileSpreadsheet = icono(FileXlsIcon, 'concepto', 'FileSpreadsheet');
export const FileText = icono(FileTextIcon, 'concepto', 'FileText');
export const FileX2 = icono(FileXIcon, 'concepto', 'FileX2');
export const FolderUp = icono(FolderSimplePlusIcon, 'concepto', 'FolderUp');
export const GraduationCap = icono(GraduationCapIcon, 'concepto', 'GraduationCap');
export const Hammer = icono(HammerIcon, 'concepto', 'Hammer');
export const HardHat = icono(HardHatIcon, 'concepto', 'HardHat');
export const HeartPulse = icono(HeartbeatIcon, 'concepto', 'HeartPulse');
export const ImagePlus = icono(FilePlusIcon, 'concepto', 'ImagePlus');
export const KeyRound = icono(KeyIcon, 'concepto', 'KeyRound');
export const Landmark = icono(BankIcon, 'concepto', 'Landmark');
export const Layers = icono(StackIcon, 'concepto', 'Layers');
export const LayoutGrid = icono(SquaresFourIcon, 'concepto', 'LayoutGrid');
export const Lightbulb = icono(LightbulbIcon, 'concepto', 'Lightbulb');
export const Lock = icono(LockIcon, 'concepto', 'Lock');
export const LockKeyhole = icono(LockKeyIcon, 'concepto', 'LockKeyhole');
export const Mail = icono(EnvelopeSimpleIcon, 'concepto', 'Mail');
export const Map = icono(MapTrifoldIcon, 'concepto', 'Map');
export const MapPin = icono(MapPinIcon, 'concepto', 'MapPin');
export const MapPinned = icono(MapPinAreaIcon, 'concepto', 'MapPinned');
export const MessageCircle = icono(ChatCircleIcon, 'estado', 'MessageCircle');
export const Monitor = icono(MonitorIcon, 'control', 'Monitor');
export const Moon = icono(MoonIcon, 'control', 'Moon');
export const PackageCheck = icono(PackageIcon, 'concepto', 'PackageCheck');
export const PackageOpen = icono(ShippingContainerIcon, 'concepto', 'PackageOpen');
export const PackageSearch = icono(TrayIcon, 'concepto', 'PackageSearch');
export const PackageX = icono(ArrowUUpLeftIcon, 'concepto', 'PackageX');
export const Scale = icono(ScalesIcon, 'concepto', 'Scale');
export const Settings = icono(GearSixIcon, 'control', 'Settings');
export const ShieldCheck = icono(ShieldCheckIcon, 'concepto', 'ShieldCheck');
export const Shirt = icono(TShirtIcon, 'concepto', 'Shirt');
export const ShoppingBag = icono(ShoppingBagIcon, 'concepto', 'ShoppingBag');
export const Sparkles = icono(SparkleIcon, 'concepto', 'Sparkles');
export const SprayCan = icono(SprayBottleIcon, 'concepto', 'SprayCan');
export const Sprout = icono(PlantIcon, 'concepto', 'Sprout');
export const Store = icono(StorefrontIcon, 'concepto', 'Store');
export const Sun = icono(SunIcon, 'control', 'Sun');
export const Target = icono(TargetIcon, 'concepto', 'Target');
export const Telescope = icono(BinocularsIcon, 'concepto', 'Telescope');
export const TreePine = icono(TreeEvergreenIcon, 'concepto', 'TreePine');
export const Truck = icono(TruckIcon, 'concepto', 'Truck');
export const UploadCloud = icono(CloudArrowUpIcon, 'concepto', 'UploadCloud');
export const UserCheck = icono(UserCheckIcon, 'concepto', 'UserCheck');
export const UserRound = icono(UserIcon, 'concepto', 'UserRound');
export const UsersRound = icono(UsersIcon, 'concepto', 'UsersRound');
export const UtensilsCrossed = icono(ForkKnifeIcon, 'concepto', 'UtensilsCrossed');
export const Warehouse = icono(WarehouseIcon, 'concepto', 'Warehouse');
export const Zap = icono(LightningIcon, 'concepto', 'Zap');

// Conceptos con dibujo propio en la página principal y el panel (ningún dibujo se repite entre secciones)
export const AseoIndustrial = icono(BroomIcon, 'concepto', 'AseoIndustrial');
export const AseoConstruccion = icono(PaintRollerIcon, 'concepto', 'AseoConstruccion');
export const ApoyoPlantas = icono(UserGearIcon, 'concepto', 'ApoyoPlantas');
export const ServicioLogistico = icono(PackageIcon, 'concepto', 'ServicioLogistico');
export const Sectores = icono(ChartPieSliceIcon, 'concepto', 'Sectores');
export const ConjuntoResidencial = icono(HouseLineIcon, 'concepto', 'ConjuntoResidencial');
export const Vision = icono(SunHorizonIcon, 'concepto', 'Vision');
export const ListaChequeo = icono(ListChecksIcon, 'concepto', 'ListaChequeo');
/** Estados de desempeño y de carga: rellenos, como los demás estados. */
export const Felicitacion = icono(MedalIcon, 'estado', 'Felicitacion');
export const EnRevision = icono(ClockCountdownIcon, 'estado', 'EnRevision');
export const SinArchivos = icono(FileXIcon, 'estado', 'SinArchivos');

// --- Estados (rellenos) ---
export const AlertTriangle = icono(WarningIcon, 'estado', 'AlertTriangle');
export const CheckCircle2 = icono(CheckCircleIcon, 'estado', 'CheckCircle2');
export const Info = icono(InfoIcon, 'estado', 'Info');
export const ShieldAlert = icono(ShieldWarningIcon, 'estado', 'ShieldAlert');
export const XCircle = icono(XCircleIcon, 'estado', 'XCircle');

// --- Controles (trazo grueso) ---
export const ArrowDown = icono(ArrowDownIcon, 'control', 'ArrowDown');
export const ArrowDownRight = icono(ArrowDownRightIcon, 'control', 'ArrowDownRight');
export const ArrowRight = icono(ArrowRightIcon, 'control', 'ArrowRight');
export const ArrowUp = icono(ArrowUpIcon, 'control', 'ArrowUp');
export const ArrowUpDown = icono(ArrowsDownUpIcon, 'control', 'ArrowUpDown');
export const ArrowUpRight = icono(ArrowUpRightIcon, 'control', 'ArrowUpRight');
export const Ban = icono(ProhibitIcon, 'control', 'Ban');
export const Check = icono(CheckIcon, 'control', 'Check');
export const ChevronDown = icono(CaretDownIcon, 'control', 'ChevronDown');
export const ChevronLeft = icono(CaretLeftIcon, 'control', 'ChevronLeft');
export const ChevronRight = icono(CaretRightIcon, 'control', 'ChevronRight');
export const ChevronUp = icono(CaretUpIcon, 'control', 'ChevronUp');
export const Circle = icono(CircleIcon, 'control', 'Circle');
export const CircleDashed = icono(CircleDashedIcon, 'control', 'CircleDashed');
export const Download = icono(DownloadSimpleIcon, 'control', 'Download');
export const Expand = icono(ArrowsOutIcon, 'control', 'Expand');
export const Eye = icono(EyeIcon, 'control', 'Eye');
export const EyeOff = icono(EyeSlashIcon, 'control', 'EyeOff');
export const LoaderCircle = icono(CircleNotchIcon, 'control', 'LoaderCircle');
export const LogIn = icono(SignInIcon, 'control', 'LogIn');
export const LogOut = icono(SignOutIcon, 'control', 'LogOut');
export const Menu = icono(ListIcon, 'control', 'Menu');
export const Minus = icono(MinusIcon, 'control', 'Minus');
export const MoreHorizontal = icono(DotsThreeIcon, 'control', 'MoreHorizontal');
export const PanelLeft = icono(SidebarSimpleIcon, 'control', 'PanelLeft');
export const Paperclip = icono(PaperclipIcon, 'control', 'Paperclip');
export const Pencil = icono(PencilSimpleIcon, 'control', 'Pencil');
export const Plus = icono(PlusIcon, 'control', 'Plus');
export const Power = icono(ToggleRightIcon, 'control', 'Power');
export const PowerOff = icono(ToggleLeftIcon, 'control', 'PowerOff');
export const Search = icono(MagnifyingGlassIcon, 'control', 'Search');
export const Trash2 = icono(TrashIcon, 'control', 'Trash2');
export const Undo2 = icono(ArrowCounterClockwiseIcon, 'control', 'Undo2');
export const X = icono(XIcon, 'control', 'X');
