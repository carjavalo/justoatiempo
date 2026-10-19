/** Lado mayor y peso por encima de los cuales una imagen se reduce antes de subirla. */
const LADO_MAXIMO = 1600;
const PESO_MAXIMO = 1.5 * 1024 * 1024;

/**
 * Reduce en el navegador una foto pesada antes de subirla: lado mayor de 1600 px, en JPEG de buena calidad
 * (o en WebP si es un PNG o WebP: así una foto sin fondo conserva su transparencia). La subida es rápida, no
 * choca con el límite de tamaño del hosting y la foto pierde sus datos ocultos (por ejemplo, la ubicación donde
 * se tomó). Una imagen que ya es liviana se envía tal cual. Si el navegador no puede leerla, se envía la
 * original y el servidor decide.
 */
export async function reducirImagen(archivo: File): Promise<File> {
    if (!archivo.type.startsWith('image/')) return archivo;

    let imagen: ImageBitmap;
    try {
        // Respeta la orientación de la cámara (EXIF) al dibujarla
        imagen = await createImageBitmap(archivo);
    } catch {
        return archivo;
    }

    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    if (escala === 1 && archivo.size <= PESO_MAXIMO) {
        imagen.close();
        return archivo;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    const contexto = lienzo.getContext('2d');
    if (!contexto) {
        imagen.close();
        return archivo;
    }

    const conTransparencia = archivo.type === 'image/png' || archivo.type === 'image/webp';
    if (!conTransparencia) {
        // Fondo blanco por si acaso: el JPEG no tiene transparencia
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    }
    contexto.imageSmoothingQuality = 'high';
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();

    const tipo = conTransparencia ? 'image/webp' : 'image/jpeg';
    const reducida = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, tipo, 0.9));
    // Un navegador sin WebP devuelve PNG: si no quedó más liviana, se envía la original
    if (!reducida || reducida.size >= archivo.size) return archivo;

    const extension = reducida.type === 'image/webp' ? 'webp' : reducida.type === 'image/png' ? 'png' : 'jpg';
    return new File([reducida], `${archivo.name.replace(/\.[^.]+$/, '') || 'imagen'}.${extension}`, { type: reducida.type, lastModified: Date.now() });
}

/** "2,4 MB", "380 KB": el peso de un archivo para mostrarlo. */
export function pesoLegible(bytes: number): string {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
