import { router } from '@inertiajs/react';

/**
 * La sesión vigente según el servidor: quién ingresó y el código de seguridad (CSRF) de la sesión. Se toma de la
 * primera página y de cada respuesta del servidor, nunca de una copia guardada en el historial del navegador.
 *
 * Por qué: con «Atrás», Inertia muestra la copia de la página que guardó en el historial, sin preguntarle al
 * servidor. Esa copia puede ser de otra sesión (el inicio de sesión de antes de ingresar, o una página de una sesión
 * ya cerrada): mostraría la pantalla equivocada y traería un código CSRF vencido. Si la copia no es de la sesión
 * vigente, la página se pide de nuevo al servidor, que decide qué mostrar (del inicio de sesión lleva al panel; de
 * una página privada, sin sesión, al inicio de sesión).
 *
 * Por qué el código CSRF no se toma de la cookie XSRF-TOKEN: los navegadores no separan las cookies por puerto, así
 * que otra app Laravel abierta en la misma dirección (p. ej. 192.168.2.172:8004) sobrescribe la cookie de esta y el
 * siguiente envío fallaría con "Tu sesión expiró". Laravel revisa X-CSRF-TOKEN antes que la cookie, así que enviarlo
 * en cada petición hace a la plataforma inmune a esa mezcla.
 */
type Pagina = { url: string; props: Record<string, unknown> };

let usuario: number | null = null;
let codigo: string | null = null;

export function codigoCsrf(): string | null {
    return codigo;
}

function esPagina(valor: unknown): valor is Pagina {
    return typeof valor === 'object' && valor !== null && typeof (valor as Pagina).url === 'string' && typeof (valor as Pagina).props === 'object';
}

const usuarioDe = (pagina: Pagina) => (pagina.props.auth as { user?: { id?: number } | null } | undefined)?.user?.id ?? null;
const codigoDe = (pagina: Pagina) => (typeof pagina.props.csrf === 'string' ? pagina.props.csrf : null);

/** Si la página es de la sesión vigente: la misma persona (o nadie) y el mismo código CSRF. */
function esDeEstaSesion(pagina: Pagina): boolean {
    return codigoDe(pagina) !== null && codigoDe(pagina) === codigo && usuarioDe(pagina) === usuario;
}

/** Lo que dice una respuesta del servidor. Las páginas sin los datos compartidos (un 404 de una dirección que no existe) no cuentan. */
function tomar(pagina: Pagina) {
    if (codigoDe(pagina) === null || esDeEstaSesion(pagina)) return;
    usuario = usuarioDe(pagina);
    codigo = codigoDe(pagina);
    // Ingresó, salió o la sesión venció: lo precargado al pasar el mouse por los enlaces era de la sesión anterior
    router.flushAll();
}

type Posicion = { top: number; left: number };

/**
 * La página que se está pidiendo al servidor en lugar de una copia del historial: a qué dirección se volvió y en qué
 * posición estaba. `marcada`: su petición ya salió (con el encabezado X-Desde-Historial).
 */
let desdeHistorial: { destino: string; posicion: Posicion | null; marcada: boolean } | null = null;

/**
 * Se llama una vez al iniciar la app, antes de mostrarla: Inertia aún no escucha el historial, así que esta revisión
 * va antes que la suya.
 */
export function iniciarSesion(paginaInicial: Pagina) {
    tomar(paginaInicial);

    // Al volver a una página que el navegador carga de nuevo (no la guardó entera), Inertia también prefiere la copia
    // del historial a la que acaba de enviar el servidor: si la copia es de otra sesión, queda la del servidor. Y si
    // el servidor redirigió (p. ej. de una página privada al inicio de sesión), el navegador borra la copia e Inertia
    // falla sin ella (página en blanco): también queda la del servidor.
    const guardada: unknown = window.history.state?.page;
    if (!esPagina(guardada) || !esDeEstaSesion(guardada)) {
        window.history.replaceState({ ...window.history.state, page: paginaInicial }, '');
    }

    // Atrás y Adelante dentro de la app
    window.addEventListener('popstate', (evento) => {
        const estado = evento.state;
        const pagina: unknown = estado?.page;
        // Sin copia (un enlace a una sección, #) o de esta sesión: la restaura Inertia, como siempre
        if (!esPagina(pagina) || esDeEstaSesion(pagina)) return;
        // Es de otra sesión: Inertia no debe mostrarla. Se le quita la copia al evento (no al historial) y, sin ella,
        // Inertia hace lo que hace cuando el historial no le sirve: pide al servidor la página de esta dirección y la
        // respuesta toma el lugar de la copia
        desdeHistorial = { destino: window.location.href, posicion: estado.documentScrollPosition ?? null, marcada: false };
        estado.page = null;
    });

    // El navegador puede guardar la página entera al salir del sitio y mostrarla tal cual al volver: puede ser de
    // antes de ingresar o de salir, así que se actualiza con el servidor (conservando lo escrito y el desplazamiento)
    window.addEventListener('pageshow', (evento) => {
        if (!evento.persisted) return;
        desdeHistorial = { destino: window.location.href, posicion: { top: window.scrollY, left: window.scrollX }, marcada: false };
        router.reload({ replace: true });
    });

    router.on('before', (evento) => {
        const headers: Record<string, string> = { ...evento.detail.visit.headers };
        // Cada envío lleva el código de la sesión vigente
        if (codigo) headers['X-CSRF-TOKEN'] = codigo;
        // La pide el historial, no la persona: si no hay sesión, el servidor no la recuerda para después de ingresar
        // (quien ingrese después, quizá otra persona, no debe terminar en ella)
        if (desdeHistorial && !desdeHistorial.marcada) {
            headers['X-Desde-Historial'] = '1';
            desdeHistorial.marcada = true;
        } else if (!evento.detail.visit.prefetch) {
            // Otra visita (un clic mientras tanto) reemplazó a la del historial; precargar un enlace no la reemplaza
            desdeHistorial = null;
        }
        evento.detail.visit.headers = headers;
    });

    router.on('success', (evento) => {
        tomar(evento.detail.page);

        // La del historial llegó: vuelve a la posición en que se dejó esa página; si el servidor llevó a otra, arriba
        if (desdeHistorial?.marcada) {
            const { destino, posicion } = desdeHistorial;
            desdeHistorial = null;
            const llego = new URL(evento.detail.page.url, window.location.origin);
            const pedida = new URL(destino);
            const misma = llego.pathname === pedida.pathname && llego.search === pedida.search;
            // Después de que React pinte la página (antes, la altura aún es la de la anterior). Sin animación: el sitio
            // público desplaza suave (scroll-behavior) y se vería correr la página
            window.setTimeout(() => window.scrollTo({ ...(misma && posicion ? posicion : { top: 0, left: 0 }), behavior: 'instant' }));
        }
    });
    // Con errores de validación no hay "success"; la página que llegó ya quedó escrita en el historial
    router.on('error', () => {
        const pagina: unknown = window.history.state?.page;
        if (esPagina(pagina)) tomar(pagina);
    });
}
