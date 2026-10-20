import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Si quien navega puede hacer algo ("usuarios.crear", "cargas.subir"…), según los permisos de su rol. Las
 * pantallas solo muestran lo que puede hacer; el servidor lo vuelve a revisar en cada acción.
 */
export function usePuede() {
    const { auth } = usePage<SharedData>().props;
    return (permiso: string) => auth.permisos.includes(permiso);
}
