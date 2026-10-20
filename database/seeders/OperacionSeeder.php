<?php

namespace Database\Seeders;

use App\Enums\CargoEmpleado;
use App\Models\Empleado;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\Vehiculo;
use Illuminate\Database\Seeder;

/** Datos maestros de ejemplo basados en la operación mostrada en el video (solo desarrollo). */
class OperacionSeeder extends Seeder
{
    public function run(): void
    {
        // Empresa > sede > sucursal: Ditranza atiende a TuGo y a Sodimac; cada una con sus sucursales
        $ditranza = Empresa::updateOrCreate(['nombre' => 'Ditranza'], ['activo' => true]);
        $ditranza->lineas()->syncWithoutDetaching([LineaServicio::logistica()->id]);

        $tugo = Sede::updateOrCreate(['nombre' => 'TuGo'], [
            'empresa_id' => $ditranza->id,
            'codigo' => 'TUGO',
            'meta_efectividad' => 95,
            'color' => '#E8705F',
        ]);
        // Si TuGo ya existía en otra empresa, pasa a Ditranza con sus asignaciones
        $tugo->trasladarA($ditranza);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cali Sur'], ['alias_drivin' => 'CALI SUR CROSS', 'ciudad' => 'Cali']);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cali Norte'], ['alias_drivin' => 'CALI NORTE', 'ciudad' => 'Cali']);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cañasgordas'], ['alias_drivin' => 'CANASGORDAS', 'ciudad' => 'Cali']);

        $sodimac = Sede::updateOrCreate(['nombre' => 'Sodimac'], [
            'empresa_id' => $ditranza->id,
            'codigo' => 'SODIMAC',
            'meta_efectividad' => 95,
            'color' => '#1F3A68',
        ]);
        $sodimac->trasladarA($ditranza);
        $sodimac->sucursales()->updateOrCreate(['nombre' => 'Cali'], ['alias_drivin' => 'SODIMAC CALI', 'ciudad' => 'Cali']);

        Vehiculo::updateOrCreate(['placa' => 'SNX708'], ['tipo' => 'Furgón', 'descripcion' => 'Ruta urbana Cali Sur']);
        Vehiculo::updateOrCreate(['placa' => 'TTT768'], ['tipo' => 'Furgón']);
        Vehiculo::updateOrCreate(['placa' => 'ZNK295'], ['tipo' => 'Furgón']);

        $empleados = [
            ['1000000001', 'Juan Fernando', 'Plaza', CargoEmpleado::Auxiliar],
            ['1000000002', 'Andrés', 'Moreno', CargoEmpleado::Auxiliar],
            ['1000000003', 'Alber', 'Prado', CargoEmpleado::Auxiliar],
            ['1000000004', 'Cristian', 'Gómez', CargoEmpleado::Auxiliar],
            ['1000000005', 'Andrés Felipe', 'Rojas', CargoEmpleado::Auxiliar],
            ['1000000006', 'Carlos', 'Valderrama', CargoEmpleado::Coordinador],
        ];

        foreach ($empleados as [$cedula, $nombres, $apellidos, $cargo]) {
            Empleado::updateOrCreate(['cedula' => $cedula], [
                'nombres' => $nombres,
                'apellidos' => $apellidos,
                'cargo' => $cargo,
                'activo' => true,
            ]);
        }
    }
}
