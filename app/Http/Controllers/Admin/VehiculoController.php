<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InformeLinea;
use App\Models\ProgramacionAsignacion;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Flota de la operación logística: cada vehículo por su placa (la de Drivin), su código interno, su tipo y su
 * conductor habitual. Los vehículos nuevos de la preliquidación se agregan solos al importarla.
 */
class VehiculoController extends Controller
{
    public function index(Request $request): Response
    {
        $filtros = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'estado' => ['nullable', Rule::in(['activos', 'inactivos'])],
        ]);
        $desde = today()->subDays(29)->toDateString();

        $vehiculos = Vehiculo::query()
            ->with('conductor:id,name')
            ->withCount(['ordenes as ordenes_mes' => fn ($q) => $q->where('fecha_operacion', '>=', $desde)])
            ->withMax('ordenes as ultima_jornada', 'fecha_operacion')
            ->when($filtros['q'] ?? null, function (Builder $q, string $texto) {
                $like = '%'.addcslashes($texto, '%_\\').'%';
                $placa = '%'.addcslashes((string) Vehiculo::normalizarPlaca($texto), '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('placa', 'like', $placa)->orWhere('codigo_interno', 'like', $like)
                    ->orWhere('tipo', 'like', $like)->orWhere('descripcion', 'like', $like));
            })
            ->when($filtros['estado'] ?? null, fn (Builder $q, string $estado) => $q->where('activo', $estado === 'activos'))
            ->orderByDesc('activo')
            ->orderBy('placa')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Vehiculo $v) => [
                'id' => $v->id,
                'placa' => $v->placa,
                'codigoInterno' => $v->codigo_interno,
                'tipo' => $v->tipo,
                'descripcion' => $v->descripcion,
                'conductorId' => $v->conductor_id,
                'conductor' => $v->conductor?->name,
                'activo' => $v->activo,
                'ordenesMes' => $v->ordenes_mes,
                'ultimaJornada' => $v->ultima_jornada ? Carbon::parse($v->ultima_jornada)->toDateString() : null,
            ]);

        return Inertia::render('vehiculos/index', [
            'vehiculos' => $vehiculos,
            'total' => Vehiculo::count(),
            'filtros' => ['q' => $filtros['q'] ?? '', 'estado' => $filtros['estado'] ?? ''],
            // Para elegir el conductor habitual: el personal activo (primero quien tiene "conductor" en el cargo)
            'personas' => User::where('activo', true)
                ->orderByRaw("case when lower(cargo) like '%conductor%' then 0 else 1 end")
                ->orderBy('name')
                ->get(['id', 'name', 'cargo', 'cedula'])
                ->map(fn (User $u) => ['id' => $u->id, 'nombre' => $u->name, 'detalle' => trim(($u->cargo ?? '').($u->cedula ? " · C.C. {$u->cedula}" : ''), ' ·')]),
            'tipos' => Vehiculo::whereNotNull('tipo')->distinct()->orderBy('tipo')->pluck('tipo'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $vehiculo = Vehiculo::create([...$this->validar($request), 'activo' => true]);

        return back()->with('success', "Vehículo {$vehiculo->placa} agregado a la flota.");
    }

    public function update(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $vehiculo->update($this->validar($request, $vehiculo));

        return back()->with('success', "Cambios guardados en {$vehiculo->placa}.");
    }

    public function estado(Request $request, Vehiculo $vehiculo): RedirectResponse
    {
        $activo = $request->validate(['activo' => ['required', 'boolean']])['activo'];
        $vehiculo->update(['activo' => $activo]);

        return back()->with('success', $activo ? "{$vehiculo->placa} está activo de nuevo." : "{$vehiculo->placa} quedó inactivo: su historial se conserva.");
    }

    /** Solo un vehículo que nunca ha operado (p. ej. una placa mal escrita): el que tiene historial se desactiva. */
    public function destroy(Vehiculo $vehiculo): RedirectResponse
    {
        $enUso = "{$vehiculo->placa} tiene órdenes o programación registradas: no se puede eliminar. Desactívalo para conservar su historial.";
        if ($vehiculo->ordenes()->exists() || InformeLinea::where('vehiculo_id', $vehiculo->id)->exists() || ProgramacionAsignacion::where('vehiculo_id', $vehiculo->id)->exists()) {
            return back()->with('error', $enUso);
        }

        return $this->eliminarRegistro($vehiculo, "el vehículo {$vehiculo->placa}", $enUso);
    }

    /** @return array<string, mixed> */
    private function validar(Request $request, ?Vehiculo $vehiculo = null): array
    {
        $request->merge([
            // "snx 708" → "SNX708", como lo trae Drivin
            'placa' => Vehiculo::normalizarPlaca((string) $request->input('placa')),
            'codigo_interno' => trim((string) $request->input('codigo_interno')) ?: null,
            'tipo' => trim((string) $request->input('tipo')) ?: null,
            'descripcion' => trim((string) $request->input('descripcion')) ?: null,
            'conductor_id' => $request->input('conductor_id') ?: null,
        ]);

        return $request->validate([
            'placa' => ['required', 'string', 'regex:/^[A-Z0-9]{5,8}$/', Rule::unique('vehiculos', 'placa')->ignore($vehiculo?->id)],
            'codigo_interno' => ['nullable', 'string', 'max:30', Rule::unique('vehiculos', 'codigo_interno')->ignore($vehiculo?->id)],
            'tipo' => ['nullable', 'string', 'max:50'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'conductor_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('activo', true)],
        ], [
            'placa.required' => 'Escribe la placa.',
            'placa.regex' => 'Escribe la placa con letras y números (p. ej. SNX708).',
            'placa.unique' => 'Ya hay un vehículo con esta placa.',
            'codigo_interno.unique' => 'Ya hay un vehículo con este código interno.',
            'conductor_id.exists' => 'Elige una persona activa del personal.',
        ]);
    }
}
