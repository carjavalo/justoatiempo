import { router } from '@inertiajs/react';

/**
 * Código de seguridad (CSRF) de la sesión, tal como lo comparte el servidor en cada página (`props.csrf`).
 *
 * Por qué no basta la cookie XSRF-TOKEN: los navegadores no separan las cookies por puerto, así que otra app
 * Laravel abierta en la misma dirección (p. ej. 192.168.2.172:8004) sobrescribe la cookie de esta y el siguiente
 * envío fallaría con "Tu sesión expiró". Laravel revisa X-CSRF-TOKEN antes que la cookie, así que enviarlo aquí
 * hace a la plataforma inmune a esa mezcla.
 */
let codigo: string | null = null;

export function codigoCsrf(): string | null {
    return codigo;
}

/** Se llama una vez al iniciar la app con la primera página y luego se mantiene al día solo. */
export function iniciarCsrf(paginaInicial: { props: Record<string, unknown> }) {
    codigo = typeof paginaInicial.props.csrf === 'string' ? paginaInicial.props.csrf : null;

    // Cada respuesta trae el código vigente (cambia al ingresar y al cerrar sesión)
    router.on('navigate', (evento) => {
        const nuevo = evento.detail.page.props.csrf;
        if (typeof nuevo === 'string') codigo = nuevo;
    });

    router.on('before', (evento) => {
        if (codigo) evento.detail.visit.headers = { ...evento.detail.visit.headers, 'X-CSRF-TOKEN': codigo };
    });
}
