<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditoriaPod extends Model
{
    public const MIN_FOTOS_SELLADO = 4;

    public const MIN_FOTOS_DESTAPADO = 4;

    protected $table = 'auditorias_pod';

    protected $fillable = [
        'orden_id', 'foto_fachada', 'fotos_sellado', 'fotos_destapado', 'foto_remesa',
        'foto_rotulo', 'recibe_sin_destapar', 'sin_evidencia', 'cumple_protocolo',
        'tipo_novedad_id', 'concepto', 'auditado_por', 'auditado_en',
    ];

    protected function casts(): array
    {
        return [
            'foto_fachada' => 'boolean',
            'foto_remesa' => 'boolean',
            'foto_rotulo' => 'boolean',
            'recibe_sin_destapar' => 'boolean',
            'sin_evidencia' => 'boolean',
            'cumple_protocolo' => 'boolean',
            'auditado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Sin "return": si el listener devolviera false, Eloquent cancelaría el guardado
        static::saving(function (AuditoriaPod $a) {
            $a->cumple_protocolo = $a->evaluarProtocolo();
        });
    }

    /** RF-09 y RF-10: fachada + 4 sellado + (4 destapado o nota "sin destapar") + remesa. */
    public function evaluarProtocolo(): bool
    {
        if ($this->sin_evidencia) {
            return false;
        }

        $destapadoOk = $this->fotos_destapado >= self::MIN_FOTOS_DESTAPADO || $this->recibe_sin_destapar;

        return $this->foto_fachada
            && $this->fotos_sellado >= self::MIN_FOTOS_SELLADO
            && $destapadoOk
            && $this->foto_remesa;
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class);
    }

    public function tipoNovedad(): BelongsTo
    {
        return $this->belongsTo(TipoNovedad::class);
    }

    public function auditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auditado_por');
    }
}
