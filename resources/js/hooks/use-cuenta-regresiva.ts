import { useEffect, useState } from 'react';

/**
 * Segundos que faltan de una espera, contados segundo a segundo. `marca` identifica cada espera (p. ej. el
 * momento del envío): si llega una nueva con los mismos segundos, el contador vuelve a empezar.
 * Se calcula contra el reloj, no sumando intervalos, para no atrasarse si la pestaña queda en segundo plano.
 */
export function useCuentaRegresiva(segundos: number, marca?: unknown): number {
    const [espera, setEspera] = useState({ segundos, marca, restante: Math.max(0, segundos) });

    // Llega una espera nueva: se reinicia en este mismo render, sin un instante con el valor anterior
    let actual = espera;
    if (espera.segundos !== segundos || espera.marca !== marca) {
        actual = { segundos, marca, restante: Math.max(0, segundos) };
        setEspera(actual);
    }

    useEffect(() => {
        if (segundos <= 0) return;

        const fin = Date.now() + segundos * 1000;
        const reloj = window.setInterval(() => {
            const quedan = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
            setEspera((anterior) => (anterior.restante === quedan ? anterior : { ...anterior, restante: quedan }));
            if (quedan === 0) window.clearInterval(reloj);
        }, 250);

        return () => window.clearInterval(reloj);
    }, [segundos, marca]);

    return actual.restante;
}
