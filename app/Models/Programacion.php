<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Programacion extends Model
{
    protected $table = 'programaciones';

    protected $fillable = [
        'fecha', 'cliente_id', 'sede_id', 'auxiliares_requeridos',
        'vehiculos_requeridos', 'observaciones', 'creado_por',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date'];
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function asignaciones(): HasMany
    {
        return $this->hasMany(ProgramacionAsignacion::class);
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}
