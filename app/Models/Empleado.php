<?php

namespace App\Models;

use App\Enums\CargoEmpleado;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Empleado extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'cedula', 'nombres', 'apellidos', 'cargo', 'telefono', 'email',
        'fecha_ingreso', 'activo', 'foto_path', 'observaciones',
    ];

    protected $appends = ['nombre_completo'];

    protected function casts(): array
    {
        return [
            'cargo' => CargoEmpleado::class,
            'fecha_ingreso' => 'date',
            'activo' => 'boolean',
        ];
    }

    protected function nombreCompleto(): Attribute
    {
        return Attribute::get(fn () => trim($this->nombres.' '.$this->apellidos));
    }

    public function usuario(): HasOne
    {
        return $this->hasOne(User::class);
    }

    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class);
    }

    public function acciones(): HasMany
    {
        return $this->hasMany(AccionDesempeno::class);
    }

    public function asignaciones(): HasMany
    {
        return $this->hasMany(ProgramacionAsignacion::class);
    }
}
