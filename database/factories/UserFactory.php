<?php

namespace Database\Factories;

use App\Enums\Rol;
use App\Models\Asignacion;
use App\Models\Empresa;
use App\Models\LineaServicio;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use WeakMap;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'rol' => Rol::Auxiliar,
            'activo' => true,
        ];
    }

    /** Dónde se pidió asignar a cada persona creada (empresa_id, sede_id, sucursal_id, linea_servicio_id). */
    private static ?WeakMap $lugares = null;

    /**
     * Las pruebas pueden pedir dónde trabaja la persona como antes (empresa_id, sede_id, sucursal_id y
     * linea_servicio_id): se convierte en una asignación indefinida. Sin pedirlo, el personal queda asignado a toda
     * la línea logística y el administrador (que las ve todas) sin asignación.
     */
    public function configure(): static
    {
        self::$lugares ??= new WeakMap;

        return $this
            ->afterMaking(function (User $user) {
                $lugar = [];
                foreach (['empresa_id', 'sede_id', 'sucursal_id', 'linea_servicio_id'] as $campo) {
                    if (array_key_exists($campo, $user->getAttributes())) {
                        $lugar[$campo] = $user->getAttributes()[$campo];
                        unset($user->{$campo});
                    }
                }
                self::$lugares[$user] = $lugar;
            })
            ->afterCreating(function (User $user) {
                $lugar = self::$lugares[$user] ?? [];
                $linea = array_key_exists('linea_servicio_id', $lugar)
                    ? $lugar['linea_servicio_id']
                    : ($user->rol === Rol::Admin ? null : LineaServicio::where('modulo', LineaServicio::LOGISTICA)->value('id'));
                $empresa = $lugar['empresa_id'] ?? null;
                if ($linea === null && $empresa === null) {
                    return;
                }

                $asignacion = Asignacion::create([
                    'user_id' => $user->id,
                    'empresa_id' => $empresa,
                    'sede_id' => $lugar['sede_id'] ?? null,
                    'sucursal_id' => $lugar['sucursal_id'] ?? null,
                    'fecha_inicio' => today()->subYear()->toDateString(),
                    'duracion' => 'indefinida',
                ]);
                $asignacion->lineas()->sync($linea ? [$linea] : Empresa::find($empresa)->lineas()->pluck('lineas_servicio.id')->all());
            });
    }

    public function admin(): static
    {
        return $this->state(fn () => ['rol' => Rol::Admin]);
    }

    public function coordinador(): static
    {
        return $this->state(fn () => ['rol' => Rol::Coordinador]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
