<?php

namespace App\Support;

use App\Enums\Rol;

/**
 * Catálogo de lo que un rol puede hacer en la plataforma: cada módulo con sus acciones ("usuarios.ver",
 * "cargas.subir"…) y el alcance de lo que ve de la operación. Es la única fuente: el formulario de roles se
 * arma con él y las rutas lo usan con el middleware "permiso".
 */
final class Permisos
{
    /** Ve toda la operación, aunque tenga una empresa asignada. */
    public const ALCANCE_TODO = 'todo';

    /** Si tiene empresa asignada, solo ve esa empresa (y su sede y su sucursal si las tiene). */
    public const ALCANCE_ASIGNACION = 'asignacion';

    /** Solo su propia información (su desempeño). */
    public const ALCANCE_PROPIO = 'propio';

    /** Ver todas las líneas de servicio; sin él, solo la suya. */
    public const TODAS_LAS_LINEAS = 'lineas.todas';

    /**
     * Grupos → módulos → acciones. La acción "ver" es la entrada al módulo: cualquier otra la incluye.
     * "pendiente": el módulo aún está en construcción (su permiso ya se puede dar).
     */
    public const CATALOGO = [
        [
            'clave' => 'administracion',
            'titulo' => 'Administración',
            'modulos' => [
                'usuarios' => ['titulo' => 'Usuarios', 'descripcion' => 'Accesos de las personas, con su carnet y su ARL.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'roles' => ['titulo' => 'Roles', 'descripcion' => 'Los roles de la empresa y sus permisos.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'empresas' => ['titulo' => 'Empresas', 'descripcion' => 'Empresas clientes y las líneas que reciben.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'sedes' => ['titulo' => 'Sedes', 'descripcion' => 'Sedes de cada empresa y su meta de efectividad.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'sucursales' => ['titulo' => 'Sucursales', 'descripcion' => 'Puntos de cada sede y los propios de Justo a Tiempo.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'solicitudes' => ['titulo' => 'Solicitudes de cotización', 'descripcion' => 'Lo que escriben los clientes desde el sitio web.', 'acciones' => ['ver' => 'Ver', 'atender' => 'Marcar como atendidas']],
            ],
        ],
        [
            'clave' => 'operacion',
            'titulo' => 'Operación',
            'modulos' => [
                'tablero' => ['titulo' => 'Tablero de la línea', 'descripcion' => 'Indicadores, empresas y personal de su línea de servicio.', 'acciones' => ['ver' => 'Ver']],
                'cargas' => ['titulo' => 'Cargas Drivin', 'descripcion' => 'La preliquidación diaria de Drivin (servicios logísticos).', 'acciones' => ['ver' => 'Ver', 'subir' => 'Subir y revisar', 'confirmar' => 'Confirmar', 'anular' => 'Anular']],
                'auditoria' => ['titulo' => 'Auditoría POD', 'descripcion' => 'Las evidencias de entrega de cada orden.', 'acciones' => ['ver' => 'Ver', 'revisar' => 'Revisar órdenes', 'subir' => 'Subir evidencias', 'eliminar' => 'Eliminar evidencias']],
                'informes' => ['titulo' => 'Informe diario', 'descripcion' => 'Cuadro consolidado por fecha, sede, ruta y auxiliar.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
                'seguimiento' => ['titulo' => 'Seguimiento y desempeño', 'descripcion' => 'Felicitaciones y llamados de atención por auxiliar.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
                'programacion' => ['titulo' => 'Programación diaria', 'descripcion' => 'Auxiliares y vehículos requeridos por sede y fecha.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
            ],
        ],
        [
            'clave' => 'maestros',
            'titulo' => 'Datos maestros',
            'modulos' => [
                'empleados' => ['titulo' => 'Empleados', 'descripcion' => 'Auxiliares y conductores por cédula.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
                'vehiculos' => ['titulo' => 'Flota', 'descripcion' => 'Vehículos por placa y código interno.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
                'parametros' => ['titulo' => 'Parámetros', 'descripcion' => 'Metas de efectividad y reglas globales.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
            ],
        ],
        [
            'clave' => 'personal',
            'titulo' => 'Lo personal',
            'modulos' => [
                'entregas' => ['titulo' => 'Mis entregas', 'descripcion' => 'Su historial de entregas y su efectividad.', 'acciones' => ['ver' => 'Ver'], 'pendiente' => true],
            ],
        ],
    ];

    /** Módulos que reúnen la información de todas las empresas: no se abren a quien ve solo la suya. */
    public const MEZCLAN_EMPRESAS = ['cargas', 'auditoria', 'informes', 'seguimiento', 'programacion', 'empleados', 'vehiculos', 'parametros'];

    /** Herramientas de la línea de servicios logísticos: solo para quien trabaja en ella (o ve todas). */
    public const DE_LOGISTICA = ['cargas', 'auditoria', 'informes', 'seguimiento', 'programacion'];

    /** Permisos que no se pueden quitar del propio rol: sin ellos nadie podría corregirlo. */
    public const IMPRESCINDIBLES = ['usuarios.editar', 'roles.editar'];

    /** @return list<string> Todos los permisos, en el orden del catálogo. */
    public static function todos(): array
    {
        $todos = [];
        foreach (self::CATALOGO as $grupo) {
            foreach ($grupo['modulos'] as $modulo => $datos) {
                foreach (array_keys($datos['acciones']) as $accion) {
                    $todos[] = "{$modulo}.{$accion}";
                }
            }
        }
        $todos[] = self::TODAS_LAS_LINEAS;

        return $todos;
    }

    /** @return array<string, string> Los alcances, de más amplio a más limitado. */
    public static function alcances(): array
    {
        return [
            self::ALCANCE_TODO => 'Toda la operación',
            self::ALCANCE_ASIGNACION => 'Su asignación',
            self::ALCANCE_PROPIO => 'Solo lo suyo',
        ];
    }

    /** @return array<string, string> Qué significa cada alcance, para el formulario. */
    public static function descripcionAlcances(): array
    {
        return [
            self::ALCANCE_TODO => 'Todas las empresas, sedes y sucursales, aunque tenga una empresa asignada.',
            self::ALCANCE_ASIGNACION => 'Si tiene empresa asignada, solo esa empresa (y su sede y su sucursal). Sin empresa, toda la operación.',
            self::ALCANCE_PROPIO => 'Solo su propio desempeño en el tablero.',
        ];
    }

    /** Si el alcance $a deja ver al menos lo mismo que $b. */
    public static function alcanceCubre(string $a, string $b): bool
    {
        $orden = array_flip(array_keys(self::alcances()));

        return ($orden[$a] ?? PHP_INT_MAX) <= ($orden[$b] ?? PHP_INT_MAX);
    }

    /**
     * Deja solo permisos del catálogo y agrega lo que cada uno necesita: cualquier acción incluye "ver" su
     * módulo, y las herramientas de la línea (cargas, auditoría…) se usan desde su tablero.
     *
     * @param  array<int, mixed>  $permisos
     * @return list<string>
     */
    public static function normalizar(array $permisos): array
    {
        $validos = self::todos();
        $elegidos = array_values(array_intersect($validos, array_filter($permisos, 'is_string')));

        foreach ($elegidos as $permiso) {
            [$modulo] = explode('.', $permiso);
            if ($permiso !== self::TODAS_LAS_LINEAS) {
                $elegidos[] = "{$modulo}.ver";
            }
            if (in_array($modulo, self::DE_LOGISTICA, true)) {
                $elegidos[] = 'tablero.ver';
            }
        }

        // En el orden del catálogo, sin repetidos
        return array_values(array_intersect($validos, array_unique($elegidos)));
    }

    /**
     * Permisos con los que empieza cada nivel de acceso: los de los roles base y los de los roles que ya
     * existían antes de los permisos.
     *
     * @return array{permisos: list<string>, alcance: string}
     */
    public static function plantilla(Rol $nivel): array
    {
        return match ($nivel) {
            Rol::Admin => ['permisos' => self::todos(), 'alcance' => self::ALCANCE_TODO],
            Rol::Coordinador => [
                'permisos' => self::normalizar([
                    'tablero.ver', 'cargas.subir', 'cargas.confirmar', 'cargas.anular',
                    'auditoria.revisar', 'auditoria.subir', 'auditoria.eliminar',
                    'informes.ver', 'seguimiento.ver', 'programacion.ver',
                ]),
                'alcance' => self::ALCANCE_ASIGNACION,
            ],
            Rol::Auxiliar => ['permisos' => self::normalizar(['tablero.ver', 'entregas.ver']), 'alcance' => self::ALCANCE_PROPIO],
        };
    }

    /** El título del módulo de un permiso ("cargas.subir" → "Cargas Drivin"). */
    public static function tituloModulo(string $modulo): ?string
    {
        foreach (self::CATALOGO as $grupo) {
            if (isset($grupo['modulos'][$modulo])) {
                return $grupo['modulos'][$modulo]['titulo'];
            }
        }

        return null;
    }
}
