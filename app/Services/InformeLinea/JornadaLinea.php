<?php

namespace App\Services\InformeLinea;

use App\Enums\EstadoAsistencia;
use App\Models\NovedadLinea;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use App\Support\OperacionLinea;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Lo que pasó en una línea entre dos fechas, como lo muestran el informe diario y su Excel: cada lugar programado con
 * su personal, su asistencia y sus novedades, y las novedades de los lugares sin programación.
 */
class JornadaLinea
{
    /**
     * @return Collection<int, array{fecha: string, programacion: Programacion|null, lugar: string, requeridas: int, programadas: int, presentes: int, tarde: int, faltas: int, justificadas: int, sinRegistrar: int, cobertura: float|null, personas: Collection<int, ProgramacionAsignacion>, novedades: Collection<int, NovedadLinea>}>
     */
    public function lugares(OperacionLinea $op, Carbon $desde, Carbon $hasta): Collection
    {
        $programaciones = $op->filtrar(Programacion::query(), 'programaciones')
            ->where('linea_servicio_id', $op->linea->id)
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'asignaciones.persona:id,name,cedula,cargo'])
            ->get();
        $novedades = $this->novedades($op, $desde, $hasta);
        $clave = fn ($m) => $m->fecha->toDateString().'|'.OperacionLinea::clave($m->empresa_id, $m->sede_id, $m->sucursal_id);
        $porLugar = $novedades->groupBy($clave);

        $filas = $programaciones->map(function (Programacion $p) use ($porLugar, $clave) {
            $personas = $p->asignaciones->sortBy(fn ($a) => ($a->hora_entrada ?? '99').'|'.$a->persona?->name)->values();
            $estados = $personas->pluck('asistencia')->filter();
            $presentes = $estados->filter(fn (EstadoAsistencia $e) => $e->presente())->count();
            // Cobertura: cuántas de las personas requeridas estuvieron (o de las programadas, si no se dijo cuántas)
            $base = $p->personas_requeridas ?: $personas->count();

            return [
                'fecha' => $p->fecha->toDateString(),
                'programacion' => $p,
                'lugar' => $p->lugar(),
                'requeridas' => $p->personas_requeridas,
                'programadas' => $personas->count(),
                'presentes' => $presentes,
                'tarde' => $estados->filter(fn ($e) => $e === EstadoAsistencia::Tarde)->count(),
                'faltas' => $estados->filter(fn ($e) => $e === EstadoAsistencia::Falta)->count(),
                'justificadas' => $estados->filter(fn (EstadoAsistencia $e) => $e->justificada())->count(),
                'sinRegistrar' => $personas->whereNull('asistencia')->count(),
                'cobertura' => $base ? round(min(100, $presentes / $base * 100), 2) : null,
                'personas' => $personas,
                'novedades' => $porLugar[$clave($p)] ?? collect(),
            ];
        });

        // Novedades de lugares que ese día no tenían programación
        $programados = $programaciones->map($clave)->all();
        $sueltas = $novedades->reject(fn (NovedadLinea $n) => in_array($clave($n), $programados, true))
            ->groupBy($clave)
            ->map(fn (Collection $grupo) => [
                'fecha' => $grupo->first()->fecha->toDateString(),
                'programacion' => null,
                'lugar' => $grupo->first()->lugar(),
                'requeridas' => 0, 'programadas' => 0, 'presentes' => 0, 'tarde' => 0, 'faltas' => 0, 'justificadas' => 0, 'sinRegistrar' => 0,
                'cobertura' => null,
                'personas' => collect(),
                'novedades' => $grupo,
            ]);

        return $filas->concat($sueltas->values())->sortBy(fn ($f) => $f['fecha'].'|'.$f['lugar'])->values();
    }

    /** @return Collection<int, NovedadLinea> */
    public function novedades(OperacionLinea $op, Carbon $desde, Carbon $hasta): Collection
    {
        return $op->filtrar(NovedadLinea::query(), 'novedades_linea')
            ->where('linea_servicio_id', $op->linea->id)
            ->whereBetween('fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->with(['empresa:id,nombre', 'sede:id,nombre', 'sucursal:id,nombre', 'persona:id,name', 'registradaPor:id,name'])
            ->orderBy('fecha')->orderBy('id')
            ->get();
    }

    /**
     * El resumen de un día sin cargar personas ni novedades (para el inicio): lugares, requeridas, programadas,
     * presentes, sin registrar y la cobertura.
     *
     * @return array{lugares: int, requeridas: int, programadas: int, presentes: int, sinRegistrar: int, cobertura: float|null}
     */
    public function resumenDia(OperacionLinea $op, Carbon $dia): array
    {
        $lugares = $op->filtrar(Programacion::query(), 'programaciones')
            ->where('linea_servicio_id', $op->linea->id)
            ->whereDate('fecha', $dia)
            ->with('asignaciones:id,programacion_id,asistencia')
            ->get(['id', 'personas_requeridas'])
            ->map(fn (Programacion $p) => [
                'requeridas' => $p->personas_requeridas,
                'programadas' => $p->asignaciones->count(),
                'presentes' => $p->asignaciones->filter(fn ($a) => $a->asistencia?->presente())->count(),
                'sinRegistrar' => $p->asignaciones->whereNull('asistencia')->count(),
            ]);

        return [
            'lugares' => $lugares->count(),
            'requeridas' => $lugares->sum('requeridas'),
            'programadas' => $lugares->sum('programadas'),
            'presentes' => $lugares->sum('presentes'),
            'sinRegistrar' => $lugares->sum('sinRegistrar'),
            'cobertura' => self::cobertura($lugares),
        ];
    }

    /** Cobertura de un conjunto de lugares: presentes sobre requeridas (o programadas). */
    public static function cobertura(Collection $lugares): ?float
    {
        $base = $lugares->sum(fn ($l) => $l['requeridas'] ?: $l['programadas']);

        return $base ? round(min(100, $lugares->sum('presentes') / $base * 100), 2) : null;
    }
}
