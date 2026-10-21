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
                'asignaciones' => ['titulo' => 'Asignaciones', 'descripcion' => 'Dónde presta el servicio cada persona, qué líneas hace allí y por cuánto tiempo.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'terminar' => 'Terminar']],
                'roles' => ['titulo' => 'Roles', 'descripcion' => 'Los roles de la empresa y sus permisos.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'servicios' => ['titulo' => 'Líneas de servicio', 'descripcion' => 'Las líneas que presta Justo a Tiempo (logística, aseo…) y las nuevas.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
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
                'programacion' => ['titulo' => 'Programación y asistencia', 'descripcion' => 'Quién trabaja cada día en cada empresa, sede y sucursal de su línea, y si asistió.', 'acciones' => ['ver' => 'Ver', 'editar' => 'Programar personal', 'asistencia' => 'Registrar asistencia']],
                'novedades' => ['titulo' => 'Novedades', 'descripcion' => 'Llegadas tarde, quejas, faltantes y demás novedades de la operación, con su seguimiento.', 'acciones' => ['ver' => 'Ver', 'registrar' => 'Registrar', 'cerrar' => 'Dar seguimiento y cerrar']],
                'informes' => ['titulo' => 'Informe diario', 'descripcion' => 'El cuadro de cada jornada de su línea (en logística, por ruta y auxiliar, como el Excel de la operación).', 'acciones' => ['ver' => 'Ver', 'editar' => 'Escribir observaciones', 'cerrar' => 'Pasar a seguimiento, cerrar y reabrir', 'descargar' => 'Descargar en Excel']],
                'seguimiento' => ['titulo' => 'Seguimiento y desempeño', 'descripcion' => 'Felicitaciones, retroalimentaciones y llamados de atención por persona.', 'acciones' => ['ver' => 'Ver', 'registrar' => 'Registrar acciones']],
            ],
        ],
        [
            'clave' => 'maestros',
            'titulo' => 'Datos maestros',
            'modulos' => [
                'vehiculos' => ['titulo' => 'Flota', 'descripcion' => 'Vehículos por placa y código interno, con su conductor habitual.', 'acciones' => ['ver' => 'Ver', 'crear' => 'Crear', 'editar' => 'Editar', 'estado' => 'Activar y desactivar']],
                'parametros' => ['titulo' => 'Parámetros', 'descripcion' => 'Umbrales del seguimiento, motivos de rechazo y tipos de novedad.', 'acciones' => ['ver' => 'Ver', 'editar' => 'Editar']],
            ],
        ],
        [
            'clave' => 'personal',
            'titulo' => 'Lo personal',
            'modulos' => [
                'entregas' => ['titulo' => 'Mis entregas', 'descripcion' => 'Su historial de entregas de Drivin, jornada por jornada, con su cumplimiento y sus evidencias.', 'acciones' => ['ver' => 'Ver']],
            ],
        ],
    ];

    /**
     * Módulos que reúnen la información de todas las empresas: no se abren a quien ve solo la suya. Usuarios, el
     * informe diario y el seguimiento sí: a esa persona le muestran solo lo de sus asignaciones.
     */
    public const MEZCLAN_EMPRESAS = [
        'roles', 'servicios', 'empresas', 'sedes', 'sucursales', 'solicitudes',
        'cargas', 'auditoria', 'vehiculos', 'parametros',
    ];

    /** Lo único que tiene sentido con el alcance "solo lo suyo": su tablero (su desempeño) y sus entregas. */
    public const SOLO_LO_SUYO = ['tablero', 'entregas', 'lineas'];

    /** Herramientas de la línea de servicios logísticos (Drivin): solo para quien trabaja en ella (o ve todas). */
    public const DE_LOGISTICA = ['cargas', 'auditoria'];

    /**
     * Herramientas que tiene cada línea de servicio: su permiso le aplica en las líneas donde trabaja (o en todas, si
     * las ve todas), con lo que ve de cada una.
     */
    public const DE_LA_LINEA = ['programacion', 'novedades', 'informes', 'seguimiento'];

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
            self::ALCANCE_ASIGNACION => 'Solo lo de sus asignaciones vigentes: las empresas (y sedes y sucursales) donde presta el servicio, con su personal. Una asignación sin empresa le muestra toda la línea. Los módulos que reúnen a todas las empresas no se le abren.',
            self::ALCANCE_PROPIO => 'Solo su propio desempeño en el tablero y Mis entregas: los demás módulos no se le abren.',
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
     * módulo, y las herramientas de la línea (cargas, auditoría…) y ver todas las líneas pasan por su tablero.
     * Con el alcance "solo lo suyo" quedan únicamente los permisos que le aplican.
     *
     * @param  array<int, mixed>  $permisos
     * @return list<string>
     */
    public static function normalizar(array $permisos, ?string $alcance = null): array
    {
        $validos = self::todos();
        $elegidos = array_values(array_intersect($validos, array_filter($permisos, 'is_string')));
        if ($alcance === self::ALCANCE_PROPIO) {
            $elegidos = array_values(array_filter($elegidos, fn (string $p) => in_array(strstr($p, '.', true), self::SOLO_LO_SUYO, true)));
        }

        foreach ($elegidos as $permiso) {
            [$modulo] = explode('.', $permiso);
            if ($permiso === self::TODAS_LAS_LINEAS) {
                $elegidos[] = 'tablero.ver';
            } else {
                $elegidos[] = "{$modulo}.ver";
            }
            if (in_array($modulo, [...self::DE_LOGISTICA, ...self::DE_LA_LINEA], true)) {
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
                    'informes.editar', 'informes.cerrar', 'informes.descargar', 'seguimiento.registrar',
                    'programacion.editar', 'programacion.asistencia', 'novedades.registrar', 'novedades.cerrar',
                ]),
                'alcance' => self::ALCANCE_ASIGNACION,
            ],
            Rol::Auxiliar => ['permisos' => self::normalizar(['tablero.ver', 'entregas.ver'], self::ALCANCE_PROPIO), 'alcance' => self::ALCANCE_PROPIO],
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
