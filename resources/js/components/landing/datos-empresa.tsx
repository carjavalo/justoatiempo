import { Mail, MapPin, Phone, type TipoIcono, WhatsApp } from '@/components/iconos';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';

/** Contacto, datos legales y tiempo de respuesta de la empresa (config/empresa.php): solo llegan los definidos en el .env. */
export interface DatosEmpresa {
    telefono?: string;
    whatsapp?: string;
    correo?: string;
    direccion?: string;
    ciudad?: string;
    nit?: string;
    politicaDatos?: string;
    tiempoRespuesta?: string;
    /** Aún no son los datos reales: la página lo dice donde los muestra. */
    datosDePrueba?: boolean;
}

export function useDatosEmpresa(): DatosEmpresa {
    return usePage<{ empresa?: DatosEmpresa }>().props.empresa ?? {};
}

const digitos = (texto: string) => texto.replace(/\D/g, '');

/** Aviso de que los datos que se ven no son los definitivos. */
export function MarcaPrueba({ className }: { className?: string }) {
    return <span className={cn('bg-warning-soft text-warning inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tracking-normal normal-case', className)}>Datos de prueba</span>;
}

export interface CanalContacto {
    icono: TipoIcono;
    etiqueta: string;
    valor: string;
    href?: string;
    externo?: boolean;
    /** Otra forma de usar el mismo dato: llamar al número que también es el del WhatsApp. */
    alterno?: { icono: TipoIcono; texto: string; nombre: string; href: string };
}

/** Los canales para hablar con la empresa sin llenar el formulario (los que estén definidos). */
export function canalesDeContacto(e: DatosEmpresa): CanalContacto[] {
    const canales: CanalContacto[] = [];
    // El mismo número para escribir y para llamar se muestra una sola vez
    const mismoNumero = Boolean(e.whatsapp && e.telefono && digitos(e.whatsapp) === digitos(e.telefono));
    if (e.whatsapp) {
        const texto = encodeURIComponent('Hola, quiero cotizar un servicio con Justo a Tiempo SP.');
        canales.push({
            icono: WhatsApp,
            etiqueta: mismoNumero ? 'WhatsApp y celular' : 'WhatsApp',
            valor: e.whatsapp,
            href: `https://wa.me/${digitos(e.whatsapp)}?text=${texto}`,
            externo: true,
            alterno: mismoNumero ? { icono: Phone, texto: 'Llamar', nombre: `Llamar al ${e.whatsapp}`, href: `tel:+${digitos(e.whatsapp)}` } : undefined,
        });
    }
    if (e.telefono && !mismoNumero) canales.push({ icono: Phone, etiqueta: 'Teléfono', valor: e.telefono, href: `tel:+${digitos(e.telefono)}` });
    if (e.correo) canales.push({ icono: Mail, etiqueta: 'Correo', valor: e.correo, href: `mailto:${e.correo}` });
    const sede = [e.direccion, e.ciudad].filter(Boolean).join(', ');
    if (sede) canales.push({ icono: MapPin, etiqueta: 'Sede principal', valor: sede });
    return canales;
}
