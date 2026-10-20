import { contenedorModulo, EncabezadoModulo } from '@/components/admin/piezas';
import { AlertTriangle, Download, LoaderCircle } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cedulaLegible, dibujarCarnet, prepararCarnet, type DatosCarnet, type RecursosCarnet } from '@/lib/carnet';
import { Head, Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

interface Persona extends DatosCarnet {
    id: number;
    nombreCompleto: string;
    tieneCargo: boolean;
    activo: boolean;
}

/**
 * El carnet de una persona, armado por la plataforma con su foto y sus datos sobre el diseño de la empresa.
 * Se ve aquí y se descarga como imagen.
 */
export default function Carnet({ persona }: { persona: Persona }) {
    const lienzo = useRef<HTMLCanvasElement>(null);
    const [recursos, setRecursos] = useState<RecursosCarnet | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let vigente = true;
        prepararCarnet(persona)
            .then((r) => vigente && setRecursos(r))
            .catch(() => vigente && setError(true));
        return () => {
            vigente = false;
        };
    }, [persona]);

    useEffect(() => {
        if (recursos && lienzo.current) dibujarCarnet(lienzo.current, recursos, persona);
    }, [recursos, persona]);

    // La descarga se dibuja aparte, a mayor resolución (1911 px de lado): sirve también para imprimir
    const descargar = () => {
        if (!recursos) return;
        const grande = document.createElement('canvas');
        dibujarCarnet(grande, recursos, persona, 3);
        grande.toBlob((archivo) => {
            if (!archivo) return;
            const enlace = document.createElement('a');
            enlace.href = URL.createObjectURL(archivo);
            enlace.download = `carnet-${persona.nombreCompleto
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}.png`;
            enlace.click();
            window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
        }, 'image/png');
    };

    const faltan = [!persona.foto && 'la foto', !persona.cedula && 'la cédula', !persona.tieneCargo && 'el cargo'].filter(Boolean) as string[];
    const descripcion = [
        `Carnet de ${persona.nombreCompleto}`,
        persona.cargo,
        persona.cedula ? cedulaLegible(persona.cedula) : null,
        persona.email,
        'con código QR',
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <AppLayout volver={{ texto: 'Volver a usuarios', href: route('usuarios.index') }}>
            <Head title={`Carnet de ${persona.nombreCompleto}`} />

            <div className={contenedorModulo}>
                <EncabezadoModulo
                    titulo={`Carnet de ${persona.nombreCompleto}`}
                    descripcion="Se arma solo con la foto y los datos del usuario sobre el diseño de la empresa. El QR lleva a la verificación del carnet."
                    accion={
                        <Button onClick={descargar} disabled={!recursos} className="h-10 rounded-lg px-4 font-semibold">
                            <Download className="size-4" aria-hidden="true" />
                            Descargar carnet
                        </Button>
                    }
                />

                {faltan.length > 0 && (
                    <div className="bg-warning-soft text-warning flex items-start gap-3 rounded-2xl px-5 py-4 text-sm">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <p className="text-foreground">
                            <strong className="font-semibold">Para que el carnet quede completo, falta {lista(faltan)}.</strong> Puedes agregarlo en{' '}
                            <Link
                                href={route('usuarios.index', { q: persona.email })}
                                className="text-primary font-semibold underline underline-offset-4"
                            >
                                Usuarios, editando a {persona.nombreCompleto}
                            </Link>
                            .
                        </p>
                    </div>
                )}

                {!persona.activo && (
                    <p className="bg-muted text-muted-foreground rounded-2xl px-5 py-4 text-sm">
                        Este usuario está inactivo: al escanear el QR, el carnet aparece como no vigente.
                    </p>
                )}

                <div className="bg-card relative mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border shadow-[var(--sombra-elevada)]">
                    <canvas ref={lienzo} role="img" aria-label={descripcion} className="block aspect-square w-full" />
                    {!recursos && (
                        <div className="bg-card absolute inset-0 flex items-center justify-center" role="status">
                            {error ? (
                                <p className="text-muted-foreground px-6 text-center text-sm">
                                    No se pudo armar el carnet. Recarga la página para intentarlo de nuevo.
                                </p>
                            ) : (
                                <>
                                    <LoaderCircle className="text-muted-foreground size-8 motion-safe:animate-spin" aria-hidden="true" />
                                    <span className="sr-only">Armando el carnet…</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

/** ["la foto", "la cédula", "el cargo"] → "la foto, la cédula y el cargo". */
function lista(partes: string[]): string {
    return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
}
