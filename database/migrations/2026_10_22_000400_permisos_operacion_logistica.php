<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * El informe diario y el seguimiento ya funcionan: el rol base Coordinador (que opera la línea logística) recibe sus
 * acciones nuevas. Los demás roles las reciben cuando se las den en Roles.
 */
return new class extends Migration
{
    private const NUEVOS = ['informes.ver', 'informes.editar', 'informes.cerrar', 'informes.descargar', 'seguimiento.ver', 'seguimiento.registrar'];

    public function up(): void
    {
        $rol = DB::table('roles')->where('clave', 'coordinador')->first(['id', 'permisos']);
        if ($rol) {
            $permisos = json_decode((string) $rol->permisos, true) ?: [];
            DB::table('roles')->where('id', $rol->id)->update(['permisos' => json_encode(array_values(array_unique([...$permisos, ...self::NUEVOS, 'tablero.ver'])))]);
        }
    }

    public function down(): void
    {
        $rol = DB::table('roles')->where('clave', 'coordinador')->first(['id', 'permisos']);
        if ($rol) {
            $permisos = json_decode((string) $rol->permisos, true) ?: [];
            DB::table('roles')->where('id', $rol->id)->update(['permisos' => json_encode(array_values(array_diff($permisos, ['informes.editar', 'informes.cerrar', 'informes.descargar', 'seguimiento.registrar'])))]);
        }
    }
};
