<?php

namespace Database\Seeders;

use App\Enums\Rol;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\Sede;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Database\Seeder;

/** Datos maestros de ejemplo basados en la operación mostrada en el video (solo desarrollo). */
class OperacionSeeder extends Seeder
{
    public function run(): void
    {
        // Empresa > sede > sucursal: Ditransa atiende a TuGo y a Sodimac; cada una con sus sucursales
        $ditransa = Empresa::updateOrCreate(['nombre' => 'Ditransa'], ['activo' => true]);
        $ditransa->lineas()->syncWithoutDetaching([LineaServicio::logistica()->id]);

        $tugo = Sede::updateOrCreate(['nombre' => 'TuGo'], [
            'empresa_id' => $ditransa->id,
            'codigo' => 'TUGO',
            'meta_efectividad' => 95,
            'color' => '#E8705F',
        ]);
        // Si TuGo ya existía en otra empresa, pasa a Ditransa con sus asignaciones
        $tugo->trasladarA($ditransa);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cali Sur'], ['alias_drivin' => 'CALI SUR CROSS', 'ciudad' => 'Cali']);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cali Norte'], ['alias_drivin' => 'CALI NORTE', 'ciudad' => 'Cali']);
        $tugo->sucursales()->updateOrCreate(['nombre' => 'Cañasgordas'], ['alias_drivin' => 'CANASGORDAS', 'ciudad' => 'Cali']);

        $sodimac = Sede::updateOrCreate(['nombre' => 'Sodimac'], [
            'empresa_id' => $ditransa->id,
            'codigo' => 'SODIMAC',
            'meta_efectividad' => 95,
            'color' => '#1F3A68',
        ]);
        $sodimac->trasladarA($ditransa);
        $sodimac->sucursales()->updateOrCreate(['nombre' => 'Cali'], ['alias_drivin' => 'SODIMAC CALI', 'ciudad' => 'Cali']);

        Vehiculo::updateOrCreate(['placa' => 'SNX708'], ['tipo' => 'Furgón', 'descripcion' => 'Ruta urbana Cali Sur']);
        Vehiculo::updateOrCreate(['placa' => 'TTT768'], ['tipo' => 'Furgón']);
        Vehiculo::updateOrCreate(['placa' => 'ZNK295'], ['tipo' => 'Furgón']);

        // Auxiliares de la operación logística: personal sin acceso a la plataforma (con su carnet), asignado a Ditransa
        foreach ([
            ['1000000001', 'Juan Fernando', 'Plaza'],
            ['1000000003', 'Alber', 'Prado'],
            ['1000000004', 'Cristian', 'Gómez'],
            ['1000000005', 'Andrés Felipe', 'Rojas'],
        ] as [$cedula, $nombres, $apellido]) {
            self::personal($cedula, $nombres, $apellido, $ditransa);
        }
    }

    /** Una persona del personal operativo, sin acceso a la plataforma, asignada a la empresa en su línea logística. */
    public static function personal(string $cedula, string $nombres, string $apellido, Empresa $empresa): User
    {
        $persona = User::firstOrCreate(['cedula' => $cedula], [
            'nombres' => $nombres,
            'primer_apellido' => $apellido,
            'cargo' => 'Auxiliar logístico',
            'rol' => Rol::Auxiliar,
            'activo' => true,
            'acceso' => false,
        ]);

        if (! $persona->asignaciones()->exists()) {
            $asignacion = $persona->asignaciones()->create([
                'empresa_id' => $empresa->id,
                'fecha_inicio' => today()->subYear()->toDateString(),
                'duracion' => 'indefinida',
            ]);
            $asignacion->lineas()->sync([LineaServicio::logistica()->id]);
        }

        return $persona;
    }
}
