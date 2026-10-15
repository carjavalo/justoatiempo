import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';
import { type Volver } from '@/types';

export default function AuthLayout({ children, title, description, volver }: { children: React.ReactNode; title: string; description: string; volver?: Volver }) {
    return (
        <AuthLayoutTemplate title={title} description={description} volver={volver}>
            {children}
        </AuthLayoutTemplate>
    );
}
