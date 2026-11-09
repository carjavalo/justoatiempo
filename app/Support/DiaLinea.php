<?php

namespace App\Support;

use App\Models\NovedadLinea;
use App\Models\User;
use App\Services\InformeLinea\JornadaLinea;
use Illuminate\Database\Eloquent\Builder;

/**
 * El día de una línea sin Drivin para quien mira, en el orden en que pasa: la programación de hoy, su asistencia y las
 * novedades sin cerrar. Lo muestran el inicio (en la tarjeta de la línea) y el tablero de la línea (arriba, en "Hoy"),
 * para que los dos digan lo mismo. Cada parte es null si su rol no la ve.
 */
final class DiaLinea
{
    public function __construct(private readonly User $user, private readonly OperacionLinea $op) {}

    /** La programación de hoy con su asistencia, en lo que ve (si su rol ve la programación). */
    public function hoy(): ?array
    {
        if (! $this->user->puedeEnLinea('programacion.ver', $this->op->linea)) {
            return null;
        }

        return [...app(JornadaLinea::class)->resumenDia($this->op, today()), 'href' => route('programacion.index', $this->op->linea, false)];
    }

    /** Las novedades sin cerrar (abiertas o en seguimiento) de la línea, en lo que ve. */
    public function pendientes(): Builder
    {
        return $this->op->filtrar(NovedadLinea::query(), 'novedades_linea')
            ->where('linea_servicio_id', $this->op->linea->id)
            ->where('estado', '!=', 'cerrada');
    }

    /** Cuántas novedades siguen sin cerrar, cuántas son graves y a dónde ir (si su rol ve las novedades). */
    public function novedades(): ?array
    {
        if (! $this->user->puedeEnLinea('novedades.ver', $this->op->linea)) {
            return null;
        }
        $t = $this->pendientes()->selectRaw("count(*) as total, sum(gravedad = 'grave') as graves")->toBase()->first();

        return ['sinCerrar' => (int) $t->total, 'graves' => (int) $t->graves, 'href' => route('novedades.index', $this->op->linea, false)];
    }
}
