<?php

namespace App\Models;

use App\Enums\EstadoOrden;
use App\Services\ConsolidadorInforme;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Orden extends Model
{
    protected $table = 'ordenes';

    protected $fillable = [
        'carga_id', 'informe_id', 'fecha_operacion', 'sede_id', 'sucursal_id', 'ruta',
        'vehiculo_id', 'placa', 'auxiliar_id', 'auxiliar_nombre', 'auxiliar_cedula',
        'codigo_orden', 'codigo_direccion', 'destinatario', 'direccion', 'ciudad', 'unidades',
        'productos', 'productos_entregados', 'tiene_imagenes',
        'estado', 'motivo_rechazo_id', 'motivo_texto', 'comentario_pod', 'hora_entrega',
        'devolucion', 'averia', 'averia_detalle', 'faltante', 'faltante_detalle', 'datos_crudos',
    ];

    protected function casts(): array
    {
        return [
            'fecha_operacion' => 'date',
            'estado' => EstadoOrden::class,
            'hora_entrega' => 'datetime',
            'devolucion' => 'boolean',
            'averia' => 'boolean',
            'faltante' => 'boolean',
            'tiene_imagenes' => 'boolean',
            'datos_crudos' => 'array',
        ];
    }

    protected static function booted(): void
    {
        // RF-07: toda orden rechazada genera devolución
        static::saving(function (Orden $orden) {
            $orden->devolucion = $orden->estado === EstadoOrden::Rechazada;
        });
    }

    /**
     * Las entregas importadas con la cédula de una persona que aún no estaba registrada quedan a su nombre; si le
     * cambian la cédula, las de la anterior dejan de ser suyas. Sus informes se recalculan (los cerrados también:
     * solo cambia de quién es cada fila, no su estado).
     */
    public static function asignarAPersona(User $persona, ?string $cedulaAnterior = null): void
    {
        $informes = collect();

        if (filled($cedulaAnterior) && $cedulaAnterior !== $persona->cedula) {
            $suyas = self::where('auxiliar_id', $persona->id)->where('auxiliar_cedula', $cedulaAnterior);
            $informes = $informes->merge($suyas->clone()->whereNotNull('informe_id')->distinct()->pluck('informe_id'));
            $suyas->update(['auxiliar_id' => null]);
        }
        if (filled($persona->cedula)) {
            $nuevas = self::whereNull('auxiliar_id')->where('auxiliar_cedula', $persona->cedula);
            $informes = $informes->merge($nuevas->clone()->whereNotNull('informe_id')->distinct()->pluck('informe_id'));
            $nuevas->update(['auxiliar_id' => $persona->id]);
        }

        $consolidador = app(ConsolidadorInforme::class);
        foreach (InformeDiario::whereIn('id', $informes->unique())->whereNotNull('sede_id')->get() as $informe) {
            $consolidador->consolidar($informe->fecha_operacion, $informe->sede_id, $informe->sucursal_id, aunCerrado: true);
        }
    }

    public function carga(): BelongsTo
    {
        return $this->belongsTo(Carga::class);
    }

    public function informe(): BelongsTo
    {
        return $this->belongsTo(InformeDiario::class, 'informe_id');
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }

    public function vehiculo(): BelongsTo
    {
        return $this->belongsTo(Vehiculo::class);
    }

    /** El auxiliar de la ruta (la persona; el nombre como venía en Drivin queda en auxiliar_nombre). */
    public function auxiliar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auxiliar_id');
    }

    public function motivoRechazo(): BelongsTo
    {
        return $this->belongsTo(MotivoRechazo::class);
    }

    public function auditoria(): HasOne
    {
        return $this->hasOne(AuditoriaPod::class);
    }

    public function evidencias(): HasMany
    {
        return $this->hasMany(Evidencia::class);
    }
}
