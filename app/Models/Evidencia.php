<?php

namespace App\Models;

use App\Enums\TipoEvidencia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Evidencia extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'orden_id', 'tipo', 'path', 'hash', 'nombre_original', 'mime', 'tamano_bytes', 'pagina_pdf', 'origen_id', 'imagenes', 'datos', 'ia', 'subido_por',
    ];

    protected function casts(): array
    {
        // datos: lo que dice el PDF de prueba de entrega (LectorPod); ia: lo que propuso la IA de la foto (RevisorIa)
        return ['tipo' => TipoEvidencia::class, 'datos' => 'array', 'ia' => 'array'];
    }

    public function esPdf(): bool
    {
        return $this->mime === 'application/pdf';
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class);
    }

    /** Las fotos y la firma que se separaron de este PDF. */
    public function separadas(): HasMany
    {
        return $this->hasMany(self::class, 'origen_id');
    }

    public function subidoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subido_por')->withTrashed();
    }
}
