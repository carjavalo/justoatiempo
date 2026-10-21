<?php

namespace App\Support;

use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Lo que una persona alcanza a ver y operar de una línea de servicio: los lugares (empresa, y si se quiere su sede y
 * su sucursal) de las empresas que reciben la línea, dentro de sus asignaciones. Lo usan la programación, la
 * asistencia, las novedades y el informe diario de cada línea, para que todos muestren lo mismo.
 */
final class OperacionLinea
{
    private ?Collection $lugares = null;

    private function __construct(public readonly LineaServicio $linea, public readonly Alcance $alcance, public readonly User $user) {}

    /** Para usar una herramienta de la línea: su rol debe tener el permiso y debe trabajar en ella (o verlas todas). */
    public static function para(User $user, LineaServicio $linea, string $permiso): self
    {
        abort_unless($linea->activa, 404);
        abort_unless($user->puedeEnLinea($permiso, $linea), 403, $user->puede($permiso)
            ? 'No trabajas en esta línea de servicio.'
            : ($user->motivoSinPermiso($permiso) ?? 'Tu rol no tiene permiso para entrar a esta sección.'));

        return new self($linea, $user->alcanceEn($linea), $user);
    }

    /**
     * Los lugares donde se presta la línea y que alcanza a ver: cada empresa activa que la recibe, cada una de sus
     * sedes activas y cada sucursal activa de esas sedes.
     *
     * @return Collection<int, array{clave: string, empresa_id: int, sede_id: int|null, sucursal_id: int|null, nombre: string, empresa: string, detalle: string|null}>
     */
    public function lugares(): Collection
    {
        return $this->lugares ??= Empresa::query()
            ->where('activo', true)
            ->whereHas('lineas', fn ($q) => $q->whereKey($this->linea->id))
            ->with(['sedes' => fn ($q) => $q->where('activo', true)->orderBy('nombre'), 'sedes.sucursales' => fn ($q) => $q->where('activo', true)->orderBy('nombre')])
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->flatMap(function (Empresa $e) {
                $lugares = [self::lugar($e->id, null, null, $e->nombre, $e->nombre, 'Toda la empresa')];
                foreach ($e->sedes as $sede) {
                    $lugares[] = self::lugar($e->id, $sede->id, null, "{$e->nombre} · {$sede->nombre}", $e->nombre, 'Toda la sede');
                    foreach ($sede->sucursales as $sucursal) {
                        $lugares[] = self::lugar($e->id, $sede->id, $sucursal->id, "{$e->nombre} · {$sede->nombre} · {$sucursal->nombre}", $e->nombre, $sucursal->ciudad);
                    }
                }

                return $lugares;
            })
            ->filter(fn (array $l) => $this->alcance->incluye($l['empresa_id'], $l['sede_id'], $l['sucursal_id']))
            ->values();
    }

    /** @return array{clave: string, empresa_id: int, sede_id: int|null, sucursal_id: int|null, nombre: string, empresa: string, detalle: string|null} */
    private static function lugar(int $empresa, ?int $sede, ?int $sucursal, string $nombre, string $nombreEmpresa, ?string $detalle): array
    {
        return [
            'clave' => self::clave($empresa, $sede, $sucursal),
            'empresa_id' => $empresa,
            'sede_id' => $sede,
            'sucursal_id' => $sucursal,
            'nombre' => $nombre,
            'empresa' => $nombreEmpresa,
            'detalle' => $detalle,
        ];
    }

    /** "3-5-0": empresa, sede y sucursal (0 si no la fija), para elegir un lugar en un formulario. */
    public static function clave(int $empresa, ?int $sede, ?int $sucursal): string
    {
        return $empresa.'-'.($sede ?? 0).'-'.($sucursal ?? 0);
    }

    /** El lugar de una clave, si es uno de los que ve. */
    public function lugarDe(?string $clave): ?array
    {
        return $clave === null ? null : $this->lugares()->firstWhere('clave', $clave);
    }

    /** Si un lugar (empresa, sede y sucursal) es de la línea y está en lo que ve. */
    public function incluye(int $empresa, ?int $sede, ?int $sucursal): bool
    {
        return $this->lugares()->contains('clave', self::clave($empresa, $sede, $sucursal));
    }

    /**
     * Limita una consulta con columnas empresa_id, sede_id y sucursal_id (programaciones, novedades) a lo que ve:
     * las empresas que reciben la línea y, si sus asignaciones lo fijan, su sede y su sucursal.
     */
    public function filtrar(Builder $q, string $tabla): Builder
    {
        $empresas = $this->lugares()->pluck('empresa_id')->unique()->values()->all();
        $q->whereIn("{$tabla}.empresa_id", $empresas);
        if ($this->alcance->todo) {
            return $q;
        }

        return $q->where(function (Builder $w) use ($tabla) {
            $w->whereRaw('1 = 0');
            foreach ($this->alcance->lugares as $l) {
                $w->orWhere(fn (Builder $o) => $o->where("{$tabla}.empresa_id", $l['empresa'])
                    ->when($l['sede'], fn ($s, int $id) => $s->where("{$tabla}.sede_id", $id))
                    ->when($l['sucursal'], fn ($s, int $id) => $s->where("{$tabla}.sucursal_id", $id)));
            }
        });
    }

    /**
     * Las personas activas que pueden trabajar en un lugar ese día: las que tienen una asignación vigente en la
     * línea que cubre el lugar (o toda la línea), y las de una sede o sucursal dentro de él.
     *
     * @return Collection<int, User>
     */
    public function personasEn(int $empresa, ?int $sede, ?int $sucursal, Carbon $dia): Collection
    {
        $asignadas = Asignacion::vigentes($dia)
            ->whereHas('lineas', fn ($q) => $q->whereKey($this->linea->id))
            ->where(fn (Builder $w) => $w->whereNull('asignaciones.empresa_id')->orWhere(fn (Builder $e) => $e
                ->where('asignaciones.empresa_id', $empresa)
                ->when($sede, fn ($q, int $id) => $q->where(fn ($s) => $s->whereNull('asignaciones.sede_id')->orWhere('asignaciones.sede_id', $id)))
                ->when($sucursal, fn ($q, int $id) => $q->where(fn ($s) => $s->whereNull('asignaciones.sucursal_id')->orWhere('asignaciones.sucursal_id', $id)))))
            ->select('user_id');

        return User::whereIn('id', $asignadas)->where('activo', true)
            ->orderBy('name')
            ->get(['id', 'name', 'cedula', 'cargo']);
    }
}
