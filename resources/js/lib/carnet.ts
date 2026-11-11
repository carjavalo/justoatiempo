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
/**
 * Franja azul de abajo: la línea de servicio que hace (no la empresa: cambia de cliente y el carnet impreso quedaría
 * viejo), en blanco. Va de x 22 hasta antes del corte en diagonal de la franja (x ≈ 488) y su renglón base centra el
 * texto en la franja (y 585 a 612).
 */
const FRANJA = { x: 22, y: 605, ancho: 458 };
const ETIQUETA = { peso: 700, tamano: 10.5, espaciado: 0.08 };
const VALOR = { peso: 800, tamano: 18, espaciado: 0 };
const EN_LA_FRANJA = { etiqueta: '#ffb4a9', valor: '#ffffff' };

/**
 * Donde el diseño traía el correo (el renglón del sobre) van el RH, la EPS y la ARL, en dos renglones a la altura del
 * círculo coral. El sobre se cubre con el mismo coral y lleva una cruz de salud en blanco.
 */
const SALUD = { x: 297, ancho: 236, renglones: [507.5, 532.5], tamano: 0.92 };
const EN_BLANCO = { etiqueta: 'rgba(11, 29, 85, 0.68)', valor: AZUL };
const ICONO_SALUD = { x: 258, y: 515.8, radio: 24.8, coral: '#fa6d60' };

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
};

export interface DatosCarnet {
    nombres: string;
    apellidos: string;
    cedula: string | null;
    cargo: string;
    /** Grupo sanguíneo y factor RH ("O+"). */
    rh: string | null;
    eps: string | null;
    /** La ARL a la que está afiliada ("SURA"). */
    entidadArl: string | null;
    /** Dónde presta el servicio hoy: cada asignación vigente con su empresa (sin empresa: toda la línea), sede, sucursal y líneas. */
    asignaciones: { empresa: string | null; sede: string | null; sucursal: string | null; lineas: string[]; hasta: string | null }[];
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
type Estilo = { x: number; y: number; ancho: number; peso: number; tamano: number; espaciado: number };

function escribir(ctx: CanvasRenderingContext2D, texto: string, estilo: Estilo, escalaFija?: number) {
    if (!texto) return;
    const factor = escalaFija ?? ajuste(ctx, texto, estilo);
    letra(ctx, estilo, estilo.tamano * factor);
    ctx.fillText(texto, estilo.x, estilo.y, estilo.ancho);
}

/** Cuánto hay que achicar un texto para que quepa (1 si cabe). */
function ajuste(ctx: CanvasRenderingContext2D, texto: string, estilo: Estilo): number {
    letra(ctx, estilo, estilo.tamano);
    return Math.max(0.62, Math.min(1, estilo.ancho / Math.max(1, ctx.measureText(texto).width)));
}

/** Letra, tamaño y espacio entre letras (en proporción al tamaño, como en el diseño). */
function letra(ctx: CanvasRenderingContext2D, { peso, espaciado }: { peso: number; espaciado: number }, tamano: number) {
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

    dibujarSalud(ctx, datos);
    escribirPares(ctx, partesFranja(datos), { x: FRANJA.x, y: FRANJA.y, ancho: FRANJA.ancho, tamano: 1 }, EN_LA_FRANJA);
    dibujarQr(ctx, recursos.qr);
}

/** Lo que dice la franja: "LÍNEA SERVICIOS LOGÍSTICOS"; con varias, "LÍNEAS SERVICIOS LOGÍSTICOS · ASEO GENERAL". */
export function partesFranja(datos: Pick<DatosCarnet, 'asignaciones'>): [string, string][] {
    const lineas = lineasCarnet(datos);
    return [[lineas.length > 1 ? 'Líneas' : 'Línea', lineas.length ? lineas.join(' · ') : 'Sin asignar']];
}

/** El RH, la EPS y la ARL que tenga, en los dos renglones del carnet: "RH O+ · ARL SURA" y "EPS NUEVA EPS". */
export function partesSalud(datos: Pick<DatosCarnet, 'rh' | 'eps' | 'entidadArl'>): [string, string][][] {
    const pares = (lista: [string, string | null][]) => lista.filter((p): p is [string, string] => Boolean(p[1]));
    return [
        pares([
            ['RH', datos.rh],
            ['ARL', datos.entidadArl],
        ]),
        pares([['EPS', datos.eps]]),
    ];
}

function dibujarSalud(ctx: CanvasRenderingContext2D, datos: DatosCarnet) {
    // El sobre del diseño se cubre con su mismo coral y lleva una cruz de salud
    const { x, y, radio, coral } = ICONO_SALUD;
    ctx.save();
    ctx.fillStyle = coral;
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    const largo = 22;
    const grueso = 7.5;
    ctx.beginPath();
    ctx.roundRect(x - grueso / 2, y - largo / 2, grueso, largo, 1.6);
    ctx.roundRect(x - largo / 2, y - grueso / 2, largo, grueso, 1.6);
    ctx.fill();
    ctx.restore();

    partesSalud(datos).forEach((partes, i) => escribirPares(ctx, partes, { x: SALUD.x, y: SALUD.renglones[i], ancho: SALUD.ancho, tamano: SALUD.tamano }, EN_BLANCO));
}

/** Las líneas de servicio que hace hoy, sin repetir: "SERVICIOS LOGÍSTICOS · ASEO GENERAL". */
export function lineasCarnet(datos: Pick<DatosCarnet, 'asignaciones'>): string[] {
    return [...new Set(datos.asignaciones.flatMap((a) => a.lineas))];
}

/**
 * Escribe datos con su etiqueta: la etiqueta pequeña y el valor grande, separados por un punto. Si no caben, se achican
 * (hasta un 62 %) y, si aún así no caben, se angostan: nunca pasan del espacio del diseño.
 */
function escribirPares(
    ctx: CanvasRenderingContext2D,
    lista: [string, string][],
    caja: { x: number; y: number; ancho: number; tamano: number },
    colores: { etiqueta: string; valor: string },
) {
    if (lista.length === 0) return;
    const partes = lista.map(([etiqueta, valor]) => [etiqueta.toLocaleUpperCase('es-CO'), valor.toLocaleUpperCase('es-CO')] as const);
    const separacion = 6;
    const entrePartes = 16;

    const medir = (factor: number) =>
        partes.reduce((total, [etiqueta, valor], i) => {
            letra(ctx, ETIQUETA, ETIQUETA.tamano * factor);
            const anchoEtiqueta = ctx.measureText(etiqueta).width;
            letra(ctx, VALOR, VALOR.tamano * factor);
            return total + anchoEtiqueta + separacion * factor + ctx.measureText(valor).width + (i > 0 ? entrePartes * factor : 0);
        }, 0);

    const factor = caja.tamano * Math.max(0.62, Math.min(1, caja.ancho / Math.max(1, medir(caja.tamano))));
    const angosto = Math.min(1, caja.ancho / Math.max(1, medir(factor)));

    ctx.save();
    ctx.translate(caja.x, caja.y);
    ctx.scale(angosto, 1);
    ctx.textBaseline = 'alphabetic';
    let x = 0;
    partes.forEach(([etiqueta, valor], i) => {
        if (i > 0) {
            // Un punto entre un dato y otro
            ctx.fillStyle = colores.etiqueta;
            ctx.beginPath();
            ctx.arc(x + (entrePartes * factor) / 2, -VALOR.tamano * factor * 0.36, 1.6 * factor, 0, Math.PI * 2);
            ctx.fill();
            x += entrePartes * factor;
        }
        letra(ctx, ETIQUETA, ETIQUETA.tamano * factor);
        ctx.fillStyle = colores.etiqueta;
        ctx.fillText(etiqueta, x, 0);
        x += ctx.measureText(etiqueta).width + separacion * factor;
        letra(ctx, VALOR, VALOR.tamano * factor);
        ctx.fillStyle = colores.valor;
        ctx.fillText(valor, x, 0);
        x += ctx.measureText(valor).width;
    });
    ctx.restore();
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
