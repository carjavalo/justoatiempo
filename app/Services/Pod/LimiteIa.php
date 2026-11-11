<?php

namespace App\Services\Pod;

/** La IA pidió esperar (límite de su plan): cuántos segundos. */
class LimiteIa extends \RuntimeException
{
    public function __construct(public readonly int $segundos)
    {
        parent::__construct("La IA pide esperar {$segundos} s.");
    }
}
