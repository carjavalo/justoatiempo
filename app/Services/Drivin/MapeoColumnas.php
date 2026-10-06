<?php

namespace App\Services\Drivin;

use Illuminate\Support\Str;

/**
 * Relación entre los encabezados de la preliquidación de Drivin y los campos internos (RF-03 / RF-04).
 * Los alias salen de la exportación real ("Nombre Plan", "Fecha Plan", "Código del Vehículo",
 * "Código de Dirección", "Estado de la orden", "Motivo", "Hora de Entrega", "Comentario PoE"…)
 * y de variantes habituales; el usuario puede corregir el mapeo en la revisión.
 */
class MapeoColumnas
{
    /**
     * campo => [etiqueta, obligatorio, alias normalizados (en orden de preferencia)].
     * "obligatorio" significa que sin esa columna no se puede importar el archivo.
     */
    public const CAMPOS = [
        'fecha' => ['Fecha de operación', true, ['fecha plan', 'fecha de operacion', 'fecha operacion', 'fecha planificada', 'fecha ruta', 'fecha']],
        'codigo_orden' => ['Código de orden (NP / nota)', true, ['codigo de orden', 'codigo orden', 'numero de orden', 'nro de orden', 'orden', 'nota', 'np', 'codigo de pedido', 'pedido', 'codigo del evento', 'evento', 'codigo de direccion']],
        'estado' => ['Estado de la orden', true, ['estado de la orden', 'estado orden', 'estado de entrega', 'estado entrega', 'estado']],
        'placa' => ['Placa / código del vehículo', true, ['codigo del vehiculo', 'codigo vehiculo', 'placa', 'placa vehiculo', 'vehiculo']],
        'auxiliar' => ['Asistente del conductor (auxiliar)', true, ['asistente del conductor', 'asistente de conductor', 'asistente', 'asistentes', 'auxiliar', 'auxiliar de reparto', 'ayudante', 'acompanante']],
        'ruta' => ['Ruta / nombre del plan', false, ['nombre plan', 'nombre del plan', 'plan', 'nombre ruta', 'ruta', 'operacion']],
        'codigo_direccion' => ['Código de dirección', false, ['codigo de direccion', 'codigo direccion', 'cod direccion']],
        'cliente' => ['Cliente corporativo', false, ['cliente', 'nombre cliente', 'cuenta', 'empresa', 'razon social']],
        'destinatario' => ['Destinatario', false, ['nombre de contacto', 'nombre contacto', 'contacto', 'destinatario', 'nombre destinatario', 'cliente final']],
        'direccion' => ['Dirección de entrega', false, ['direccion', 'direccion de entrega', 'direccion entrega']],
        'ciudad' => ['Ciudad', false, ['ciudad', 'municipio', 'comuna']],
        'producto' => ['Producto', false, ['descripcion del item', 'descripcion item', 'descripcion del producto', 'producto', 'item', 'articulo']],
        'unidades' => ['Unidades', false, ['unidades entregadas', 'unidades', 'cantidad entregada', 'cantidad']],
        'motivo' => ['Motivo de rechazo / novedad', false, ['motivo', 'motivo de rechazo', 'motivo rechazo', 'motivo de no entrega', 'causal', 'razon']],
        'hora_entrega' => ['Hora de entrega', false, ['hora de entrega', 'hora entrega', 'fecha de entrega', 'fecha hora entrega', 'fecha real de entrega']],
        'comentario_pod' => ['Comentario PoE', false, ['comentario poe', 'comentario pod', 'comentario de entrega', 'comentario']],
        'conductor' => ['Conductor', false, ['conductor', 'nombre conductor', 'chofer']],
    ];

    public static function normalizar(?string $texto): string
    {
        $t = Str::of((string) $texto)->ascii()->lower()->replaceMatches('/[^a-z0-9]+/', ' ')->squish();

        return (string) $t;
    }

    /** @return list<string> */
    public static function obligatorios(): array
    {
        return array_keys(array_filter(self::CAMPOS, fn ($c) => $c[1]));
    }

    /**
     * Cuántos encabezados de la fila coinciden exactamente con algún alias (sirve para elegir hoja y fila).
     *
     * @param  array<int, string|null>  $fila
     */
    public static function puntaje(array $fila): int
    {
        $alias = collect(self::CAMPOS)->flatMap(fn ($c) => $c[2])->unique()->flip();

        return collect($fila)->filter(fn ($v) => isset($alias[self::normalizar($v)]))->count();
    }

    /**
     * Propone campo => índice de columna. Primero coincidencias exactas por orden de preferencia,
     * luego "el encabezado empieza por el alias". Una columna no se asigna a dos campos.
     *
     * @param  array<int, string|null>  $encabezados
     * @return array<string, int|null>
     */
    public static function detectar(array $encabezados): array
    {
        $norm = array_map(fn ($h) => self::normalizar($h), $encabezados);
        $usadas = [];
        $mapeo = array_fill_keys(array_keys(self::CAMPOS), null);

        foreach ([true, false] as $exacta) {
            foreach (self::CAMPOS as $campo => [, , $alias]) {
                if ($mapeo[$campo] !== null) {
                    continue;
                }
                foreach ($alias as $a) {
                    foreach ($norm as $i => $h) {
                        if ($h === '' || isset($usadas[$i])) {
                            continue;
                        }
                        // Parcial = el encabezado empieza por el alias ("Estado de la orden (Drivin)"), nunca lo contiene
                        // a mitad de texto: así "Comentario Cliente" no se toma como la columna Cliente.
                        $coincide = $exacta ? $h === $a : str_starts_with($h, $a.' ');
                        if ($coincide) {
                            $mapeo[$campo] = $i;
                            $usadas[$i] = true;
                            continue 3;
                        }
                    }
                }
            }
        }

        return $mapeo;
    }
}
