<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditoriaPod;
use App\Models\MotivoRechazo;
use App\Models\Parametro;
use App\Models\TipoNovedad;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Parámetros de la operación: los umbrales con los que el informe sugiere felicitar o llamar la atención, la meta por
 * defecto de las sedes nuevas, la hora del informe, y los catálogos de motivos de rechazo (los de Drivin) y de tipos
 * de novedad (los de la auditoría de evidencias).
 */
class ParametroController extends Controller
{
    /** clave => [etiqueta, ayuda, mínimo, máximo] de los valores numéricos editables. */
    private const NUMEROS = [
        'umbral_felicitacion' => ['Felicitación desde', 'Con este cumplimiento (o más) y sin novedades, el informe sugiere felicitar.', 50, 100],
        'umbral_llamado_atencion' => ['Llamado de atención por debajo de', 'Con un cumplimiento menor, el informe sugiere un llamado de atención.', 0, 100],
        'meta_efectividad_global' => ['Meta de las sedes nuevas', 'La meta con la que se crea una sede si no se pacta otra con el cliente.', 1, 100],
    ];

    public function index(): Response
    {
        return Inertia::render('parametros/index', [
            'valores' => [
                ...collect(self::NUMEROS)->mapWithKeys(fn ($d, $clave) => [$clave => (float) Parametro::valor($clave, $clave === 'umbral_llamado_atencion' ? 70 : ($clave === 'umbral_felicitacion' ? 100 : 95))])->all(),
                'hora_corte_informe' => (string) Parametro::valor('hora_corte_informe', '10:00'),
            ],
            'campos' => collect(self::NUMEROS)->map(fn ($d, $clave) => ['clave' => $clave, 'etiqueta' => $d[0], 'ayuda' => $d[1], 'min' => $d[2], 'max' => $d[3]])->values(),
            'motivos' => MotivoRechazo::withCount('ordenes')->orderByDesc('activo')->orderBy('nombre')->get()
                ->map(fn (MotivoRechazo $m) => ['id' => $m->id, 'nombre' => $m->nombre, 'imputable' => $m->imputable_operacion, 'activo' => $m->activo, 'usos' => $m->ordenes_count]),
            'novedades' => TipoNovedad::orderByDesc('activo')->orderBy('nombre')->get()
                ->map(fn (TipoNovedad $t) => ['id' => $t->id, 'nombre' => $t->nombre, 'severidad' => $t->severidad, 'activo' => $t->activo, 'sistema' => in_array($t->nombre, TipoNovedad::DEL_SISTEMA, true)]),
        ]);
    }

    public function valores(Request $request): RedirectResponse
    {
        $reglas = collect(self::NUMEROS)->mapWithKeys(fn ($d, $clave) => [$clave => ['required', 'numeric', "min:{$d[2]}", "max:{$d[3]}"]])->all();
        $datos = $request->validate([
            ...$reglas,
            'hora_corte_informe' => ['required', 'date_format:H:i'],
        ], ['hora_corte_informe.date_format' => 'Escribe la hora como 10:00.']);

        if ((float) $datos['umbral_llamado_atencion'] >= (float) $datos['umbral_felicitacion']) {
            return back()->withErrors(['umbral_llamado_atencion' => 'Debe ser menor que el umbral de felicitación.']);
        }

        foreach ($datos as $clave => $valor) {
            Parametro::updateOrCreate(['clave' => $clave], ['valor' => (string) $valor]);
        }

        return back()->with('success', 'Parámetros guardados: el informe ya usa los nuevos umbrales.');
    }

    public function guardarMotivo(Request $request, ?MotivoRechazo $motivo = null): RedirectResponse
    {
        $request->merge(['nombre' => trim((string) $request->input('nombre'))]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:150', Rule::unique('motivos_rechazo', 'nombre')->ignore($motivo?->id)],
            'imputable' => ['required', 'boolean'],
        ], ['nombre.unique' => 'Ya hay un motivo con este nombre.', 'nombre.required' => 'Escribe el motivo como llega de Drivin.']);

        $guardado = MotivoRechazo::updateOrCreate(['id' => $motivo?->id], ['nombre' => $datos['nombre'], 'imputable_operacion' => $datos['imputable']]);

        return back()->with('success', $motivo ? "Motivo guardado: {$guardado->nombre}." : "Motivo agregado: {$guardado->nombre}. Las próximas cargas lo reconocen.");
    }

    public function estadoMotivo(Request $request, MotivoRechazo $motivo): RedirectResponse
    {
        $motivo->update(['activo' => $request->validate(['activo' => ['required', 'boolean']])['activo']]);

        return back()->with('success', $motivo->activo ? "{$motivo->nombre} está activo de nuevo." : "{$motivo->nombre} quedó inactivo.");
    }

    /** Solo un motivo que ninguna orden usa. */
    public function eliminarMotivo(MotivoRechazo $motivo): RedirectResponse
    {
        $enUso = "«{$motivo->nombre}» ya está en órdenes importadas: no se puede eliminar. Desactívalo para conservar su historial.";
        if ($motivo->ordenes()->exists()) {
            return back()->with('error', $enUso);
        }

        return $this->eliminarRegistro($motivo, "el motivo «{$motivo->nombre}»", $enUso);
    }

    public function guardarNovedad(Request $request, ?TipoNovedad $novedad = null): RedirectResponse
    {
        $request->merge(['nombre' => trim((string) $request->input('nombre'))]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:150', Rule::unique('tipos_novedad', 'nombre')->ignore($novedad?->id)],
            'severidad' => ['required', Rule::in(['ninguna', 'leve', 'grave'])],
        ], ['nombre.unique' => 'Ya hay un tipo de novedad con este nombre.', 'nombre.required' => 'Escribe el tipo de novedad.']);

        // Los tipos que la auditoría sugiere sola conservan su nombre
        if ($novedad && in_array($novedad->nombre, TipoNovedad::DEL_SISTEMA, true) && $datos['nombre'] !== $novedad->nombre) {
            return back()->withErrors(['nombre' => 'Este tipo lo sugiere la auditoría: su nombre no se cambia (sí su gravedad).']);
        }

        $guardado = TipoNovedad::updateOrCreate(['id' => $novedad?->id], $datos);

        return back()->with('success', $novedad ? "Tipo de novedad guardado: {$guardado->nombre}." : "Tipo de novedad agregado: {$guardado->nombre}.");
    }

    public function estadoNovedad(Request $request, TipoNovedad $novedad): RedirectResponse
    {
        $novedad->update(['activo' => $request->validate(['activo' => ['required', 'boolean']])['activo']]);

        return back()->with('success', $novedad->activo ? "{$novedad->nombre} está activo de nuevo." : "{$novedad->nombre} quedó inactivo: ya no se ofrece en la auditoría.");
    }

    /** Solo un tipo que la auditoría no sugiere sola y que ninguna auditoría usa. */
    public function eliminarNovedad(TipoNovedad $novedad): RedirectResponse
    {
        if (in_array($novedad->nombre, TipoNovedad::DEL_SISTEMA, true)) {
            return back()->with('error', "«{$novedad->nombre}» lo sugiere la auditoría: no se elimina.");
        }
        $enUso = "«{$novedad->nombre}» ya está en auditorías: no se puede eliminar. Desactívalo para conservar su historial.";
        if (AuditoriaPod::where('tipo_novedad_id', $novedad->id)->exists()) {
            return back()->with('error', $enUso);
        }

        return $this->eliminarRegistro($novedad, "el tipo de novedad «{$novedad->nombre}»", $enUso);
    }
}
