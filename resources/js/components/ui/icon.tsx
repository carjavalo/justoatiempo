import { TipoIcono } from '@/components/iconos';

interface IconProps {
    iconNode?: TipoIcono | null;
    className?: string;
}

export function Icon({ iconNode: IconComponent, className }: IconProps) {
    if (!IconComponent) {
        return null;
    }

    return <IconComponent className={className} />;
}
