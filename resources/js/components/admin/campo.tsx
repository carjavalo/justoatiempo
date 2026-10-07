import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { type ReactNode } from 'react';

/**
 * Etiqueta, control, ayuda y error de un campo. El control usa propsCampo(id, error, ayuda && `${id}-ayuda`)
 * para quedar descrito por la ayuda y por el error.
 */
export function Campo({ id, etiqueta, requerido = false, ayuda, error, children }: { id: string; etiqueta: string; requerido?: boolean; ayuda?: ReactNode; error?: string; children: ReactNode }) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>
                {etiqueta}
                {requerido && <span aria-hidden="true"> *</span>}
            </Label>
            {children}
            {ayuda && (
                <p id={`${id}-ayuda`} className="text-muted-foreground text-xs">
                    {ayuda}
                </p>
            )}
            <InputError id={`${id}-error`} message={error} />
        </div>
    );
}
