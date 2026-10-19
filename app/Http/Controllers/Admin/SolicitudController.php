<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SolicitudContacto;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Solicitudes de cotización del sitio web ("Hablemos de su operación"): se revisan y se marcan como atendidas. */
class SolicitudController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'estado' => ['nullable', Rule::in(['pendientes', 'atendidas', 'todas'])],
        ]);
        // Sin filtro se ven las que faltan por atender: es lo primero que se mira
        $estado = $filtros['estado'] ?? 'pendientes';
        $pendientes = SolicitudContacto::where('atendida', false)->count();

        $solicitudes = SolicitudContacto::query()
            ->with('atendidaPor:id,name')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('nombre', 'like', $like)->orWhere('empresa', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->when($estado !== 'todas', fn (Builder $q) => $q->where('atendida', $estado === 'atendidas'))
            ->latest()
            ->latest('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (SolicitudContacto $s) => [
                'id' => $s->id,
                'nombre' => $s->nombre,
                'empresa' => $s->empresa,
                'email' => $s->email,
                'telefono' => $s->telefono,
                'servicio' => $s->servicio,
                'mensaje' => $s->mensaje,
                'recibida' => $s->created_at->toIso8601String(),
                'atendida' => $s->atendida,
                'atendidaEn' => $s->atendida_en?->toIso8601String(),
                'atendidaPor' => $s->atendidaPor?->name,
            ]);

        return Inertia::render('solicitudes/index', [
            'solicitudes' => $solicitudes,
            'total' => SolicitudContacto::count(),
            'pendientes' => $pendientes,
            // Pendientes es el estado por omisión: en la dirección (y en "Quitar filtros") va vacío
            'filtros' => ['q' => $filtros['q'] ?? '', 'estado' => $estado === 'pendientes' ? '' : $estado],
        ]);
    }

    /** Marca la solicitud como atendida (con quién y cuándo) o la devuelve a pendientes. */
    public function atencion(Request $request, SolicitudContacto $solicitud): RedirectResponse
    {
        $atendida = $request->validate(['atendida' => ['required', 'boolean']])['atendida'];

        $solicitud->update([
            'atendida' => $atendida,
            'atendida_en' => $atendida ? now() : null,
            'atendida_por_id' => $atendida ? $request->user()->id : null,
        ]);

        return back()->with('success', $atendida
            ? "La solicitud de {$solicitud->nombre} quedó como atendida."
            : "La solicitud de {$solicitud->nombre} volvió a pendientes.");
    }
}
