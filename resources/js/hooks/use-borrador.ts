import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Lo que se estaba escribiendo sin guardar, por persona, módulo y registro: al volver atrás (o ir a otra pantalla y
 * regresar), el formulario sigue como estaba. Va en memoria a propósito: no se escribe en el navegador porque lleva
 * cédulas y teléfonos, y se pierde al recargar la página.
 */
const borradores = new Map<string, Partial<unknown>>();

interface Formulario<T> {
    data: T;
    setData: (datos: T) => void;
}

/** @param sinGuardar lo que no se recuerda: contraseñas y archivos, que se vuelven a escribir o a elegir. */
export function useBorrador<T extends object>(modulo: string, form: Formulario<T>, sinGuardar: (keyof T)[] = []) {
    const usuario = usePage<SharedData>().props.auth?.user?.id;
    const clave = useRef<string | null>(null);
    const inicial = useRef<T | null>(null);
    const [recuperado, setRecuperado] = useState(false);

    const recordable = (datos: T): Partial<T> => Object.fromEntries(Object.entries(datos).filter(([k]) => !sinGuardar.includes(k as keyof T))) as Partial<T>;

    useEffect(() => {
        if (!clave.current || !inicial.current) return;
        const actual = recordable(form.data);
        if (JSON.stringify(actual) === JSON.stringify(recordable(inicial.current))) borradores.delete(clave.current);
        else borradores.set(clave.current, actual);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.data]);

    return {
        /** Si el formulario abrió con lo que se había escrito antes. */
        recuperado,
        /** Abre el formulario de un registro (null: uno nuevo) con lo que se estaba escribiendo o, si no hay nada, con sus datos. */
        abrir(id: number | string | null, datos: T): boolean {
            clave.current = `${usuario}:${modulo}:${id ?? 'nuevo'}`;
            inicial.current = datos;
            const guardado = borradores.get(clave.current) as Partial<T> | undefined;
            setRecuperado(Boolean(guardado));
            form.setData(guardado ? { ...datos, ...guardado } : datos);
            return Boolean(guardado);
        },
        /** Empieza de nuevo: vuelve a los datos del registro. */
        descartar() {
            if (clave.current) borradores.delete(clave.current);
            setRecuperado(false);
            if (inicial.current) form.setData(inicial.current);
        },
        /** Ya se guardó: no queda nada por recuperar. */
        limpiar() {
            if (clave.current) borradores.delete(clave.current);
            setRecuperado(false);
        },
    };
}
