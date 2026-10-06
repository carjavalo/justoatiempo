<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Parametro extends Model
{
    protected $fillable = ['clave', 'valor', 'descripcion'];

    public static function valor(string $clave, mixed $defecto = null): mixed
    {
        return Cache::rememberForever("parametro.$clave", fn () => static::where('clave', $clave)->value('valor')) ?? $defecto;
    }

    protected static function booted(): void
    {
        static::saved(fn (Parametro $p) => Cache::forget("parametro.{$p->clave}"));
        static::deleted(fn (Parametro $p) => Cache::forget("parametro.{$p->clave}"));
    }
}
