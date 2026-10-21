<?php

namespace App\Console\Commands;

use App\Enums\Rol;
use App\Models\RolUsuario;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\select;
use function Laravel\Prompts\text;

/**
 * Recupera el acceso de un administrador desde el servidor (p. ej. la Terminal de cPanel) cuando ya no puede
 * ingresar: cambia su correo y su contraseña y le devuelve el rol Administrador (que lo puede todo). La contraseña
 * se escribe oculta y no queda en el historial.
 */
class AccesoAdministrador extends Command
{
    protected $signature = 'admin:acceso';

    protected $description = 'Cambia el correo y la contraseña de un administrador y le devuelve el acceso a la plataforma (para recuperarlo)';

    public function handle(): int
    {
        $administrador = RolUsuario::administrador();
        $admins = User::where('rol', Rol::Admin)->orWhere('rol_id', $administrador?->id)->orderBy('id')->get();
        // Si nadie quedó con acceso de administrador, se le puede devolver a cualquier persona
        if ($admins->isEmpty()) {
            $admins = User::orderBy('id')->get();
        }
        if ($admins->isEmpty()) {
            $this->components->error('No hay ningún usuario en la base de datos.');

            return self::FAILURE;
        }

        $admin = $admins->count() === 1 ? $admins->first() : $admins->firstWhere('id', (int) select(
            label: '¿A cuál administrador le cambias el acceso?',
            options: $admins->mapWithKeys(fn (User $u) => [$u->id => "{$u->name} (".($u->email ?? 'sin correo').($u->acceso ? '' : ', sin acceso').')'])->all(),
        ));
        $this->components->info("Administrador: {$admin->name} (".($admin->email ?? 'sin correo').')');

        $correo = text(
            label: 'Correo nuevo',
            default: (string) $admin->email,
            required: true,
            validate: fn (string $valor) => $this->errorDe(
                ['correo' => trim($valor)],
                ['correo' => ['email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)]],
            ),
            hint: $admin->email ? 'Enter deja el actual.' : 'No tiene correo: escribe uno.',
        );

        $clave = password(
            label: 'Contraseña nueva',
            required: true,
            validate: fn (string $valor) => $this->errorDe(['contraseña' => $valor], ['contraseña' => [Password::defaults()]]),
            hint: 'Mínimo 8 caracteres. No se ve mientras la escribes.',
        );
        password(
            label: 'Repite la contraseña nueva',
            required: true,
            validate: fn (string $valor) => $valor === $clave ? null : 'No coincide con la contraseña nueva.',
        );

        $admin->forceFill([
            'email' => Str::lower(trim($correo)),
            'password' => $clave,
            'remember_token' => Str::random(60),
            'activo' => true,
            'acceso' => true,
            // Con el rol Administrador de vuelta, puede corregir cualquier otro acceso
            'rol_id' => $administrador?->id ?? $admin->rol_id,
        ])->save();

        // Quien siguiera dentro con la contraseña anterior (en otro equipo) queda por fuera
        if (config('session.driver') === 'database') {
            DB::connection(config('session.connection'))->table(config('session.table'))->where('user_id', $admin->id)->delete();
        }

        $this->components->info("Listo. Ya puedes ingresar con {$admin->email} y la contraseña nueva.");

        return self::SUCCESS;
    }

    /** Primer error de validación, en español, o null si el valor sirve. */
    private function errorDe(array $datos, array $reglas): ?string
    {
        $validacion = Validator::make($datos, $reglas);

        return $validacion->fails() ? $validacion->errors()->first() : null;
    }
}
