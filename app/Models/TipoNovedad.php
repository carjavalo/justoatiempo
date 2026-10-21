<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TipoNovedad extends Model
{
    /** Los que la auditoría sugiere sola (App\Services\Pod\EvaluadorProtocolo): su nombre no se cambia. */
    public const DEL_SISTEMA = [
        'Buen protocolo de entrega', 'Entregado sin destapar con nota en remesa', 'Falta foto de fachada',
        'Faltan fotos de producto sellado', 'Faltan fotos de producto destapado', 'Falta remesa firmada',
        'Falta foto de fachada y remesa firmada', 'Sin evidencia', 'Fotos borrosas o ilegibles', 'Buen protocolo de entrega pero puede mejorar',
    ];

    protected $table = 'tipos_novedad';

    protected $fillable = ['nombre', 'severidad', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(AuditoriaPod::class);
    }
}
