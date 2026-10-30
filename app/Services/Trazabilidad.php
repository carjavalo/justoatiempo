<?php

namespace App\Services;

use App\Enums\EstadoOrden;
use App\Models\Bitacora;
use App\Models\Carga;
use App\Models\Evidencia;
use App\Models\InformeDiario;
use App\Models\Orden;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * El recorrido de una orden con lo que la plataforma sabe de ella: cada jornada en que aparece en Drivin (un mismo código
 * puede reintentarse otro día), la entrega y sus novedades, la importación, las evidencias, la auditoría, el informe y las
 * anulaciones, con la fecha, la hora y el responsable de cada paso. Lo que pasa antes de Drivin (recepción, cargue) no se
 * registra todavía: la operación no lo captura en ninguna parte.
 */
class Trazabilidad
{
    /** Las fechas de la plataforma se guardan en la zona de la aplicación; se muestran en hora de Colombia. */
    private const ZONA = 'America/Bogota';

    /** @return array{codigo: string, resumen: array<string, mixed>|null, eventos: list<array<string, mixed>>}|null */
    public function deOrden(string $codigo): ?array
    {
        $ordenes = Orden::query()
            ->where('codigo_orden', $codigo)
            ->with([
                'carga.usuario:id,name', 'sede:id,nombre', 'sucursal:id,nombre', 'auxiliar:id,name', 'motivoRechazo:id,nombre',
                'auditoria.auditor:id,name', 'auditoria.tipoNovedad:id,nombre', 'evidencias.subidoPor:id,name', 'informe.cerradoPor:id,name',
            ])
            ->orderBy('fecha_operacion')
            ->get();
        $anulaciones = Bitacora::query()
            ->with('usuario:id,name')
            ->where('modelo_tipo', Carga::class)
            ->where('accion', 'anulada')
            ->whereJsonContains('cambios->ordenes', $codigo)
            ->get();

        if ($ordenes->isEmpty() && $anulaciones->isEmpty()) {
            return null;
        }

        $bitacora = Bitacora::query()->with('usuario:id,name')->where('modelo_tipo', Orden::class)->whereIn('modelo_id', $ordenes->modelKeys())->get()->groupBy('modelo_id');
        $informes = Bitacora::query()->with('usuario:id,name')->where('modelo_tipo', InformeDiario::class)->where('accion', 'informe_estado')
            ->whereIn('modelo_id', $ordenes->pluck('informe_id')->filter()->unique())->get()->groupBy('modelo_id');

        $eventos = collect();
        foreach ($ordenes as $orden) {
            $this->deLaJornada($eventos, $orden);
            $this->deLaPlataforma($eventos, $orden, $bitacora[$orden->id] ?? collect());
            $this->delInforme($eventos, $orden, $informes[$orden->informe_id] ?? collect());
        }
        foreach ($anulaciones as $a) {
            $eventos->push($this->evento($a->created_at, 'anulacion', 'Importación anulada', "Se retiró la orden de la carga #{$a->modelo_id}.", $a->usuario?->name, 'alerta'));
        }

        return [
            'codigo' => $codigo,
            'resumen' => $this->resumen($ordenes),
            // Las de la misma hora, en el orden en que pasan: la jornada, la entrega y lo que se registró después
            'eventos' => $eventos->sortBy('marca')->values()->map(fn ($e) => collect($e)->except('marca')->all())->all(),
        ];
    }

    private function deLaJornada(Collection $eventos, Orden $o): void
    {
        $lugar = implode(' · ', array_filter([$o->sede?->nombre, $o->sucursal?->nombre]));
        $quien = $o->auxiliar?->name ?? $o->auxiliar_nombre;
        $conductor = $o->datos_crudos['conductor'] ?? null;
        $detalle = array_filter([$lugar, $o->ruta ? "Ruta {$o->ruta}" : null, $o->placa ? "Placa {$o->placa}" : null, $conductor ? "Conductor {$conductor}" : null]);
        // Fechas de Drivin: ya vienen en hora de Colombia y no se convierten
        $dia = Carbon::parse($o->fecha_operacion->toDateString(), self::ZONA);

        $eventos->push([...$this->evento($dia, 'operacion', 'En la operación de la jornada', implode(' · ', $detalle), $quien, 'neutro'), 'hora' => null]);

        $entrega = $o->hora_entrega ? Carbon::parse($o->hora_entrega->format('Y-m-d H:i:s'), self::ZONA) : $dia->copy()->addSecond();
        $motivo = $o->motivoRechazo?->nombre ?? $o->motivo_texto;
        $partes = array_filter(["{$o->productos_entregados} de {$o->productos} productos entregados", $motivo ? "Motivo: {$motivo}" : null, $o->comentario_pod ? "Comentario: {$o->comentario_pod}" : null]);
        [$titulo, $tono] = match ($o->estado) {
            EstadoOrden::Aprobada => [$o->faltante ? 'Entregada con faltante' : 'Entregada', $o->faltante ? 'alerta' : 'bien'],
            EstadoOrden::Rechazada => ['Rechazada: genera devolución', 'mal'],
            EstadoOrden::Pendiente => ['Sin gestionar en Drivin', 'alerta'],
        };
        $eventos->push([...$this->evento($entrega, 'entrega', $titulo, implode(' · ', $partes), $quien, $tono), 'hora' => $o->hora_entrega ? $entrega->format('H:i') : null]);

        if ($o->averia) {
            $eventos->push([...$this->evento($entrega->copy()->addSecond(), 'novedad', 'Avería reportada', (string) $o->averia_detalle, $quien, 'mal'), 'hora' => $o->hora_entrega ? $entrega->format('H:i') : null]);
        }
        if ($o->faltante && $o->faltante_detalle) {
            $eventos->push([...$this->evento($entrega->copy()->addSecond(), 'novedad', 'Faltante', $o->faltante_detalle, $quien, 'alerta'), 'hora' => $o->hora_entrega ? $entrega->format('H:i') : null]);
        }

        if ($o->carga) {
            $eventos->push($this->evento($o->carga->procesado_en ?? $o->carga->created_at, 'importacion', 'Importada desde Drivin', "Carga #{$o->carga->id}: {$o->carga->archivo_nombre}", $o->carga->usuario?->name, 'neutro'));
        }
    }

    /** Las evidencias y la auditoría, con lo que cada persona hizo en la plataforma. */
    private function deLaPlataforma(Collection $eventos, Orden $o, Collection $bitacora): void
    {
        // Las que se subieron juntas son un solo paso
        $o->evidencias->groupBy(fn (Evidencia $e) => $e->subido_por.'|'.$e->created_at?->format('Y-m-d H:i'))->each(function (Collection $grupo) use ($eventos) {
            $primera = $grupo->first();
            $n = $grupo->count();
            $eventos->push($this->evento($primera->created_at, 'evidencia', $n === 1 ? 'Evidencia subida' : "{$n} evidencias subidas", $grupo->pluck('nombre_original')->filter()->take(5)->implode(', '), $primera->subidoPor?->name, 'neutro'));
        });

        foreach ($bitacora as $b) {
            [$titulo, $detalle, $tono] = match ($b->accion) {
                'auditada' => [($b->cambios['cumple'] ?? false) ? 'Auditoría: cumple el protocolo' : 'Auditoría: no cumple el protocolo', '', ($b->cambios['cumple'] ?? false) ? 'bien' : 'alerta'],
                'evidencia_eliminada' => ['Evidencia eliminada', (string) ($b->cambios['archivo'] ?? ''), 'alerta'],
                'evidencia_clasificada' => ['Evidencia clasificada', trim(($b->cambios['archivo'] ?? '').' como '.($b->cambios['tipo'] ?? ''), ' '), 'neutro'],
                default => [ucfirst(str_replace('_', ' ', $b->accion)), '', 'neutro'],
            };
            $eventos->push($this->evento($b->created_at, 'auditoria', $titulo, $detalle, $b->usuario?->name, $tono));
        }

        // Auditorías anteriores a la bitácora: al menos la última
        if ($o->auditoria?->auditado_en && ! $bitacora->contains('accion', 'auditada')) {
            $eventos->push($this->evento($o->auditoria->auditado_en, 'auditoria', $o->auditoria->cumple_protocolo ? 'Auditoría: cumple el protocolo' : 'Auditoría: no cumple el protocolo', (string) $o->auditoria->tipoNovedad?->nombre, $o->auditoria->auditor?->name, $o->auditoria->cumple_protocolo ? 'bien' : 'alerta'));
        }
    }

    private function delInforme(Collection $eventos, Orden $o, Collection $bitacora): void
    {
        $informe = $o->informe;
        if (! $informe) {
            return;
        }

        foreach ($bitacora as $b) {
            $titulo = match (true) {
                ($b->cambios['estado'] ?? '') === 'cerrado' => 'Informe diario cerrado',
                $b->cambios['reabierto'] ?? false => 'Informe diario reabierto',
                default => 'Informe diario en seguimiento',
            };
            $eventos->push($this->evento($b->created_at, 'informe', $titulo, '', $b->usuario?->name, 'neutro'));
        }

        // Cierres anteriores a la bitácora
        if ($informe->cerrado_en && ! $bitacora->contains(fn ($b) => ($b->cambios['estado'] ?? '') === 'cerrado')) {
            $eventos->push($this->evento($informe->cerrado_en, 'informe', 'Informe diario cerrado', '', $informe->cerradoPor?->name, 'neutro'));
        }
    }

    /** @return array<string, mixed>|null */
    private function resumen(Collection $ordenes): ?array
    {
        $ultima = $ordenes->last();
        if (! $ultima) {
            return null;
        }

        return [
            'destinatario' => $ultima->destinatario,
            'direccion' => $ultima->direccion,
            'ciudad' => $ultima->ciudad,
            'estado' => $ultima->estado->label(),
            'jornadas' => $ordenes->count(),
            'productos' => collect($ultima->datos_crudos['productos'] ?? [])->pluck('producto')->filter()->unique()->values()->all(),
        ];
    }

    /** @return array{marca: int, etapa: string, titulo: string, detalle: string, responsable: string|null, tono: string, fecha: string, hora: string|null} */
    private function evento(CarbonInterface $cuando, string $etapa, string $titulo, string $detalle, ?string $responsable, string $tono): array
    {
        $local = $cuando->copy()->timezone(self::ZONA);

        return [
            'marca' => $local->getTimestamp(),
            'etapa' => $etapa,
            'titulo' => $titulo,
            'detalle' => $detalle,
            'responsable' => $responsable,
            'tono' => $tono,
            'fecha' => $local->toDateString(),
            'hora' => $local->format('H:i'),
        ];
    }
}
