<?php

namespace App\Http\Controllers;

use App\Models\Orden;
use App\Services\ConsolidadorInforme;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mis entregas: el historial de quien hace las rutas (sus órdenes de Drivin, por su cédula), jornada por jornada,
 * con su cumplimiento y sus evidencias (las acciones de seguimiento que recibe están en su tablero).
 */
class MisEntregasController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $fechaPedida = $request->validate(['fecha' => ['nullable', 'date_format:Y-m-d']])['fecha'] ?? null;
        $suyas = fn (): Builder => Orden::where('auxiliar_id', $user->id);

        // Una fila por jornada, de la más reciente a la más antigua
        $jornadas = $suyas()
            ->selectRaw("fecha_operacion, count(*) as ordenes, sum(estado = 'aprobada') as entregadas, sum(estado = 'rechazada') as devueltas, sum(productos) as productos, sum(tiene_imagenes = 0) as sin_imagenes, count(distinct ruta) as rutas")
            ->groupBy('fecha_operacion')
            ->orderByDesc('fecha_operacion')
            ->paginate(15, pageName: 'pagina')
            ->withQueryString()
            ->through(fn ($j) => [
                'fecha' => Carbon::parse($j->fecha_operacion)->toDateString(),
                'ordenes' => (int) $j->ordenes,
                'entregadas' => (int) $j->entregadas,
                'devueltas' => (int) $j->devueltas,
                'productos' => (int) $j->productos,
                'sinImagenes' => (int) $j->sin_imagenes,
                'cumplimiento' => ConsolidadorInforme::efectividad((int) $j->entregadas, (int) $j->ordenes),
            ]);

        // Los últimos 30 días hasta su última jornada (si dejó de tener rutas, igual ve cómo le fue)
        $ultima = $suyas()->max('fecha_operacion');
        $resumen = null;
        if ($ultima) {
            $hasta = Carbon::parse($ultima);
            $r = $suyas()->whereBetween('fecha_operacion', [$hasta->copy()->subDays(29)->toDateString(), $hasta->toDateString()])
                ->selectRaw("count(*) as ordenes, sum(estado = 'aprobada') as entregadas, sum(estado = 'rechazada') as devueltas, sum(productos) as productos, sum(tiene_imagenes = 0) as sin_imagenes, count(distinct fecha_operacion) as jornadas")
                ->toBase()->first();
            $resumen = [
                'desde' => $hasta->copy()->subDays(29)->toDateString(),
                'hasta' => $hasta->toDateString(),
                'jornadas' => (int) $r->jornadas,
                'ordenes' => (int) $r->ordenes,
                'entregadas' => (int) $r->entregadas,
                'devueltas' => (int) $r->devueltas,
                'productos' => (int) $r->productos,
                'sinImagenes' => (int) $r->sin_imagenes,
                'cumplimiento' => ConsolidadorInforme::efectividad((int) $r->entregadas, (int) $r->ordenes),
            ];
        }

        // El detalle de una jornada: la pedida (si es suya) o la última
        $fecha = $fechaPedida && $suyas()->whereDate('fecha_operacion', $fechaPedida)->exists() ? $fechaPedida : ($ultima ? Carbon::parse($ultima)->toDateString() : null);
        $detalle = $fecha ? $suyas()
            ->whereDate('fecha_operacion', $fecha)
            ->with(['auditoria:id,orden_id,cumple_protocolo,sin_evidencia,auditado_en', 'motivoRechazo:id,nombre', 'sucursal:id,nombre', 'sede:id,nombre'])
            ->orderBy('ruta')->orderBy('hora_entrega')->orderBy('codigo_orden')
            ->get()
            ->map(fn (Orden $o) => [
                'id' => $o->id,
                'codigo' => $o->codigo_orden,
                'destinatario' => $o->destinatario,
                'direccion' => $o->direccion,
                'ciudad' => $o->ciudad,
                'lugar' => collect([$o->sede?->nombre, $o->sucursal?->nombre])->filter()->implode(' · '),
                'ruta' => $o->ruta,
                'placa' => $o->placa,
                'estado' => $o->estado->value,
                'motivo' => $o->motivoRechazo?->nombre ?? $o->motivo_texto,
                'productos' => (int) $o->productos,
                'productosEntregados' => (int) $o->productos_entregados,
                'hora' => $o->hora_entrega?->format('H:i'),
                // Sus evidencias: lo que dijo la auditoría o, sin auditar, si Drivin trae imágenes
                'evidencias' => match (true) {
                    $o->auditoria?->auditado_en !== null && $o->auditoria->sin_evidencia => 'sin_evidencia',
                    $o->auditoria?->auditado_en !== null => $o->auditoria->cumple_protocolo ? 'cumple' : 'no_cumple',
                    $o->tiene_imagenes === false => 'sin_imagenes',
                    $o->tiene_imagenes === true => 'con_imagenes',
                    default => null,
                },
            ]) : collect();

        return Inertia::render('mis-entregas', [
            'jornadas' => $jornadas,
            'resumen' => $resumen,
            'fecha' => $fecha,
            'ordenes' => $detalle,
        ]);
    }
}
