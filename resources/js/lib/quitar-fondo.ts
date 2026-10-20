import type { ImageSegmenter } from '@mediapipe/tasks-vision';

/**
 * Quita el fondo de una foto de persona (azul, de oficina, de exterior…) en el propio navegador, con el modelo
 * de segmentación de MediaPipe (licencia Apache 2.0): la foto no se envía a ningún servicio; solo se descarga
 * el modelo la primera vez (unos 16 MB, que el navegador guarda). Se carga solo cuando hace falta.
 */
const VERSION = '1.1.1';
const ARCHIVOS = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
// Distingue fondo, pelo, piel, ropa y accesorios: recorta mejor el pelo que el modelo de videollamadas
const MODELO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite';
/** Lado mayor de la foto resultante: de sobra para el círculo del carnet impreso. */
const LADO_MAXIMO = 1200;

let segmentador: Promise<ImageSegmenter> | null = null;

/**
 * Mensajes informativos que la herramienta escribe en la consola al arrancar y al procesar ("Graph successfully
 * started running", "I1020 …", "W1020 …"): no son fallas, pero parecen errores. Mientras trabaja se callan
 * solo esos; cualquier otro mensaje, y sus errores ("E…"), pasan igual.
 */
const RUIDO = [/^[IW]\d{4} \d\d:\d\d:\d\d/, /^Graph successfully started running/, /^INFO: /];

async function enSilencio<T>(tarea: () => Promise<T> | T): Promise<T> {
    // El aviso de "INFO:" llega por console.error aunque no es un error: por eso también se mira ese canal
    const originales = { log: console.log, info: console.info, warn: console.warn, debug: console.debug, error: console.error };
    for (const metodo of Object.keys(originales) as (keyof typeof originales)[]) {
        console[metodo] = (...datos: unknown[]) => {
            if (typeof datos[0] === 'string' && RUIDO.some((patron) => patron.test(datos[0] as string))) return;
            originales[metodo](...datos);
        };
    }
    try {
        return await tarea();
    } finally {
        Object.assign(console, originales);
    }
}

function obtenerSegmentador(): Promise<ImageSegmenter> {
    segmentador ??= enSilencio(async () => {
        const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
        const archivos = await FilesetResolver.forVisionTasks(ARCHIVOS);
        return ImageSegmenter.createFromOptions(archivos, {
            baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' },
            runningMode: 'IMAGE',
            outputConfidenceMasks: true,
            outputCategoryMask: false,
        });
    });
    // Si falló (p. ej. sin conexión), el próximo intento vuelve a empezar
    segmentador.catch(() => (segmentador = null));
    return segmentador;
}

function lienzo(ancho: number, alto: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = ancho;
    c.height = alto;
    return [c, c.getContext('2d', { willReadFrequently: true })!];
}

/**
 * ¿La foto tiene fondo de color? Mira el borde: si casi todo es blanco o transparente, ya está lista para el
 * carnet; si no (azul, gris oscuro, una oficina…), conviene quitárselo.
 */
export async function tieneFondo(fuente: Blob | HTMLImageElement): Promise<boolean> {
    const imagen = fuente instanceof Blob ? await createImageBitmap(fuente) : fuente;
    const [, ctx] = lienzo(64, 64);
    ctx.drawImage(imagen, 0, 0, 64, 64);
    if (imagen instanceof ImageBitmap) imagen.close();
    const { data } = ctx.getImageData(0, 0, 64, 64);

    let borde = 0;
    let limpio = 0;
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
            // Franja de 3 píxeles alrededor (sin la de abajo, donde suele estar la ropa)
            if (!(x < 3 || x > 60 || y < 3)) continue;
            const i = (y * 64 + x) * 4;
            const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
            borde++;
            const blanco = Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 20;
            if (a < 20 || blanco) limpio++;
        }
    }
    return limpio / borde < 0.85;
}

/**
 * Deja solo la figura principal (la persona): borra los pedazos sueltos que el modelo confunde con ella, como
 * un objeto o un borde del fondo. Se conservan las partes de al menos un 10 % del tamaño de la mayor, con su
 * borde suave alrededor.
 */
function soloLaPersona(alfa: Uint8ClampedArray, ancho: number, alto: number) {
    const etiqueta = new Int32Array(alfa.length).fill(-1);
    const areas: number[] = [];
    const pila: number[] = [];
    for (let inicio = 0; inicio < alfa.length; inicio++) {
        if (alfa[inicio] < 128 || etiqueta[inicio] !== -1) continue;
        const id = areas.length;
        let area = 0;
        etiqueta[inicio] = id;
        pila.push(inicio);
        while (pila.length) {
            const p = pila.pop()!;
            area++;
            const x = p % ancho;
            for (const v of [x > 0 ? p - 1 : -1, x < ancho - 1 ? p + 1 : -1, p - ancho, p + ancho]) {
                if (v >= 0 && v < alfa.length && alfa[v] >= 128 && etiqueta[v] === -1) {
                    etiqueta[v] = id;
                    pila.push(v);
                }
            }
        }
        areas.push(area);
    }
    if (areas.length <= 1) return;

    const mayor = Math.max(...areas);
    const queda = new Uint8Array(alfa.length);
    for (let i = 0; i < alfa.length; i++) if (etiqueta[i] !== -1 && areas[etiqueta[i]] >= mayor * 0.1) queda[i] = 1;

    // El borde suave (alfa bajo) se conserva solo junto a lo que queda: se ensancha lo que queda 3 píxeles
    for (let paso = 0; paso < 3; paso++) {
        const antes = queda.slice();
        for (let y = 0; y < alto; y++) {
            for (let x = 0; x < ancho; x++) {
                const p = y * ancho + x;
                if (antes[p]) continue;
                if ((x > 0 && antes[p - 1]) || (x < ancho - 1 && antes[p + 1]) || (y > 0 && antes[p - ancho]) || (y < alto - 1 && antes[p + ancho]))
                    queda[p] = 1;
            }
        }
    }
    for (let i = 0; i < alfa.length; i++) if (!queda[i]) alfa[i] = 0;
}

/** Devuelve la foto sin fondo (transparente), en WebP o PNG, lista para subir. */
export async function quitarFondo(archivo: Blob, nombre = 'foto'): Promise<File> {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const [foto, ctx] = lienzo(Math.round(imagen.width * escala), Math.round(imagen.height * escala));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, 0, 0, foto.width, foto.height);
    imagen.close();

    const modelo = await obtenerSegmentador();
    const resultado = await enSilencio(() => modelo.segment(foto));
    try {
        const indice = Math.max(0, modelo.getLabels().indexOf('background'));
        const fondo = resultado.confidenceMasks?.[indice];
        if (!fondo) throw new Error('El modelo no devolvió la máscara del fondo.');

        // Máscara de transparencia: lo que no es fondo queda opaco, con un borde suave de un par de píxeles
        const confianza = fondo.getAsFloat32Array();
        const alfa = new Uint8ClampedArray(confianza.length);
        for (let i = 0; i < confianza.length; i++) {
            const t = Math.min(1, Math.max(0, (1 - confianza[i] - 0.3) / 0.4));
            alfa[i] = Math.round(t * t * (3 - 2 * t) * 255);
        }
        soloLaPersona(alfa, fondo.width, fondo.height);

        const [mascara, mctx] = lienzo(fondo.width, fondo.height);
        const pixeles = mctx.createImageData(fondo.width, fondo.height);
        for (let i = 0; i < alfa.length; i++) pixeles.data[i * 4 + 3] = alfa[i];
        mctx.putImageData(pixeles, 0, 0);

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mascara, 0, 0, foto.width, foto.height);
    } finally {
        resultado.close();
    }

    const blob = await new Promise<Blob | null>((listo) => foto.toBlob(listo, 'image/webp', 0.92));
    if (!blob) throw new Error('No se pudo guardar la foto sin fondo.');
    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File([blob], `${nombre}-sin-fondo.${extension}`, { type: blob.type, lastModified: Date.now() });
}
