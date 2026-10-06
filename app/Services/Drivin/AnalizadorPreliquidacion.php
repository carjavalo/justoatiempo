<?php

namespace App\Services\Drivin;

use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Models\Cliente;
use App\Models\Empleado;
use App\Models\InformeDiario;
use App\Models\MotivoRechazo;
use App\Models\Orden;
use App\Models\Sede;
use App\Models\Vehiculo;
use App\Services\ConsolidadorInforme;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Shared\Date as FechaExcel;

/**
 * Convierte las filas de la preliquidación en órdenes listas para importar, sin escribir nada.
 *
 * Reglas:
 * - Drivin exporta una fila por producto: las filas con el mismo código y fecha forman una orden (RF-04).
 * - Orden con todos sus productos entregados = aprobada; ninguno = rechazada (RF-07: genera devolución);
 *   mezcla = aprobada con faltante (entrega parcial, p. ej. llegó el sofá pero no la mesa).
 * - Avería solo si el motivo reporta daño físico (RF-08).
 * - Cliente y sede salen del nombre del plan (alias Drivin de la sede), de la columna cliente o del valor por defecto.
 */
class AnalizadorPreliquidacion
{
    private const MAX_ERRORES_DETALLE = 300;

    private const ESTADOS = [
        'aprobada' => ['aprobada', 'aprobado', 'entregada', 'entregado', 'exitosa', 'exitoso', 'entrega exitosa', 'completada', 'completado', 'finalizada', 'realizada', 'ok'],
        'rechazada' => ['rechazada', 'rechazado', 'no entregada', 'no entregado', 'fallida', 'fallido', 'devuelta', 'devuelto', 'devolucion', 'cancelada', 'no exitosa', 'reprogramada'],
        'pendiente' => ['pendiente', 'en ruta', 'sin gestionar', 'por entregar', 'asignada', 'planificada', 'en curso'],
        'parcial' => ['parcial', 'entrega parcial', 'parcialmente entregada', 'entregada parcial'],
    ];

    private const PATRON_AVERIA = '/aver|danad|dano|roto|rota|rayad|rayon|golpe|quebrad|partid/';

    private const PATRON_FALTANTE = '/faltant|incomplet|parcial/';

    /** @var array<string, string> alias normalizado => estado */
    private array $estados = [];

    /** @var Collection<int, array{id: int, cliente_id: int, alias: string}> */
    private Collection $sedesPorAlias;

    /** @var Collection<int, Cliente> */
    private Collection $clientes;

    /** @var array<string, int> */
    private array $vehiculos = [];

    /** @var Collection<int, array{id: int, tokens: list<string>, nombre: string}> */
    private Collection $empleados;

    /** @var array<string, int> */
    private array $motivos = [];

    public function __construct()
    {
        foreach (self::ESTADOS as $estado => $alias) {
            foreach ($alias as $a) {
                $this->estados[$a] = $estado;
            }
        }
    }

    /**
     * @param  array{encabezados: array<int, string>, filas: list<array{fila: int, valores: array<int, mixed>}>}  $lectura
     * @param  array<string, int|null>  $mapeo
     * @param  array{cliente_id?: int|null, sede_id?: int|null}  $opciones
     */
    public function analizar(array $lectura, array $mapeo, array $opciones = []): array
    {
        $faltantes = array_values(array_filter(MapeoColumnas::obligatorios(), fn ($c) => ($mapeo[$c] ?? null) === null));

        $base = [
            'columnasFaltantes' => $faltantes,
            'filasLeidas' => count($lectura['filas']),
            'ordenes' => [],
            'errores' => [],
            'totalErrores' => 0,
            'filasConError' => 0,
            'advertencias' => [],
            'totalAdvertencias' => 0,
            'fechas' => [],
            'grupos' => [],
            'totales' => ['ordenes' => 0, 'aprobadas' => 0, 'rechazadas' => 0, 'pendientes' => 0, 'faltantes' => 0, 'averias' => 0, 'efectividad' => 0.0],
        ];

        if ($faltantes !== []) {
            return $base;
        }

        $this->cargarMaestros();

        $errores = [];
        $filasConError = [];
        $avisos = ['vehiculos' => [], 'auxiliares' => [], 'motivos' => [], 'sinAuxiliar' => 0, 'sinPlaca' => 0, 'clientePorDefecto' => 0];
        $ordenes = [];

        $valor = function (array $valores, string $campo) use ($mapeo) {
            $i = $mapeo[$campo] ?? null;
            if ($i === null) {
                return null;
            }
            $v = $valores[$i] ?? null;

            return is_string($v) ? trim($v) : $v;
        };

        $error = function (int $fila, string $campo, string $mensaje, $v = null) use (&$errores, &$filasConError) {
            $filasConError[$fila] = true;
            $errores[] = ['fila' => $fila, 'campo' => MapeoColumnas::CAMPOS[$campo][0] ?? $campo, 'mensaje' => $mensaje, 'valor' => $v === null ? null : (string) $v];
        };

        foreach ($lectura['filas'] as ['fila' => $fila, 'valores' => $valores]) {
            $fecha = $this->fecha($valor($valores, 'fecha'));
            $codigo = (string) ($valor($valores, 'codigo_orden') ?? '');
            $estadoTexto = MapeoColumnas::normalizar((string) $valor($valores, 'estado'));
            $estado = $this->estados[$estadoTexto] ?? null;

            if (! $fecha) {
                $error($fila, 'fecha', 'Fecha vacía o con un formato no reconocido.', $valor($valores, 'fecha'));
                continue;
            }
            if ($codigo === '') {
                $error($fila, 'codigo_orden', 'La fila no tiene código de orden (NP).');
                continue;
            }
            if (! $estado) {
                $error($fila, 'estado', $estadoTexto === '' ? 'La fila no tiene estado.' : 'Estado no reconocido: debe ser aprobada, rechazada, pendiente o parcial.', $valor($valores, 'estado'));
                continue;
            }

            $ruta = $valor($valores, 'ruta');
            [$clienteId, $sedeId, $porDefecto] = $this->resolverClienteSede($ruta, $valor($valores, 'cliente'), $valor($valores, 'ciudad'), $opciones);
            if (! $clienteId) {
                $error($fila, 'cliente', 'No se pudo identificar el cliente ni la sede. Elige un cliente por defecto en la revisión.', $ruta ?? $valor($valores, 'cliente'));
                continue;
            }

            $clave = $fecha.'|'.$codigo;
            $producto = $valor($valores, 'producto');
            $unidades = is_numeric($valor($valores, 'unidades')) ? (int) $valor($valores, 'unidades') : null;
            $motivo = $valor($valores, 'motivo');

            if (! isset($ordenes[$clave])) {
                $placaCruda = $valor($valores, 'placa');
                $auxiliarCrudo = $valor($valores, 'auxiliar');

                $ordenes[$clave] = [
                    'fila' => $fila,
                    'fecha_operacion' => $fecha,
                    'cliente_id' => $clienteId,
                    'sede_id' => $sedeId,
                    'cliente_por_defecto' => $porDefecto,
                    'ruta' => $ruta ? mb_substr((string) $ruta, 0, 150) : null,
                    'placa' => Vehiculo::normalizarPlaca($placaCruda ? (string) $placaCruda : null),
                    'auxiliar_nombre' => $auxiliarCrudo ? mb_substr(trim((string) $auxiliarCrudo), 0, 150) : null,
                    'codigo_orden' => mb_substr($codigo, 0, 60),
                    'codigo_direccion' => ($cd = $valor($valores, 'codigo_direccion')) ? mb_substr((string) $cd, 0, 60) : null,
                    'destinatario' => ($d = $valor($valores, 'destinatario')) ? mb_substr((string) $d, 0, 150) : null,
                    'direccion' => ($d = $valor($valores, 'direccion')) ? mb_substr((string) $d, 0, 255) : null,
                    'ciudad' => ($c = $valor($valores, 'ciudad')) ? mb_substr((string) $c, 0, 80) : null,
                    'hora_entrega' => $this->fechaHora($valor($valores, 'hora_entrega'), $fecha),
                    'comentario_pod' => ($c = $valor($valores, 'comentario_pod')) ? (string) $c : null,
                    'conductor' => $valor($valores, 'conductor'),
                    'estados' => [],
                    'motivos' => [],
                    'productos' => [],
                    'unidades' => null,
                ];
            }

            $o = &$ordenes[$clave];
            $o['estados'][] = $estado;
            if ($motivo) {
                $o['motivos'][] = (string) $motivo;
            }
            if ($producto) {
                $o['productos'][] = ['producto' => (string) $producto, 'estado' => $estado, 'unidades' => $unidades];
            }
            if ($unidades !== null) {
                $o['unidades'] = ($o['unidades'] ?? 0) + $unidades;
            }
            unset($o);
        }

        // Órdenes ya importadas en otra carga y jornadas con informe cerrado
        $existentes = $this->ordenesExistentes($ordenes);
        $cerrados = $this->informesCerrados($ordenes);

        $finales = [];
        foreach ($ordenes as $clave => $o) {
            if (isset($existentes[$clave])) {
                $error($o['fila'], 'codigo_orden', "La orden {$o['codigo_orden']} del {$o['fecha_operacion']} ya fue importada (carga #{$existentes[$clave]}).", $o['codigo_orden']);
                continue;
            }
            if (isset($cerrados[$o['fecha_operacion'].'|'.$o['cliente_id'].'|'.($o['sede_id'] ?? '')])) {
                $error($o['fila'], 'fecha', 'El informe de esa jornada ya está cerrado y no admite nuevas órdenes.', $o['fecha_operacion']);
                continue;
            }

            $finales[] = $this->cerrarOrden($o, $avisos);
        }

        return [
            ...$base,
            'ordenes' => $finales,
            'errores' => array_slice($errores, 0, self::MAX_ERRORES_DETALLE),
            'totalErrores' => count($errores),
            'filasConError' => count($filasConError),
            'advertencias' => $this->formatearAvisos($avisos),
            'totalAdvertencias' => count($avisos['vehiculos']) + count($avisos['auxiliares']) + count($avisos['motivos'])
                + ($avisos['sinAuxiliar'] ? 1 : 0) + ($avisos['sinPlaca'] ? 1 : 0) + ($avisos['clientePorDefecto'] ? 1 : 0),
            'fechas' => collect($finales)->countBy('fecha_operacion')->sortKeys()->all(),
            'grupos' => $this->grupos($finales),
            'totales' => $this->totales($finales),
        ];
    }

    /** Aplica las reglas de estado, avería y faltante a una orden ya agrupada. */
    private function cerrarOrden(array $o, array &$avisos): array
    {
        $estados = array_unique($o['estados']);
        $hayEntrega = (bool) array_intersect($estados, ['aprobada', 'parcial']);
        $hayNoEntrega = (bool) array_intersect($estados, ['rechazada', 'pendiente']);
        $motivo = $o['motivos'][0] ?? null;
        $motivoNorm = MapeoColumnas::normalizar($motivo);

        $estado = match (true) {
            $hayEntrega => EstadoOrden::Aprobada,
            in_array('rechazada', $estados, true) => EstadoOrden::Rechazada,
            default => EstadoOrden::Pendiente,
        };

        $faltante = $hayEntrega && ($hayNoEntrega || in_array('parcial', $estados, true) || ($motivoNorm !== '' && preg_match(self::PATRON_FALTANTE, $motivoNorm)));
        $averia = $motivoNorm !== '' && (bool) preg_match(self::PATRON_AVERIA, $motivoNorm);

        $noEntregados = collect($o['productos'])->whereIn('estado', ['rechazada', 'pendiente'])->pluck('producto')->unique()->values();

        $vehiculoId = $o['placa'] ? ($this->vehiculos[$o['placa']] ?? null) : null;
        if (! $o['placa']) {
            $avisos['sinPlaca']++;
        } elseif (! $vehiculoId) {
            $avisos['vehiculos'][$o['placa']] = ($avisos['vehiculos'][$o['placa']] ?? 0) + 1;
        }

        $empleadoId = $o['auxiliar_nombre'] ? $this->resolverEmpleado($o['auxiliar_nombre']) : null;
        if (! $o['auxiliar_nombre']) {
            $avisos['sinAuxiliar']++;
        } elseif (! $empleadoId) {
            $avisos['auxiliares'][$o['auxiliar_nombre']] = ($avisos['auxiliares'][$o['auxiliar_nombre']] ?? 0) + 1;
        }

        $motivoId = null;
        if ($estado !== EstadoOrden::Aprobada && $motivo) {
            $motivoId = $this->motivos[$motivoNorm] ?? null;
            if (! $motivoId) {
                $avisos['motivos'][$motivo] = ($avisos['motivos'][$motivo] ?? 0) + 1;
            }
        }

        if ($o['cliente_por_defecto']) {
            $avisos['clientePorDefecto']++;
        }

        return [
            'fila' => $o['fila'],
            'fecha_operacion' => $o['fecha_operacion'],
            'cliente_id' => $o['cliente_id'],
            'sede_id' => $o['sede_id'],
            'ruta' => $o['ruta'],
            'vehiculo_id' => $vehiculoId,
            'placa' => $o['placa'] ? mb_substr($o['placa'], 0, 10) : null,
            'empleado_id' => $empleadoId,
            'auxiliar_nombre' => $o['auxiliar_nombre'],
            'codigo_orden' => $o['codigo_orden'],
            'codigo_direccion' => $o['codigo_direccion'],
            'destinatario' => $o['destinatario'],
            'direccion' => $o['direccion'],
            'ciudad' => $o['ciudad'],
            'unidades' => $o['unidades'],
            'estado' => $estado->value,
            'motivo_rechazo_id' => $motivoId,
            'motivo_texto' => $motivo ? mb_substr($motivo, 0, 255) : null,
            'comentario_pod' => $o['comentario_pod'],
            'hora_entrega' => $o['hora_entrega'],
            'devolucion' => $estado === EstadoOrden::Rechazada,
            'averia' => $averia,
            'averia_detalle' => $averia ? mb_substr($motivo, 0, 255) : null,
            'faltante' => $faltante,
            'faltante_detalle' => $faltante && $noEntregados->isNotEmpty() ? mb_substr('No entregado: '.$noEntregados->implode(', '), 0, 255) : null,
            'datos_crudos' => [
                'productos' => $o['productos'],
                'conductor' => $o['conductor'],
            ],
        ];
    }

    private function cargarMaestros(): void
    {
        $this->sedesPorAlias = Sede::query()
            ->whereNotNull('alias_drivin')
            ->get(['id', 'cliente_id', 'alias_drivin'])
            ->map(fn (Sede $s) => ['id' => $s->id, 'cliente_id' => $s->cliente_id, 'alias' => MapeoColumnas::normalizar($s->alias_drivin)])
            ->filter(fn ($s) => $s['alias'] !== '')
            ->sortByDesc(fn ($s) => strlen($s['alias'])) // el alias más específico gana
            ->values();

        $this->clientes = Cliente::with('sedes:id,cliente_id,nombre,ciudad,activo')->get();

        foreach (Vehiculo::get(['id', 'placa', 'codigo_interno']) as $v) {
            $this->vehiculos[$v->placa] = $v->id;
            if ($v->codigo_interno) {
                $this->vehiculos[Vehiculo::normalizarPlaca($v->codigo_interno)] ??= $v->id;
            }
        }

        $this->empleados = Empleado::where('activo', true)->get(['id', 'nombres', 'apellidos'])->map(fn (Empleado $e) => [
            'id' => $e->id,
            'nombre' => MapeoColumnas::normalizar($e->nombres.' '.$e->apellidos),
            'tokens' => array_values(array_filter(explode(' ', MapeoColumnas::normalizar($e->nombres.' '.$e->apellidos)))),
        ]);

        foreach (MotivoRechazo::get(['id', 'nombre']) as $m) {
            $this->motivos[MapeoColumnas::normalizar($m->nombre)] = $m->id;
        }
    }

    /** @return array{0: int|null, 1: int|null, 2: bool} cliente, sede y si se usó el valor por defecto */
    private function resolverClienteSede(mixed $ruta, mixed $cliente, mixed $ciudad, array $opciones): array
    {
        $rutaNorm = MapeoColumnas::normalizar((string) $ruta);
        if ($rutaNorm !== '') {
            foreach ($this->sedesPorAlias as $s) {
                if ($rutaNorm === $s['alias'] || str_starts_with($rutaNorm, $s['alias'].' ')) {
                    return [$s['cliente_id'], $s['id'], false];
                }
            }
        }

        $clienteNorm = MapeoColumnas::normalizar((string) $cliente);
        if ($clienteNorm !== '') {
            $c = $this->clientes->first(fn (Cliente $c) => in_array($clienteNorm, [MapeoColumnas::normalizar($c->nombre), MapeoColumnas::normalizar($c->codigo)], true));
            if ($c) {
                $activas = $c->sedes->where('activo', true);
                $ciudadNorm = MapeoColumnas::normalizar((string) $ciudad);
                $sede = $activas->count() === 1
                    ? $activas->first()
                    : $activas->filter(fn ($s) => $ciudadNorm !== '' && MapeoColumnas::normalizar($s->ciudad) === $ciudadNorm)->sole(fn () => true) ?? null;

                return [$c->id, $sede?->id, false];
            }
        }

        if (! empty($opciones['cliente_id'])) {
            return [(int) $opciones['cliente_id'], ! empty($opciones['sede_id']) ? (int) $opciones['sede_id'] : null, true];
        }

        return [null, null, false];
    }

    /**
     * El nombre del archivo suele traer los dos apellidos ("CRISTIAN ALEJANDRO APONZA MINA")
     * y el maestro uno solo: hay coincidencia si todas las palabras del empleado están en el nombre del archivo.
     */
    private function resolverEmpleado(string $nombre): ?int
    {
        // Si vienen varios asistentes separados ("A / B", "A, B"), se toma el primero
        $principal = preg_split('/\s*(?:[,;\/|]|\sy\s)\s*/i', $nombre)[0] ?? $nombre;
        $norm = MapeoColumnas::normalizar($principal);
        $tokens = array_flip(explode(' ', $norm));

        $exacto = $this->empleados->firstWhere('nombre', $norm);
        if ($exacto) {
            return $exacto['id'];
        }

        $candidatos = $this->empleados
            ->filter(fn ($e) => count($e['tokens']) >= 2 && collect($e['tokens'])->every(fn ($t) => isset($tokens[$t])))
            ->sortByDesc(fn ($e) => count($e['tokens']))
            ->values();

        if ($candidatos->isEmpty()) {
            return null;
        }

        // Dos empleados igual de específicos = ambiguo: mejor no asignar
        if ($candidatos->count() > 1 && count($candidatos[0]['tokens']) === count($candidatos[1]['tokens'])) {
            return null;
        }

        return $candidatos[0]['id'];
    }

    private function fecha(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        if (is_numeric($v) && (float) $v > 20000 && (float) $v < 80000) {
            return Carbon::instance(FechaExcel::excelToDateTimeObject((float) $v))->toDateString();
        }

        $texto = trim((string) $v);
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd.m.Y', 'Y-m-d H:i:s', 'Y-m-d H:i', 'd/m/Y H:i:s', 'd/m/Y H:i'] as $formato) {
            $f = \DateTime::createFromFormat('!'.$formato, $texto);
            $errores = \DateTime::getLastErrors();
            if ($f && (! $errores || ($errores['warning_count'] === 0 && $errores['error_count'] === 0))) {
                return $f->format('Y-m-d');
            }
        }

        return null;
    }

    private function fechaHora(mixed $v, string $fecha): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        if (is_numeric($v)) {
            $n = (float) $v;
            if ($n > 20000) {
                return Carbon::instance(FechaExcel::excelToDateTimeObject($n))->toDateTimeString();
            }
            if ($n >= 0 && $n < 1) { // solo hora como fracción del día
                return Carbon::parse($fecha)->addSeconds((int) round($n * 86400))->toDateTimeString();
            }

            return null;
        }

        $texto = trim((string) $v);
        if (preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $texto)) {
            return Carbon::parse($fecha.' '.$texto)->toDateTimeString();
        }

        try {
            return Carbon::parse($texto)->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array<string, int> clave fecha|codigo => id de la carga que ya la importó */
    private function ordenesExistentes(array $ordenes): array
    {
        if ($ordenes === []) {
            return [];
        }

        $codigos = array_unique(array_column($ordenes, 'codigo_orden'));
        $fechas = array_unique(array_column($ordenes, 'fecha_operacion'));

        $existentes = [];
        foreach (array_chunk($codigos, 1000) as $lote) {
            Orden::query()
                ->whereIn('codigo_orden', $lote)
                ->whereIn('fecha_operacion', $fechas)
                ->get(['codigo_orden', 'fecha_operacion', 'carga_id'])
                ->each(function (Orden $o) use (&$existentes) {
                    $existentes[$o->fecha_operacion->toDateString().'|'.$o->codigo_orden] = $o->carga_id;
                });
        }

        return $existentes;
    }

    /** @return array<string, true> */
    private function informesCerrados(array $ordenes): array
    {
        $fechas = array_unique(array_column($ordenes, 'fecha_operacion'));
        if ($fechas === []) {
            return [];
        }

        return InformeDiario::query()
            ->where('estado', EstadoInforme::Cerrado)
            ->whereIn('fecha_operacion', $fechas)
            ->get(['fecha_operacion', 'cliente_id', 'sede_id'])
            ->mapWithKeys(fn ($i) => [$i->fecha_operacion->toDateString().'|'.$i->cliente_id.'|'.($i->sede_id ?? '') => true])
            ->all();
    }

    private function formatearAvisos(array $a): array
    {
        $lista = [];
        $top = fn (array $conteos) => collect($conteos)->sortDesc()->map(fn ($n, $k) => ['valor' => (string) $k, 'ordenes' => $n])->values()->all();

        if ($a['vehiculos']) {
            $lista[] = ['tipo' => 'vehiculos', 'titulo' => 'Vehículos no registrados en la flota', 'detalle' => 'Se importan con la placa del archivo. Regístralos en Flota para verlos en los reportes por vehículo.', 'items' => $top($a['vehiculos'])];
        }
        if ($a['auxiliares']) {
            $lista[] = ['tipo' => 'auxiliares', 'titulo' => 'Auxiliares no reconocidos', 'detalle' => 'Se importan con el nombre del archivo, pero no suman al historial del empleado hasta que exista en Empleados con ese nombre.', 'items' => $top($a['auxiliares'])];
        }
        if ($a['motivos']) {
            $lista[] = ['tipo' => 'motivos', 'titulo' => 'Motivos de rechazo fuera del catálogo', 'detalle' => 'Se guardan como texto libre.', 'items' => $top($a['motivos'])];
        }
        if ($a['sinAuxiliar']) {
            $lista[] = ['tipo' => 'sin_auxiliar', 'titulo' => 'Órdenes sin auxiliar', 'detalle' => "{$a['sinAuxiliar']} órdenes no indican el asistente del conductor.", 'items' => []];
        }
        if ($a['sinPlaca']) {
            $lista[] = ['tipo' => 'sin_placa', 'titulo' => 'Órdenes sin vehículo', 'detalle' => "{$a['sinPlaca']} órdenes no indican la placa.", 'items' => []];
        }
        if ($a['clientePorDefecto']) {
            $lista[] = ['tipo' => 'cliente_defecto', 'titulo' => 'Cliente asignado por defecto', 'detalle' => "{$a['clientePorDefecto']} órdenes no traían un plan o cliente reconocible y se asignaron al cliente por defecto elegido.", 'items' => []];
        }

        return $lista;
    }

    /** Vista previa del informe: fecha > cliente > sede > ruta > placa > auxiliar (RF-05). */
    private function grupos(array $ordenes): array
    {
        $nombresClientes = $this->clientes->pluck('nombre', 'id');
        $nombresSedes = $this->clientes->flatMap->sedes->pluck('nombre', 'id');

        return collect($ordenes)
            ->groupBy(fn ($o) => implode('|', [$o['fecha_operacion'], $o['cliente_id'], $o['sede_id'], $o['ruta'], $o['placa'], $o['auxiliar_nombre']]))
            ->map(function (Collection $g) use ($nombresClientes, $nombresSedes) {
                $p = $g->first();
                $aprobadas = $g->where('estado', 'aprobada')->count();

                return [
                    'fecha' => $p['fecha_operacion'],
                    'cliente' => $nombresClientes[$p['cliente_id']] ?? '—',
                    'sede' => $p['sede_id'] ? ($nombresSedes[$p['sede_id']] ?? null) : null,
                    'ruta' => $p['ruta'],
                    'placa' => $p['placa'],
                    'vehiculoRegistrado' => $p['vehiculo_id'] !== null,
                    'auxiliar' => $p['auxiliar_nombre'],
                    'auxiliarReconocido' => $p['empleado_id'] !== null,
                    'asignadas' => $g->count(),
                    'aprobadas' => $aprobadas,
                    'rechazadas' => $g->where('estado', 'rechazada')->count(),
                    'faltantes' => $g->where('faltante', true)->count(),
                    'averias' => $g->where('averia', true)->count(),
                    'efectividad' => ConsolidadorInforme::efectividad($aprobadas, $g->count()),
                ];
            })
            ->sortBy([['fecha', 'asc'], ['cliente', 'asc'], ['sede', 'asc'], ['auxiliar', 'asc']])
            ->values()
            ->all();
    }

    private function totales(array $ordenes): array
    {
        $c = collect($ordenes);
        $aprobadas = $c->where('estado', 'aprobada')->count();

        return [
            'ordenes' => $c->count(),
            'aprobadas' => $aprobadas,
            'rechazadas' => $c->where('estado', 'rechazada')->count(),
            'pendientes' => $c->where('estado', 'pendiente')->count(),
            'faltantes' => $c->where('faltante', true)->count(),
            'averias' => $c->where('averia', true)->count(),
            'efectividad' => ConsolidadorInforme::efectividad($aprobadas, $c->count()),
        ];
    }
}
