<?php

namespace App\Support;

use App\Enums\EstadoCarga;
use App\Enums\EstadoInforme;
use App\Enums\EstadoOrden;
use App\Models\Carga;
use App\Models\InformeDiario;
use App\Models\LineaServicio;
use App\Models\Orden;
use App\Models\Parametro;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * El día de la línea de logística para quien mira, en el orden en que pasa: la última jornada de Drivin (y si está al
 * día), las cargas por confirmar, las órdenes aprobadas por auditar y los informes diarios sin cerrar. Lo muestran el
 * inicio (en la tarjeta de la línea) y el tablero de la línea (arriba, en "Hoy"), para que los dos digan lo mismo.
 * Cada parte es null si su rol no la ve.
 */
final class DiaLogistica
{
    /** Las jornadas de Drivin son días de Colombia (la aplicación ya corre en esa hora; se dice por si se cambia). */
    private const ZONA = 'America/Bogota';

    private ?OperacionLogistica $op = null;

    /** Hoy en Colombia, como fecha (sin hora): se compara con fecha_operacion. */
    private function hoy(): Carbon
    {
        return Carbon::parse(now(self::ZONA)->toDateString());
    }

    public function __construct(private readonly User $user) {}

    /** Lo de la operación que ve: sus sedes y sucursales (sin elegir sede: el día es de todo su alcance). */
    private function op(): OperacionLogistica
    {
        return $this->op ??= OperacionLogistica::para($this->user);
    }

    private function trabajaEnLaLinea(): bool
    {
        return $this->user->trabajaEn(LineaServicio::logistica());
    }

    /** Quien ve la operación (no solo lo suyo) y tiene el permiso. */
    private function veLaOperacion(string $permiso): bool
    {
        return $this->user->puede($permiso) && ! $this->user->soloLoSuyo() && $this->trabajaEnLaLinea();
    }

    /**
     * La última jornada que ve, con la meta ponderada por las entregas de cada sede (la meta de quien entregó más pesa
     * más). Quien ve solo lo suyo ve su propia jornada (sus órdenes), como en su tablero: de ella no se dice si "llegó
     * otra carga" (un día libre no es una carga atrasada), solo cuándo fue.
     */
    public function jornada(): ?array
    {
        if (! $this->user->puede('tablero.ver') || ! $this->trabajaEnLaLinea()) {
            return null;
        }

        if ($this->user->soloLoSuyo()) {
            $suyas = Orden::where('auxiliar_id', $this->user->id);
            $fecha = $suyas->clone()->max('fecha_operacion');
            if (! $fecha) {
                return null;
            }
            $t = $suyas->clone()->whereDate('fecha_operacion', $fecha)
                ->selectRaw("count(*) as asignadas, sum(estado = 'aprobada') as aprobadas")->toBase()->first();
            $meta = (float) Parametro::valor('meta_efectividad_global', 95);
        } else {
            $fecha = $this->op()->ubicacion(InformeDiario::query())->max('fecha_operacion');
            if (! $fecha) {
                return null;
            }
            $t = $this->op()->ubicacion(InformeDiario::query(), 'informes_diarios')
                ->join('sedes', 'sedes.id', '=', 'informes_diarios.sede_id')
                ->whereDate('informes_diarios.fecha_operacion', $fecha)
                ->selectRaw('sum(informes_diarios.total_asignadas) as asignadas, sum(informes_diarios.total_aprobadas) as aprobadas, sum(informes_diarios.total_asignadas * sedes.meta_efectividad) as ponderada')
                ->toBase()->first();
            $meta = (int) $t->asignadas ? (float) $t->ponderada / (int) $t->asignadas : null;
        }
        $asignadas = (int) $t->asignadas;
        $dia = substr((string) $fecha, 0, 10);
        $hoy = $this->hoy();
        $dias = (int) Carbon::parse($dia)->diffInDays($hoy);

        return [
            'fecha' => $dia,
            'propia' => $this->user->soloLoSuyo(),
            'asignadas' => $asignadas,
            'efectividad' => $asignadas ? round((int) $t->aprobadas / $asignadas * 100, 2) : null,
            'meta' => $meta ? round($meta, 2) : null,
            // Al día: está cargada la jornada de ayer (un lunes, la del sábado). Si no, el dato es viejo y se dice
            'dias' => $dias,
            'reciente' => $dias <= ($hoy->isMonday() ? 2 : 1),
            'href' => match (true) {
                $this->user->soloLoSuyo() => $this->user->puede('entregas.ver') ? route('mis-entregas', ['fecha' => $dia], false) : null,
                $this->user->puede('informes.ver') => route('informes.index', ['fecha' => $dia], false),
                default => null,
            },
        ];
    }

    /** Las cargas de Drivin que esperan su confirmación (las revisa quien abre Cargas). */
    public function cargas(): ?array
    {
        if (! $this->user->puede('cargas.ver')) {
            return null;
        }

        return ['porConfirmar' => Carga::where('estado', EstadoCarga::EnRevision)->count(), 'href' => route('cargas.index', [], false)];
    }

    /**
     * Las órdenes aprobadas que aún no tienen la auditoría de sus evidencias, en los informes que siguen abiertos (en
     * uno cerrado ya no se puede auditar). El enlace abre en Auditoría POD la jornada más reciente de esas órdenes.
     */
    public function porAuditar(): ?array
    {
        if (! $this->veLaOperacion('auditoria.ver')) {
            return null;
        }
        $pendientes = $this->op()->ubicacion(Orden::query())
            ->where('estado', EstadoOrden::Aprobada)
            ->whereDoesntHave('auditoria')
            ->whereHas('informe', fn ($q) => $q->where('estado', '!=', EstadoInforme::Cerrado));
        $fecha = $pendientes->clone()->max('fecha_operacion');

        return [
            'ordenes' => $pendientes->count(),
            'href' => $fecha ? route('auditoria.index', ['fecha' => substr((string) $fecha, 0, 10)], false) : null,
        ];
    }

    /** Los informes diarios de jornadas pasadas sin cerrar: cuántos y el enlace al más antiguo. */
    public function informes(): ?array
    {
        if (! $this->veLaOperacion('informes.ver')) {
            return null;
        }
        $abiertos = $this->op()->ubicacion(InformeDiario::query())
            ->where('estado', '!=', EstadoInforme::Cerrado)->whereDate('fecha_operacion', '<', $this->hoy()->toDateString());
        $desde = $abiertos->clone()->min('fecha_operacion');
        $desde = $desde ? substr((string) $desde, 0, 10) : null;

        return [
            'sinCerrar' => $abiertos->count(),
            'desde' => $desde,
            'href' => $desde ? route('informes.index', ['fecha' => $desde], false) : null,
        ];
    }

    /** Todo el día, para el tablero de la línea. */
    public function todo(): array
    {
        return [
            'jornada' => $this->jornada(),
            'cargas' => $this->cargas(),
            'porAuditar' => $this->porAuditar(),
            'informes' => $this->informes(),
        ];
    }
}
