<?php

namespace Tests\Feature;

use App\Enums\EstadoOrden;
use App\Models\Carga;
use App\Models\Orden;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Mis entregas: el historial de quien hace las rutas, solo con sus órdenes. */
class MisEntregasTest extends TestCase
{
    use RefreshDatabase;

    public function test_el_auxiliar_ve_solo_sus_jornadas_y_el_detalle_de_sus_ordenes(): void
    {
        $tugo = $this->sede('TuGo');
        $auxiliar = User::factory()->create(['cedula' => '1144203579', 'rol_id' => $this->rolConTablero()->id]);
        $otro = User::factory()->create(['cedula' => '1111750549']);
        $carga = Carga::create(['archivo_nombre' => 'p.xlsx', 'archivo_path' => 'p', 'archivo_hash' => str_repeat('a', 64)]);
        $orden = fn (User $u, string $fecha, string $codigo, EstadoOrden $estado = EstadoOrden::Aprobada, array $datos = []) => Orden::create([
            'carga_id' => $carga->id, 'fecha_operacion' => $fecha, 'sede_id' => $tugo->id, 'auxiliar_id' => $u->id,
            'codigo_orden' => $codigo, 'estado' => $estado, 'productos' => 2, 'productos_entregados' => $estado === EstadoOrden::Aprobada ? 2 : 0, ...$datos,
        ]);
        $orden($auxiliar, '2026-10-01', 'A1');
        $orden($auxiliar, '2026-10-02', 'A2');
        $orden($auxiliar, '2026-10-02', 'A3', EstadoOrden::Rechazada, ['motivo_texto' => 'Cliente ausente en domicilio', 'tiene_imagenes' => false]);
        $orden($otro, '2026-10-03', 'B1');

        $this->actingAs($auxiliar)->get('/mis-entregas')->assertInertia(fn (Assert $p) => $p
            ->component('mis-entregas')
            ->where('auth.user.entregas', true)
            ->where('jornadas.total', 2)
            ->where('jornadas.data.0.fecha', '2026-10-02')
            ->where('jornadas.data.0.cumplimiento', 50)
            ->where('resumen.ordenes', 3)
            ->where('resumen.sinImagenes', 1)
            // Sin elegir jornada: la última
            ->where('fecha', '2026-10-02')
            ->has('ordenes', 2)
            ->where('ordenes.1.motivo', 'Cliente ausente en domicilio')
            ->where('ordenes.1.evidencias', 'sin_imagenes'));

        // Una jornada que no es suya muestra la última suya
        $this->get('/mis-entregas?fecha=2026-10-03')->assertInertia(fn (Assert $p) => $p->where('fecha', '2026-10-02'));
        $this->get('/mis-entregas?fecha=2026-10-01')->assertInertia(fn (Assert $p) => $p->where('fecha', '2026-10-01')->has('ordenes', 1));
    }

    public function test_quien_no_tiene_entregas_no_ve_la_opcion(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/mis-entregas')->assertInertia(fn (Assert $p) => $p
            ->where('auth.user.entregas', false)
            ->where('resumen', null)
            ->where('fecha', null));
    }
}
