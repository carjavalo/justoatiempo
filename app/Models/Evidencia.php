<?php

namespace App\Models;

use App\Enums\TipoEvidencia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Evidencia extends Model
{
    protected $fillable = [
        'orden_id', 'tipo', 'path', 'nombre_original', 'mime', 'tamano_bytes', 'pagina_pdf', 'subido_por',
    ];

    protected function casts(): array
    {
        return ['tipo' => TipoEvidencia::class];
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class);
    }
}
