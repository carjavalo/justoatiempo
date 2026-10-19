import QRCode from 'qrcode';

/**
 * Carnet de Justo a Tiempo SP: el diseño original de la empresa (images/carnet/plantilla.jpg, el mismo arte sin
 * la foto ni los textos) con la foto y los datos de cada persona en las posiciones exactas del original, más el
 * QR abajo a la derecha. Las medidas están en las unidades del diseño original (637 × 637).
 */
export const LADO = 637;

const PLANTILLA = '/images/carnet/plantilla.jpg';
const FUENTE = 'Montserrat, Arial, sans-serif';
const AZUL = '#0b1d55';
// Letra del diseño original; se carga solo donde se dibuja un carnet
const HOJA_FUENTE = 'https://fonts.bunny.net/css?family=montserrat:600,700,800';

/** Círculo de la foto, por dentro del aro blanco y coral. */
const FOTO = { x: 146.2, y: 266.6, radio: 125.4 };
/** Recuadro blanco del QR, sobre las siluetas de los edificios. */
const QR = { x: 540, y: 438, lado: 90, margen: 6 };
/**
 * Textos: dónde empieza, su renglón base, el ancho disponible y la letra, medidos sobre el original (alto de las
 * mayúsculas y ancho de "JOHNNY", "CORREA" y "GERENTE GENERAL"). El nombre va con las letras más juntas.
 */
const TEXTOS = {
    nombres: { x: 298, y: 303, ancho: 272, peso: 800, tamano: 48, espaciado: -0.09 },
    apellidos: { x: 298, y: 347, ancho: 272, peso: 800, tamano: 48, espaciado: -0.09 },
    cargo: { x: 299, y: 400, ancho: 277, peso: 700, tamano: 28, espaciado: -0.02 },
    cedula: { x: 297, y: 456, ancho: 236, peso: 700, tamano: 20.2, espaciado: 0 },
    correo: { x: 297, y: 520.5, ancho: 236, peso: 700, tamano: 21, espaciado: -0.03 },
};

export interface DatosCarnet {
    nombres: string;
    apellidos: string;
    cedula: string | null;
    cargo: string;
    email: string;
    /** Dirección de la foto (fondo blanco o sin fondo), si la tiene. */
    foto: string | null;
    /** Lo que se lee al escanear el QR. */
    qr: string;
}

export interface RecursosCarnet {
    plantilla: HTMLImageElement;
    foto: HTMLImageElement | null;
    qr: QRCode.QRCode;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
    return new Promise((listo, falla) => {
        const imagen = new Image();
        imagen.decoding = 'async';
        imagen.onload = () => listo(imagen);
        imagen.onerror = () => falla(new Error(`No se pudo cargar ${src}`));
        imagen.src = src;
    });
}

/** Agrega la hoja de la letra (una sola vez) y espera a que el navegador la lea. */
function cargarHojaFuente(): Promise<void> {
    const existente = document.querySelector<HTMLLinkElement>(`link[href="${HOJA_FUENTE}"]`);
    if (existente?.sheet) return Promise.resolve();
    return new Promise((listo) => {
        const enlace = existente ?? Object.assign(document.createElement('link'), { rel: 'stylesheet', href: HOJA_FUENTE });
        enlace.addEventListener('load', () => listo(), { once: true });
        // Sin conexión a la hoja, se dibuja con la letra de respaldo
        enlace.addEventListener('error', () => listo(), { once: true });
        if (!existente) document.head.appendChild(enlace);
    });
}

/**
 * Carga la plantilla, la foto y la letra, y arma el QR. La letra se espera de verdad: si se dibuja antes, el
 * navegador usa otra y el carnet no queda como el original.
 */
export async function prepararCarnet(datos: DatosCarnet): Promise<RecursosCarnet> {
    const letra = cargarHojaFuente().then(() => Promise.all([800, 700, 600].map((peso) => document.fonts.load(`${peso} 40px Montserrat`))));
    const [plantilla, foto] = await Promise.all([
        cargarImagen(PLANTILLA),
        datos.foto ? cargarImagen(datos.foto).catch(() => null) : Promise.resolve(null),
        letra,
    ]);

    return { plantilla, foto, qr: QRCode.create(datos.qr, { errorCorrectionLevel: 'M' }) };
}

/** "1144123456" → "C.C. 1.144.123.456". */
export function cedulaLegible(cedula: string): string {
    return `C.C. ${Number(cedula).toLocaleString('es-CO', { useGrouping: true })}`;
}

/**
 * Escribe un texto en su sitio. Si no cabe, primero se achica la letra (hasta un 62 % del tamaño original) y,
 * si aún así no cabe, se angosta: nunca se sale del espacio del diseño.
 */
function escribir(ctx: CanvasRenderingContext2D, texto: string, estilo: (typeof TEXTOS)[keyof typeof TEXTOS], escalaFija?: number) {
    if (!texto) return;
    const factor = escalaFija ?? ajuste(ctx, texto, estilo);
    letra(ctx, estilo, estilo.tamano * factor);
    ctx.fillText(texto, estilo.x, estilo.y, estilo.ancho);
}

/** Cuánto hay que achicar un texto para que quepa (1 si cabe). */
function ajuste(ctx: CanvasRenderingContext2D, texto: string, estilo: (typeof TEXTOS)[keyof typeof TEXTOS]): number {
    letra(ctx, estilo, estilo.tamano);
    return Math.max(0.62, Math.min(1, estilo.ancho / Math.max(1, ctx.measureText(texto).width)));
}

/** Letra, tamaño y espacio entre letras (en proporción al tamaño, como en el diseño). */
function letra(ctx: CanvasRenderingContext2D, { peso, espaciado }: (typeof TEXTOS)[keyof typeof TEXTOS], tamano: number) {
    ctx.font = `${peso} ${tamano}px ${FUENTE}`;
    ctx.letterSpacing = `${espaciado * tamano}px`;
}

/** Dibuja el carnet completo; `escala` 2 da una imagen de 1274 px de lado. */
export function dibujarCarnet(lienzo: HTMLCanvasElement, recursos: RecursosCarnet, datos: DatosCarnet, escala = 2) {
    lienzo.width = Math.round(LADO * escala);
    lienzo.height = Math.round(LADO * escala);
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(recursos.plantilla, 0, 0, LADO, LADO);

    dibujarFoto(ctx, recursos.foto, datos);

    ctx.fillStyle = AZUL;
    ctx.textBaseline = 'alphabetic';
    const nombres = datos.nombres.toLocaleUpperCase('es-CO');
    const apellidos = datos.apellidos.toLocaleUpperCase('es-CO');
    // Los dos renglones del nombre van del mismo tamaño, como en el original
    const factorNombre = Math.min(ajuste(ctx, nombres, TEXTOS.nombres), ajuste(ctx, apellidos, TEXTOS.apellidos));
    escribir(ctx, nombres, TEXTOS.nombres, factorNombre);
    escribir(ctx, apellidos, TEXTOS.apellidos, factorNombre);
    escribir(ctx, datos.cargo.toLocaleUpperCase('es-CO'), TEXTOS.cargo);
    escribir(ctx, datos.cedula ? cedulaLegible(datos.cedula) : '', TEXTOS.cedula);
    escribir(ctx, datos.email, TEXTOS.correo);

    dibujarQr(ctx, recursos.qr);
}

/** La foto llena el círculo; en fotos verticales se toma la parte de arriba, donde va la cara. */
function dibujarFoto(ctx: CanvasRenderingContext2D, foto: HTMLImageElement | null, datos: DatosCarnet) {
    const { x, y, radio } = FOTO;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.clip();

    if (foto) {
        const lado = radio * 2;
        const escala = Math.max(lado / foto.naturalWidth, lado / foto.naturalHeight);
        const ancho = foto.naturalWidth * escala;
        const alto = foto.naturalHeight * escala;
        ctx.drawImage(foto, x - ancho / 2, y - radio - (alto - lado) * 0.2, ancho, alto);
    } else {
        // Sin foto: las iniciales, para que se note qué falta
        const iniciales = `${datos.nombres[0] ?? ''}${datos.apellidos[0] ?? ''}`.toLocaleUpperCase('es-CO');
        ctx.fillStyle = '#c3cad8';
        ctx.font = `800 96px ${FUENTE}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iniciales, x, y + 4);
    }
    ctx.restore();
}

/** QR en azul sobre un recuadro blanco redondeado; cada módulo se dibuja nítido. */
function dibujarQr(ctx: CanvasRenderingContext2D, qr: QRCode.QRCode) {
    const { x, y, lado, margen } = QR;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#dde3ee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, lado, lado, 10);
    ctx.fill();
    ctx.stroke();

    const modulos = qr.modules.size;
    const paso = (lado - margen * 2) / modulos;
    ctx.fillStyle = AZUL;
    for (let fila = 0; fila < modulos; fila++) {
        for (let col = 0; col < modulos; col++) {
            if (qr.modules.get(fila, col)) {
                // Un pelo más grande: sin rayas claras entre módulos al escalar
                ctx.fillRect(x + margen + col * paso, y + margen + fila * paso, paso + 0.05, paso + 0.05);
            }
        }
    }
    ctx.restore();
}
