<?php

namespace Database\Factories;

use App\Enums\Rol;
use App\Models\LineaServicio;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
            // El personal trabaja en una línea (por defecto la logística); el administrador las ve todas
            'linea_servicio_id' => fn (array $a) => in_array($a['rol'], [Rol::Admin, Rol::Admin->value], true)
                ? null
                : LineaServicio::where('modulo', LineaServicio::LOGISTICA)->value('id'),
        ];
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
