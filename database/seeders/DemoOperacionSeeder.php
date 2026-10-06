<?php

namespace Database\Seeders;

use App\Enums\CargoEmpleado;
use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Enums\TipoAccion;
use App\Models\AccionDesempeno;
use App\Models\AuditoriaPod;
use App\Models\Carga;
use App\Models\Cliente;
use App\Models\Empleado;
use App\Models\MotivoRechazo;
use App\Models\Programacion;
use App\Models\TipoNovedad;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\ConsolidadorInforme;
use Faker\Factory as Faker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Operación simulada de ~7 meses (alcanza para comparar periodos de 90 días) para ver el CRM y el dashboard con datos realistas.
 * Solo para desarrollo: php artisan db:seed --class=DemoOperacionSeeder
 */
class DemoOperacionSeeder extends Seeder
{
    private const DIAS = 200;

    public function run(ConsolidadorInforme $consolidador): void
    {
        $faker = Faker::create('es_CO');
        mt_srand(20261006);
        $faker->seed(20261006);

        $this->asegurarPersonalYFlota();

        $auxiliares = Empleado::where('cargo', CargoEmpleado::Auxiliar)->get()->values();
        $vehiculos = Vehiculo::all()->values();
        $motivos = MotivoRechazo::pluck('id', 'nombre');
        $novedades = TipoNovedad::pluck('id', 'nombre');
        $coordinador = User::where('rol', 'coordinador')->first();

        // Perfil de cada auxiliar: probabilidad de entrega y rigor con las fotos
        $perfil = $auxiliares->mapWithKeys(fn ($e) => [$e->id => [
            'entrega' => mt_rand(78, 98) / 100,
            'rigor' => mt_rand(55, 97) / 100,
        ]]);

        $sedes = Cliente::with('sedes')->get()->flatMap(fn ($c) => $c->sedes->map(fn ($s) => [$c, $s]));

        $pesosMotivo = [
            'Cliente reprograma fecha de entrega' => 34,
            'Cliente ausente en domicilio' => 24,
            'Cliente no contesta llamadas' => 19,
            'Dirección errada o incompleta' => 8,
            'Cliente rechaza el producto' => 6,
            'Producto averiado' => 3,
            'Producto incompleto / faltante' => 3,
            'No alcanzó tiempo en ruta' => 3,
        ];

        $hoy = today();
        $consecutivo = 28000;

        // La jornada anterior queda sin cargar a propósito: se prueba con php artisan drivin:ejemplo
        $pendiente = $hoy->copy()->subDay();
        if ($pendiente->isSunday()) {
            $pendiente->subDay();
        }

        for ($d = self::DIAS; $d >= 1; $d--) {
            $fecha = $hoy->copy()->subDays($d);
            if ($fecha->isSunday() || $fecha->isSameDay($pendiente)) {
                continue;
            }

            $carga = Carga::create([
                'archivo_nombre' => 'Preliquidacion_'.$fecha->format('Y-m-d').'.xlsx',
                'archivo_path' => 'cargas/demo/'.$fecha->format('Ymd').'.xlsx',
                'archivo_hash' => hash('sha256', 'demo'.$fecha->toDateString()),
                'fecha_operacion' => $fecha,
                'estado' => EstadoCarga::Procesada,
                'cargado_por' => $coordinador?->id,
                'procesado_en' => $fecha->copy()->addDay()->setTime(8, mt_rand(0, 50)),
                'duracion_ms' => mt_rand(600, 2400),
            ]);

            $disponibles = $auxiliares->shuffle()->values();
            $flota = $vehiculos->shuffle()->values();
            $iAux = 0;
            $filas = [];
            $auditorias = [];

            foreach ($sedes as [$cliente, $sede]) {
                $rutas = mt_rand(1, 2);
                if ($sede->nombre === 'Cañasgordas' && mt_rand(0, 1)) {
                    continue; // no se opera todos los días en esta sede
                }

                Programacion::updateOrCreate(
                    ['fecha' => $fecha->toDateString(), 'cliente_id' => $cliente->id, 'sede_id' => $sede->id],
                    ['auxiliares_requeridos' => $rutas + mt_rand(0, 1), 'vehiculos_requeridos' => $rutas],
                );

                for ($r = 0; $r < $rutas && $iAux < $disponibles->count(); $r++, $iAux++) {
                    $aux = $disponibles[$iAux];
                    $veh = $flota[$iAux % $flota->count()];
                    $p = $perfil[$aux->id];
                    $ruta = strtoupper($sede->alias_drivin ?? $sede->nombre).' '.$fecha->format('j-n-Y');
                    // Los sábados la jornada es más corta
                    $tareas = $fecha->isSaturday() ? mt_rand(4, 10) : mt_rand(7, 20);

                    for ($t = 0; $t < $tareas; $t++) {
                        $aprobada = mt_rand() / mt_getrandmax() < $p['entrega'];
                        $motivo = $aprobada ? null : $this->ponderado($pesosMotivo);
                        $codigo = 'PDVT000'.$consecutivo++;

                        $filas[] = [
                            'carga_id' => $carga->id,
                            'fecha_operacion' => $fecha->toDateString(),
                            'cliente_id' => $cliente->id,
                            'sede_id' => $sede->id,
                            'ruta' => $ruta,
                            'vehiculo_id' => $veh->id,
                            'placa' => $veh->placa,
                            'empleado_id' => $aux->id,
                            'auxiliar_nombre' => strtoupper($aux->nombre_completo),
                            'codigo_orden' => $codigo,
                            'codigo_direccion' => $codigo,
                            'destinatario' => $faker->name(),
                            'direccion' => $faker->streetAddress(),
                            'ciudad' => $sede->ciudad,
                            'unidades' => mt_rand(1, 4),
                            'estado' => ($aprobada ? EstadoOrden::Aprobada : EstadoOrden::Rechazada)->value,
                            'motivo_rechazo_id' => $motivo ? $motivos[$motivo] : null,
                            'motivo_texto' => $motivo,
                            'comentario_pod' => $aprobada ? 'entrega exitosa' : 'Se llama al cliente para confirmar entrega',
                            'hora_entrega' => $fecha->copy()->setTime(mt_rand(8, 17), mt_rand(0, 59))->toDateTimeString(),
                            'devolucion' => ! $aprobada,
                            'averia' => $motivo === 'Producto averiado',
                            'averia_detalle' => $motivo === 'Producto averiado' ? 'Rayón en superficie al destapar' : null,
                            'faltante' => $aprobada && mt_rand(1, 100) <= 2,
                            'faltante_detalle' => null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];

                        // Los dos últimos días quedan pendientes de auditoría (estado "Seguimiento")
                        if ($aprobada && $d > 2 && mt_rand(1, 100) <= 88) {
                            $auditorias[$codigo] = $this->auditoriaSimulada($p['rigor'], $novedades, $coordinador?->id, $fecha);
                        }
                    }
                }
            }

            DB::table('ordenes')->insert($filas);

            $ids = DB::table('ordenes')->where('carga_id', $carga->id)->pluck('id', 'codigo_orden');
            $filasAuditoria = [];
            foreach ($auditorias as $codigo => $a) {
                $filasAuditoria[] = ['orden_id' => $ids[$codigo]] + $a;
            }
            DB::table('auditorias_pod')->insert($filasAuditoria);

            $carga->update(['total_filas' => count($filas), 'filas_validas' => count($filas), 'ordenes_importadas' => count($filas), 'hoja' => 'PoE']);

            foreach ($consolidador->consolidarFecha($fecha) as $informe) {
                $estado = $d > 2 ? EstadoInforme::Cerrado : EstadoInforme::Seguimiento;
                $informe->update([
                    'estado' => $estado,
                    'cerrado_por' => $estado === EstadoInforme::Cerrado ? $coordinador?->id : null,
                    'cerrado_en' => $estado === EstadoInforme::Cerrado ? $fecha->copy()->addDay()->setTime(10, 0) : null,
                ]);

                if ($d > 2) {
                    $this->registrarAcciones($informe, $coordinador?->id);
                }
            }
        }
    }

    private function asegurarPersonalYFlota(): void
    {
        $extra = [
            ['1000000007', 'Jhon Fredy', 'Cárdenas'],
            ['1000000008', 'Luis Miguel', 'Ospina'],
            ['1000000009', 'Brayan', 'Castillo'],
            ['1000000010', 'Kevin Andrés', 'Muñoz'],
            ['1000000011', 'Diego Alejandro', 'Ríos'],
            ['1000000012', 'Sebastián', 'Valencia'],
        ];

        foreach ($extra as [$cedula, $nombres, $apellidos]) {
            Empleado::updateOrCreate(['cedula' => $cedula], [
                'nombres' => $nombres, 'apellidos' => $apellidos,
                'cargo' => CargoEmpleado::Auxiliar, 'activo' => true,
                'fecha_ingreso' => Carbon::parse('2025-01-15')->addDays(mt_rand(0, 400)),
            ]);
        }

        foreach (['WMK412' => 'NHR', 'GTS531' => 'Furgón', 'JKP903' => 'Turbo'] as $placa => $tipo) {
            Vehiculo::updateOrCreate(['placa' => $placa], ['tipo' => $tipo]);
        }
    }

    private function auditoriaSimulada(float $rigor, $novedades, ?int $auditor, Carbon $fecha): array
    {
        $cumpleTodo = mt_rand() / mt_getrandmax() < $rigor;
        $sinEvidencia = ! $cumpleTodo && mt_rand(1, 100) <= 12;
        $sinDestapar = mt_rand(1, 100) <= 15;

        $a = new AuditoriaPod([
            'foto_fachada' => $cumpleTodo || mt_rand(0, 1),
            'fotos_sellado' => $sinEvidencia ? 0 : ($cumpleTodo ? mt_rand(4, 6) : mt_rand(1, 4)),
            'fotos_destapado' => $sinEvidencia || $sinDestapar ? 0 : ($cumpleTodo ? mt_rand(4, 6) : mt_rand(0, 4)),
            'foto_remesa' => ! $sinEvidencia && ($cumpleTodo || mt_rand(0, 1)),
            'foto_rotulo' => (bool) mt_rand(0, 1),
            'recibe_sin_destapar' => $sinDestapar && ! $sinEvidencia,
            'sin_evidencia' => $sinEvidencia,
        ]);
        $cumple = $a->evaluarProtocolo();

        $novedad = match (true) {
            $sinEvidencia => 'Sin evidencia',
            $cumple && $a->recibe_sin_destapar => 'Entregado sin destapar con nota en remesa',
            $cumple => mt_rand(0, 3) ? 'Buen protocolo de entrega' : 'Buen protocolo de entrega pero puede mejorar',
            ! $a->foto_fachada && ! $a->foto_remesa => 'Falta foto de fachada y remesa firmada',
            ! $a->foto_remesa => 'Falta remesa firmada',
            ! $a->foto_fachada => 'Falta foto de fachada',
            $a->fotos_sellado < 4 => 'Faltan fotos de producto sellado',
            default => 'Faltan fotos de producto destapado',
        };

        return [
            'foto_fachada' => $a->foto_fachada,
            'fotos_sellado' => $a->fotos_sellado,
            'fotos_destapado' => $a->fotos_destapado,
            'foto_remesa' => $a->foto_remesa,
            'foto_rotulo' => $a->foto_rotulo,
            'recibe_sin_destapar' => $a->recibe_sin_destapar,
            'sin_evidencia' => $sinEvidencia,
            'cumple_protocolo' => $cumple,
            'tipo_novedad_id' => $novedades[$novedad] ?? null,
            'concepto' => $novedad,
            'auditado_por' => $auditor,
            'auditado_en' => $fecha->copy()->addDay()->setTime(9, mt_rand(0, 59))->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function registrarAcciones($informe, ?int $usuario): void
    {
        foreach ($informe->lineas as $linea) {
            if (! $linea->empleado_id) {
                continue;
            }

            $tipo = match (true) {
                $linea->efectividad >= 100 && $linea->pod_cumple === true => TipoAccion::Felicitacion,
                $linea->efectividad < 70 || $linea->ordenes_sin_evidencia >= 2 => TipoAccion::LlamadoAtencion,
                $linea->pod_cumple === false => TipoAccion::Retroalimentacion,
                default => null,
            };

            // No todas las jornadas terminan en una acción formal
            if (! $tipo || mt_rand(1, 100) > 60) {
                continue;
            }

            AccionDesempeno::create([
                'empleado_id' => $linea->empleado_id,
                'informe_id' => $informe->id,
                'fecha' => $informe->fecha_operacion->copy()->addDay(),
                'tipo' => $tipo,
                'descripcion' => match ($tipo) {
                    TipoAccion::Felicitacion => 'Efectividad del 100% y protocolo de fotos completo.',
                    TipoAccion::Retroalimentacion => 'Se recuerda completar fotos de fachada, producto y remesa firmada.',
                    TipoAccion::LlamadoAtencion => 'Bajo cumplimiento en la jornada y entregas sin evidencia.',
                },
                'efectividad_referencia' => $linea->efectividad,
                'notificado' => true,
                'registrado_por' => $usuario,
            ]);
        }
    }

    /** @param array<string, int> $pesos */
    private function ponderado(array $pesos): string
    {
        $tiro = mt_rand(1, array_sum($pesos));
        foreach ($pesos as $valor => $peso) {
            if (($tiro -= $peso) <= 0) {
                return $valor;
            }
        }

        return array_key_first($pesos);
    }
}
