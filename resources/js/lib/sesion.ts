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
        window.history.replaceState({ page: paginaInicial }, '');
    }

    // Atrás y Adelante dentro de la app
    window.addEventListener('popstate', (evento) => {
        const pagina: unknown = evento.state?.page;
        // Sin copia (un enlace a una sección, #) o de esta sesión: la restaura Inertia, como siempre
        if (!esPagina(pagina) || esDeEstaSesion(pagina)) return;
        // Es de otra sesión: no se muestra; se pide la de esta dirección y su respuesta toma el lugar de la copia
        evento.stopImmediatePropagation();
        router.visit(window.location.href, { replace: true });
    });

    // El navegador puede guardar la página entera al salir del sitio y mostrarla tal cual al volver: puede ser de
    // antes de ingresar o de salir, así que se actualiza con el servidor (conservando lo escrito y el desplazamiento)
    window.addEventListener('pageshow', (evento) => {
        if (evento.persisted) router.reload({ replace: true });
    });

    router.on('success', (evento) => tomar(evento.detail.page));
    // Con errores de validación no hay "success"; la página que llegó ya quedó escrita en el historial
    router.on('error', () => {
        const pagina: unknown = window.history.state?.page;
        if (esPagina(pagina)) tomar(pagina);
    });

    // Cada envío lleva el código de la sesión vigente
    router.on('before', (evento) => {
        if (codigo) evento.detail.visit.headers = { ...evento.detail.visit.headers, 'X-CSRF-TOKEN': codigo };
    });
}
