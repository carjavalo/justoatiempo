import { Download } from '@/components/iconos';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePage } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';

interface Props {
    /** Qué hojas trae el archivo. */
    descripcion: string;
    /** El día con el que empieza el periodo. */
    fecha: string | null;
    /** La dirección del archivo para el periodo elegido. */
    url: (desde: string, hasta: string) => string;
    onCerrar: () => void;
}

/** Descargar un informe en Excel: una jornada o un periodo de hasta tres meses. */
export function DialogoDescarga({ descripcion, fecha, url, onCerrar }: Props) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [desde, setDesde] = useState(fecha ?? '');
    const [hasta, setHasta] = useState(fecha ?? '');
    const invalido = !desde || !hasta || hasta < desde;

    const descargar = (e: FormEvent) => {
        e.preventDefault();
        if (invalido) return;
        // Descarga directa del archivo (no es una página)
        window.location.href = url(desde, hasta);
        onCerrar();
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onCerrar()}>
            <DialogContent className="max-w-md rounded-2xl">
                <form onSubmit={descargar} className="grid gap-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-lg font-extrabold">Descargar el informe en Excel</DialogTitle>
                        <DialogDescription>{descripcion} Puedes descargar una jornada o un periodo de hasta tres meses.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <label htmlFor="descarga-desde" className="text-sm font-medium">
                                Desde
                            </label>
                            <Input
                                id="descarga-desde"
                                type="date"
                                required
                                value={desde}
                                onChange={(e) => setDesde(e.target.value)}
                                className="h-10 rounded-lg"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="descarga-hasta" className="text-sm font-medium">
                                Hasta
                            </label>
                            <Input
                                id="descarga-hasta"
                                type="date"
                                required
                                min={desde || undefined}
                                value={hasta}
                                onChange={(e) => setHasta(e.target.value)}
                                aria-describedby={errors.hasta ? 'descarga-hasta-error' : undefined}
                                className="h-10 rounded-lg"
                            />
                            <InputError id="descarga-hasta-error" message={errors.hasta} />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onCerrar} className="rounded-lg">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={invalido} className="rounded-lg">
                            <Download className="size-4" aria-hidden="true" />
                            Descargar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
