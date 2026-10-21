<?php

namespace Tests;

use App\Enums\Rol;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\RolUsuario;
use App\Models\Sede;
use App\Support\Permisos;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Empresa de prueba que recibe la línea logística (como Ditranza). */
    protected function empresa(string $nombre = 'Ditranza', array $datos = []): Empresa
    {
        $empresa = Empresa::firstOrCreate(['nombre' => $nombre], $datos);
        $empresa->lineas()->syncWithoutDetaching([LineaServicio::logistica()->id]);

        return $empresa;
    }

    /** Id del rol base de un nivel de acceso (Administrador, Coordinador / Supervisor, Auxiliar operativo). */
    protected function rolBase(Rol $nivel): int
    {
        return RolUsuario::base($nivel)->id;
    }

    /** Un rol "solo lo suyo" que además abre su tablero y Mis entregas (el auxiliar operativo base solo ve su carnet). */
    protected function rolConTablero(): RolUsuario
    {
        return RolUsuario::firstOrCreate(['nombre' => 'Auxiliar con tablero'], ['permisos' => ['tablero.ver', 'entregas.ver'], 'alcance' => Permisos::ALCANCE_PROPIO, 'activo' => true]);
    }

    /** Sede (cliente de la empresa, como TuGo); por defecto, de Ditranza. */
    protected function sede(string $nombre, array $datos = [], ?Empresa $empresa = null): Sede
    {
        return Sede::create(['nombre' => $nombre, 'meta_efectividad' => 95, ...$datos, 'empresa_id' => ($empresa ?? $this->empresa())->id]);
    }
}
