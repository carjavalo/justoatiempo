<?php

namespace App\Console\Commands;

use App\Enums\Rol;
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
 * ingresar: cambia su correo y su contraseña. La contraseña se escribe oculta y no queda en el historial.
 */
class AccesoAdministrador extends Command
{
    protected $signature = 'admin:acceso';

    protected $description = 'Cambia el correo y la contraseña de un administrador (para recuperar el acceso)';

    public function handle(): int
    {
        $admins = User::where('rol', Rol::Admin)->orderBy('id')->get();
        if ($admins->isEmpty()) {
            $this->components->error('No hay ningún administrador en la base de datos.');

            return self::FAILURE;
        }

        $admin = $admins->count() === 1 ? $admins->first() : $admins->firstWhere('id', (int) select(
            label: '¿A cuál administrador le cambias el acceso?',
            options: $admins->mapWithKeys(fn (User $u) => [$u->id => "{$u->name} ({$u->email})"])->all(),
        ));
        $this->components->info("Administrador: {$admin->name} ({$admin->email})");

        $correo = text(
            label: 'Correo nuevo',
            default: $admin->email,
            required: true,
            validate: fn (string $valor) => $this->errorDe(
                ['correo' => trim($valor)],
                ['correo' => ['email', 'max:255', Rule::unique('users', 'email')->ignore($admin->id)]],
            ),
            hint: 'Enter deja el actual.',
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
