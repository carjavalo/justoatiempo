<?php

namespace App\Console\Commands;

use App\Services\Drivin\GeneradorPreliquidacion;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Genera una preliquidación de ejemplo con la forma de Drivin para probar el módulo de cargas
 * mientras no se tenga un archivo real. Incluye a propósito casos que la revisión debe detectar.
 */
class GenerarPreliquidacionEjemplo extends Command
{
    protected $signature = 'drivin:ejemplo {fecha? : Fecha de operación (AAAA-MM-DD); por defecto, la jornada anterior}';

    protected $description = 'Genera un archivo .xlsx de preliquidación de Drivin con datos de ejemplo';

    private const PRODUCTOS_TUGO = [
        'MESA DE COMEDOR WAVE SLIM 180*90*75CM MADERA', 'SILLA AUXILIAR PRAGA PLASTICO NEGRO', 'BUTACO ALTO NOLAN TELA BEIGE',
        'MESA AUXILIAR VICTORIA 60*60*75CM BEIGE', 'POLTRONA CANDIS PU DOVE CAFE', 'SOFA 3 PUESTOS MILAN GRIS',
        'NOCHERO NORDICO 2 CAJONES ROBLE', 'BIBLIOTECA 5 ENTREPAÑOS BLANCA', 'CAMA SENCILLA ROBLE 100*190',
    ];

    private const PRODUCTOS_SODIMAC = [
        'NEVERA NO FROST 300 L GRIS', 'ESTUFA DE PISO 4 PUESTOS', 'LAVADORA CARGA SUPERIOR 18 KG',
        'TALADRO PERCUTOR 750 W', 'PISO LAMINADO 8MM CAJA 2,13 M2', 'CALENTADOR DE PASO 10 L',
    ];

    public function handle(GeneradorPreliquidacion $generador): int
    {
        $fecha = $this->argument('fecha') ? Carbon::parse($this->argument('fecha')) : $this->jornadaAnterior();
        mt_srand((int) $fecha->format('Ymd'));

        $rutas = [
            ['plan' => 'CALI SUR CROSS', 'cliente' => 'TUGÓ', 'placa' => 'SNX708', 'vehiculo' => 'Turbo Furgón NHR PBV 3500-5500K', 'conductor' => 'YANIER ADONIS MURILLO MURILLO', 'asistente' => 'JUAN FERNANDO PLAZA GIRALDO', 'ordenes' => 12, 'productos' => self::PRODUCTOS_TUGO],
            ['plan' => 'CALI NORTE', 'cliente' => 'TUGÓ', 'placa' => 'WMK412', 'vehiculo' => 'NHR', 'conductor' => 'HERNAN PUENTES', 'asistente' => 'ANDRES MORENO RIVAS', 'ordenes' => 10, 'productos' => self::PRODUCTOS_TUGO],
            // Placa y asistente que no existen en los datos maestros: deben salir como advertencia
            ['plan' => 'SODIMAC CALI', 'cliente' => 'SODIMAC', 'placa' => 'KLM321', 'vehiculo' => 'Camión 4,5 t', 'conductor' => 'OSCAR LUIS VIVEROS', 'asistente' => 'YEISON ARBOLEDA CUERO', 'ordenes' => 8, 'productos' => self::PRODUCTOS_SODIMAC],
        ];

        $motivos = ['Cliente reprograma fecha de entrega', 'Cliente ausente en domicilio', 'Cliente no contesta llamadas', 'Portería no autoriza el ingreso'];
        $contactos = ['DIANA CUELLAR', 'BEATRIZ MOTTA', 'CONJUNTO RESIDENCIAL INES', 'CARLOS ANDRES RUIZ', 'LUZ MARINA OSPINA', 'JHON JAIRO CAICEDO', 'PAOLA ANDREA LEDESMA', 'EDIFICIO TORRES DEL SUR', 'MARIA FERNANDA GIL', 'JORGE IVAN BEDOYA'];
        $ciudades = [['CALI', 'Valle del Cauca'], ['JAMUNDI', 'Valle del Cauca'], ['CALI', 'Valle del Cauca'], ['PALMIRA', 'Valle del Cauca']];

        $filas = [];
        $codigo = 500000 + (int) $fecha->format('md') * 100;

        foreach ($rutas as $r => $ruta) {
            $plan = $ruta['plan'].' '.$fecha->format('j-n-Y');
            $hora = $fecha->copy()->setTime(8, 0);

            for ($i = 0; $i < $ruta['ordenes']; $i++) {
                $np = 'PDVT000'.$codigo++;
                $hora->addMinutes(mt_rand(18, 45));
                [$ciudad, $provincia] = $ciudades[array_rand($ciudades)];
                $items = mt_rand(1, 100) <= 35 ? mt_rand(2, 3) : 1;

                // Casos especiales repartidos en las rutas
                $caso = match (true) {
                    $r === 0 && $i === 3 => 'parcial',
                    $r === 0 && $i === 7 => 'averia',
                    $r === 1 && $i === 5 => 'parcial',
                    mt_rand(1, 100) <= 14 => 'rechazada',
                    default => 'aprobada',
                };
                $items = $caso === 'parcial' ? max(2, $items) : $items;
                $motivo = $motivos[array_rand($motivos)];

                for ($k = 0; $k < $items; $k++) {
                    [$estado, $motivoFila, $comentario] = match ($caso) {
                        'aprobada' => ['Aprobada', null, mt_rand(0, 3) ? 'entrega exitosa' : 'se deja en portería, recibe vigilante'],
                        'rechazada' => ['Rechazada', $motivo, 'Se llama al cliente para confirmar entrega pero no fue posible'],
                        'averia' => ['Rechazada', 'Producto averiado', 'al destapar el producto presenta rayón, cliente no recibe'],
                        'parcial' => $k === 0
                            ? ['Aprobada', null, 'se entrega parcialmente']
                            : ['Rechazada', 'Producto agotado en bodega', 'el producto no llegó en el despacho'],
                    };

                    $filas[] = [
                        'Nombre Plan' => $plan,
                        'Fecha Plan' => $fecha->toDateString(),
                        'Grupo de Flota' => 'HD CALI',
                        'Código del Vehículo' => $ruta['placa'],
                        'Descripción del Vehículo' => $ruta['vehiculo'],
                        'Número de Viaje' => 1,
                        'ETA aprobado' => $hora->format('H:i'),
                        'Odómetro' => mt_rand(150, 32000) / 10,
                        'Código de Dirección' => $np,
                        'Código de Orden' => $np,
                        'Cliente' => $ruta['cliente'],
                        'Nombre de Contacto' => $contactos[array_rand($contactos)],
                        'Dirección' => 'CALLE '.mt_rand(1, 80).' # '.mt_rand(1, 120).' - '.mt_rand(1, 99),
                        'Ciudad' => $ciudad,
                        'Provincia' => $provincia,
                        'País' => 'Colombia',
                        'Latitud' => 3.3 + mt_rand(0, 2000) / 10000,
                        'Longitud' => -76.5 - mt_rand(0, 900) / 10000,
                        'Descripción del Item' => $ruta['productos'][array_rand($ruta['productos'])],
                        'Unidades Entregadas' => $estado === 'Aprobada' ? mt_rand(1, 2) : 0,
                        'Estado de la orden' => $estado,
                        'Motivo' => $motivoFila,
                        'Hora de Entrega' => $estado === 'Aprobada' ? $hora->format('Y-m-d H:i:s') : null,
                        'Comentario PoE' => $comentario,
                        'Conductor' => $ruta['conductor'],
                        'Asistente' => $ruta['asistente'],
                        'Comentario general de la ruta' => $i === 0 && $k === 0 ? 'finalizó ruta sin novedad' : null,
                    ];
                }
            }
        }

        // Dos filas con errores que la revisión debe reportar y omitir
        $filas[] = [...$filas[0], 'Código de Dirección' => null, 'Código de Orden' => null, 'Descripción del Item' => 'SILLA AUXILIAR PRAGA PLASTICO NEGRO'];
        $filas[] = [...$filas[1], 'Código de Dirección' => 'PDVT000'.$codigo, 'Código de Orden' => 'PDVT000'.$codigo, 'Estado de la orden' => 'En validación'];

        $ruta = storage_path('app/ejemplos/Preliquidacion_'.$fecha->toDateString().'.xlsx');
        $generador->escribir($ruta, $filas);

        $this->components->info('Preliquidación de ejemplo generada ('.count($filas).' filas, operación del '.$fecha->toDateString().').');
        $this->line('  '.$ruta);

        return self::SUCCESS;
    }

    private function jornadaAnterior(): Carbon
    {
        $f = today()->subDay();

        return $f->isSunday() ? $f->subDay() : $f;
    }
}
