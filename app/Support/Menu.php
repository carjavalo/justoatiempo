<?php

namespace App\Support;

use App\Models\LineaServicio;
use App\Models\SolicitudContacto;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * El menú lateral de cada persona: el inicio, las líneas de servicio que ve y los módulos que su rol abre, agrupados.
 * Con una sola opción no hay menú (quien trabaja en una sola línea entra directo a ella y navega por sus pestañas).
 */
final class Menu
{
    /** Grupo => [permiso del módulo => [título, nombre de la ruta, ícono]]. */
    private const MODULOS = [
        'Personas' => [
            'usuarios' => ['Usuarios', 'usuarios.index', 'usuarios'],
            'asignaciones' => ['Asignaciones', 'asignaciones.index', 'asignaciones'],
            'roles' => ['Roles', 'roles.index', 'roles'],
        ],
        'Clientes' => [
            'empresas' => ['Empresas', 'empresas.index', 'empresas'],
            'sedes' => ['Sedes', 'sedes.index', 'sedes'],
            'sucursales' => ['Sucursales', 'sucursales.index', 'sucursales'],
            'solicitudes' => ['Solicitudes', 'solicitudes.index', 'solicitudes'],
        ],
        'Configuración' => [
            'servicios' => ['Líneas de servicio', 'servicios.index', 'servicios'],
            'vehiculos' => ['Flota', 'vehiculos.index', 'vehiculos'],
            'parametros' => ['Parámetros', 'parametros.index', 'parametros'],
        ],
    ];

    /** Las páginas de logística que no cuelgan de /lineas/logisticos (sus herramientas de Drivin). */
    private const RUTAS_LOGISTICA = ['/cargas', '/auditoria', '/trazabilidad', '/evidencias', '/informes', '/seguimiento', '/mis-entregas'];

    /**
     * @param  Collection<int, LineaServicio>  $lineas  las que ve (User::lineasVisibles)
     * @param  array{url: string}  $inicio  su inicio (User::inicio)
     * @return list<array{titulo: string|null, items: list<array{titulo: string, href: string, icono: string|null, linea: string|null, rutas: list<string>, contador: int|null}>}>|null
     */
    public static function para(User $user, Collection $lineas, array $inicio): ?array
    {
        $grupos = [];

        // El inicio, si es el panel (si es su línea, ya está en "Operación")
        $panel = route('panel', [], false);
        if ($inicio['url'] === $panel) {
            $grupos[] = ['titulo' => null, 'items' => [self::item('Inicio', $panel, 'inicio', [$panel])]];
        }

        if ($lineas->isNotEmpty()) {
            $grupos[] = ['titulo' => 'Operación', 'items' => $lineas->map(function (LineaServicio $l) {
                $url = route('lineas.show', $l, false);

                return [...self::item($l->nombre, $url, null, $l->esLogistica() ? [$url, ...self::RUTAS_LOGISTICA] : [$url]), 'linea' => $l->slug, 'icono' => $l->icono];
            })->values()->all()];
        }

        foreach (self::MODULOS as $titulo => $modulos) {
            $items = [];
            foreach ($modulos as $modulo => [$nombre, $ruta, $icono]) {
                if (! $user->puede("{$modulo}.ver")) {
                    continue;
                }
                $url = route($ruta, [], false);
                $items[] = self::item($nombre, $url, $icono, [$url], $modulo === 'solicitudes' ? SolicitudContacto::where('atendida', false)->count() : null);
            }
            if ($items) {
                $grupos[] = ['titulo' => $titulo, 'items' => $items];
            }
        }

        return array_sum(array_map(fn ($g) => count($g['items']), $grupos)) > 1 ? $grupos : null;
    }

    /** @param  list<string>  $rutas  las direcciones (y lo que cuelga de ellas) en las que la opción queda marcada */
    private static function item(string $titulo, string $href, ?string $icono, array $rutas, ?int $contador = null): array
    {
        return ['titulo' => $titulo, 'href' => $href, 'icono' => $icono, 'linea' => null, 'rutas' => $rutas, 'contador' => $contador ?: null];
    }
}
