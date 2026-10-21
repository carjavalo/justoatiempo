import { ChevronLeft, ChevronRight } from '@/components/iconos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmt } from '@/lib/formato';

interface Props {
    id: string;
    /** Qué se elige ("Jornada", "Día"). */
    etiqueta: string;
    fecha: string | null;
    /** El día anterior y el siguiente a los que se puede ir (null: no hay). */
    anterior: string | null;
    siguiente: string | null;
    onIr: (fecha: string) => void;
}

/** Moverse entre días: el anterior, el siguiente o uno elegido en el calendario. */
export function NavegadorFecha({ id, etiqueta, fecha, anterior, siguiente, onIr }: Props) {
    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline"
                size="icon"
                className="bg-card size-9 rounded-lg"
                disabled={!anterior}
                onClick={() => anterior && onIr(anterior)}
                aria-label={anterior ? `${etiqueta} anterior: ${fmt.fechaMedia(anterior)}` : `No hay ${etiqueta.toLowerCase()} anterior`}
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <label htmlFor={id} className="sr-only">
                {etiqueta}
            </label>
            <Input
                id={id}
                type="date"
                value={fecha ?? ''}
                onChange={(e) => e.target.value && onIr(e.target.value)}
                className="bg-card h-9 w-40 rounded-lg text-xs font-semibold"
            />
            <Button
                variant="outline"
                size="icon"
                className="bg-card size-9 rounded-lg"
                disabled={!siguiente}
                onClick={() => siguiente && onIr(siguiente)}
                aria-label={siguiente ? `${etiqueta} siguiente: ${fmt.fechaMedia(siguiente)}` : `No hay ${etiqueta.toLowerCase()} siguiente`}
            >
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
        </div>
    );
}
