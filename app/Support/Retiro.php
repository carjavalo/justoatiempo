<?php

namespace App\Support;

use App\Models\Asignacion;
use App\Models\LineaServicio;
use App\Models\Programacion;
use App\Models\ProgramacionAsignacion;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Lo que queda en orden cuando se elimina un lugar (empresa, sede, sucursal), una línea o una persona: nadie sigue
 * asignado ni programado ahí, y nada se borra.
 *
 * - Las asignaciones vigentes terminan ayer: siguen en el historial de cada persona, que queda sin esa asignación.
 * - Las que aún no empiezan se quitan (quedan marcadas como eliminadas).
 * - La programación de días por venir se quita; la de hoy y la pasada se conservan como se hizo.
 *
 * Cada método devuelve qué se hizo (los ids), para dejarlo en la bitácora.
 */
class Retiro
{
    /** @param  Closure(Builder): void  $donde  las asignaciones y la programación de ese lugar */
    public static function lugar(Closure $donde): array
    {
        return [
            ...self::asignaciones(Asignacion::query()->actuales()->where($donde)->get()),
            'programacion_quitada' => self::programacionFutura(Programacion::query()->where($donde)),
        ];
    }

    /**
     * Una línea: quien solo la tenía a ella en una asignación queda sin esa asignación; quien la tenía junto a otras
     * conserva la asignación con las demás (la línea eliminada deja de verse en ella).
     */
    public static function linea(LineaServicio $linea): array
    {
        $soloEsta = Asignacion::query()->actuales()
            ->whereHas('lineas', fn ($q) => $q->whereKey($linea->id))
            ->with('lineas:id')
            ->get()
            ->filter(fn (Asignacion $a) => $a->lineas->pluck('id')->all() === [$linea->id]);

        return [
            ...self::asignaciones($soloEsta),
            'programacion_quitada' => self::programacionFutura(Programacion::query()->where('linea_servicio_id', $linea->id)),
        ];
    }

    /** Una persona: sus asignaciones terminan y sale de la programación de los días por venir. */
    public static function persona(int $usuario): array
    {
        $filas = ProgramacionAsignacion::query()
            ->where('user_id', $usuario)
            ->whereHas('programacion', fn ($q) => $q->whereDate('fecha', '>', today()))
            ->get();
        $filas->each->delete();

        return [
            ...self::asignaciones(Asignacion::query()->actuales()->where('user_id', $usuario)->get()),
            'programacion_quitada' => $filas->pluck('id')->all(),
        ];
    }

    /** @param  Collection<int, Asignacion>  $asignaciones */
    private static function asignaciones(Collection $asignaciones): array
    {
        $terminadas = [];
        $quitadas = [];
        foreach ($asignaciones as $a) {
            // Igual que al terminarla a mano: si aún no había empezado, se quita; si ya corría, termina ayer
            if ($a->fecha_inicio->gte(today())) {
                $a->delete();
                $quitadas[] = $a->id;
            } else {
                $a->update(['fecha_fin' => today()->subDay()->toDateString(), 'duracion' => 'fechas', 'duracion_cantidad' => null]);
                $terminadas[] = $a->id;
            }
        }

        return ['asignaciones_terminadas' => $terminadas, 'asignaciones_quitadas' => $quitadas];
    }

    private static function programacionFutura(Builder $consulta): array
    {
        $futuras = $consulta->whereDate('fecha', '>', today())->get();
        $futuras->each->delete();

        return $futuras->pluck('id')->all();
    }
}
