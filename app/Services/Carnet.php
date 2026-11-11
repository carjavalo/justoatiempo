<?php

namespace App\Services;

use App\Models\Asignacion;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Todo lo del carnet que sale del servidor: los datos para dibujarlo (lo ve la administración y cada persona el
 * suyo), lo que se muestra al escanear su QR y la entrega de la foto y del certificado de ARL. El carnet se
 * dibuja en el navegador (resources/js/lib/carnet.ts).
 */
class Carnet
{
    /** @param  string|null  $foto  dirección por la que quien mira puede ver la foto */
    public static function datos(User $usuario, ?string $foto, ?string $arl = null): array
    {
        return [
            'id' => $usuario->id,
            'nombres' => $usuario->nombres ?: Str::before($usuario->name, ' '),
            'apellidos' => trim(implode(' ', array_filter([$usuario->primer_apellido, $usuario->segundo_apellido])))
                ?: Str::after($usuario->name, ' '),
            'nombreCompleto' => $usuario->name,
            'cedula' => $usuario->cedula,
            // Sin cargo escrito (usuarios de antes de que fuera obligatorio), el carnet lleva su rol
            'cargo' => $usuario->cargo ?: $usuario->nombreRol(),
            'tieneCargo' => filled($usuario->cargo),
            // Donde el diseño traía el correo
            'rh' => $usuario->rh,
            'eps' => $usuario->eps,
            'entidadArl' => $usuario->arl_entidad,
            // No va en el carnet: con él se busca a la persona en Usuarios para completarle lo que falte
            'email' => $usuario->email,
            // Sus líneas de servicio van abajo en el carnet (la empresa no: cambia de cliente)
            'asignaciones' => self::asignaciones($usuario),
            'foto' => $foto,
            'arl' => $arl,
            'activo' => $usuario->activo,
            // Lo que se lee al escanear el QR
            'qr' => route('carnet.verificar', $usuario->carnet_codigo),
        ];
    }

    /**
     * Lo que ve quien escanea el QR (página pública, p. ej. la portería de un cliente): lo mismo que dice el carnet
     * (quién es, su cargo, su cédula, su RH, su EPS, su ARL y su línea, sin la empresa) más su certificado de ARL. Si
     * la persona ya no está activa solo se dice que el carnet no es vigente: no se muestran sus datos.
     */
    public static function verificacion(User $usuario): array
    {
        if (! $usuario->activo) {
            return ['vigente' => false, 'nombre' => $usuario->name];
        }

        $codigo = $usuario->carnet_codigo;

        return [
            'vigente' => true,
            'nombre' => $usuario->name,
            'cedula' => $usuario->cedula,
            'cargo' => $usuario->cargo ?: $usuario->nombreRol(),
            // Lo mismo que el carnet: sin el correo ni la empresa
            'rh' => $usuario->rh,
            'eps' => $usuario->eps,
            'entidadArl' => $usuario->arl_entidad,
            // Las líneas de servicio que hace hoy, sin repetir
            'lineas' => collect(self::asignaciones($usuario))->pluck('lineas')->flatten()->unique()->values()->all(),
            'foto' => $usuario->foto_path ? route('carnet.foto', ['codigo' => $codigo, 'v' => self::version($usuario->foto_path)]) : null,
            'arl' => $usuario->arl_path ? [
                'url' => route('carnet.arl', ['codigo' => $codigo, 'v' => self::version($usuario->arl_path)]),
                'pdf' => self::esPdf($usuario->arl_path),
                'subida' => $usuario->arl_subida_en?->toIso8601String(),
            ] : null,
        ];
    }

    /** @return list<array<string, mixed>> Sus asignaciones vigentes: empresa (o toda la línea), sede, sucursal, líneas y fin. */
    private static function asignaciones(User $usuario): array
    {
        return $usuario->vigentes()->map(fn (Asignacion $a) => [
            'empresa' => $a->empresa?->nombre,
            'sede' => $a->sede?->nombre,
            'sucursal' => $a->sucursal?->nombre,
            'lineas' => $a->lineas->pluck('nombre')->all(),
            'hasta' => $a->fecha_fin?->toDateString(),
        ])->values()->all();
    }

    /** La versión en la dirección evita que el navegador muestre el archivo anterior tras reemplazarlo. */
    public static function version(?string $ruta): string
    {
        return substr(md5((string) $ruta), 0, 8);
    }

    public static function esPdf(?string $ruta): bool
    {
        return Str::lower(pathinfo((string) $ruta, PATHINFO_EXTENSION)) === 'pdf';
    }

    public static function respuestaFoto(User $usuario): StreamedResponse
    {
        return self::respuestaArchivo($usuario->foto_path, 'foto-'.Str::slug($usuario->name));
    }

    public static function respuestaArl(User $usuario): StreamedResponse
    {
        return self::respuestaArchivo($usuario->arl_path, 'arl-'.Str::slug($usuario->name));
    }

    /** Un archivo privado (nunca tiene dirección pública): se abre en el navegador, sin indexarse. */
    private static function respuestaArchivo(?string $ruta, string $nombre): StreamedResponse
    {
        abort_unless($ruta && Storage::disk('local')->exists($ruta), 404);

        return Storage::disk('local')->response($ruta, $nombre.'.'.pathinfo($ruta, PATHINFO_EXTENSION), [
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
            'X-Robots-Tag' => 'noindex',
        ]);
    }
}
