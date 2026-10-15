import AppLayoutTemplate from '@/layouts/app/app-header-layout';
import { type Volver } from '@/types';

interface AppLayoutProps {
    children: React.ReactNode;
    /**
     * A dónde lleva "Volver". Si no se indica, al inicio de quien navega (el panel o su línea);
     * `false` lo oculta (p. ej. en las pestañas de la línea que ya es su inicio).
     */
    volver?: Volver | false;
}

export default ({ children, volver }: AppLayoutProps) => <AppLayoutTemplate volver={volver}>{children}</AppLayoutTemplate>;
