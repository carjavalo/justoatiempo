<?php

namespace App\Services;

use App\Models\Empresa;
use App\Models\RolUsuario;
use App\Models\User;
use App\Services\Drivin\MapeoColumnas;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Csv;
use PhpOffice\PhpSpreadsheet\Shared\Date as FechaExcel;
use RuntimeException;

/**
 * Importa el Excel del personal (como "AUXILIARES ACTIVOS.xlsx": cédula, nombres, apellidos, cargo, operación, ciudad,
 * teléfono, correo, nacimiento e ingreso) a Usuarios: cada persona queda con su carnet (y, si se elige, entra con su
 * cédula) y, si la operación corresponde a una empresa, asignada a ella con sus líneas.
 *
 * Quien ya existe (por cédula) no se reemplaza ni se duplica: solo se le completan los datos que le falten, si quien
 * importa puede editarla, y si el archivo la pone en otra empresa, se le agrega esa asignación (una misma persona puede
 * estar en varias). Nunca se muestra a alguien que quien importa no alcanza a ver.
 */
class ImportadorPersonal
{
    private const FILAS_BUSQUEDA_ENCABEZADO = 15;

    /** campo => alias normalizados de su encabezado (exacto, o el encabezado empieza por el alias). */
    private const COLUMNAS = [
        'cedula' => ['cedula', 'numero de cedula', 'no de cedula', 'n de cedula', 'cedula de ciudadania', 'documento', 'numero de documento', 'no documento', 'identificacion', 'cc'],
        'primer_nombre' => ['primer nombre'],
        'segundo_nombre' => ['segundo nombre'],
        'nombre_completo' => ['nombre completo', 'nombres y apellidos', 'nombre y apellidos', 'apellidos y nombres'],
        'nombres' => ['nombres', 'nombre'],
        'primer_apellido' => ['primer apellido'],
        'segundo_apellido' => ['segundo apellido'],
        'apellidos' => ['apellidos'],
        'cargo' => ['cargo'],
        'operacion' => ['operacion', 'empresa', 'cliente'],
        'ciudad' => ['ciudad', 'municipio'],
        'telefono' => ['telefono', 'celular', 'movil', 'numero de telefono', 'numero de celular'],
        'email' => ['correo', 'correo electronico', 'email', 'e mail'],
        'fecha_nacimiento' => ['fecha nacimiento', 'fecha de nacimiento'],
        'fecha_ingreso' => ['fecha de ingreso', 'fecha ingreso'],
    ];

    /** Palabras frecuentes en los cargos que el Excel trae sin tilde. */
    private const TILDES = [
        'logistico' => 'logístico', 'logistica' => 'logística', 'operacion' => 'operación', 'tecnico' => 'técnico',
        'mecanico' => 'mecánico', 'electrico' => 'eléctrico', 'jardin' => 'jardín', 'produccion' => 'producción',
        'vehiculo' => 'vehículo',
    ];

    /** Lo que se escribe cuando no hay dato. */
    private const VACIOS = ['', '-', '.', 'na', 'n a', 'no tiene', 'no aplica', 'ninguno', 'sin correo', 'sin dato'];

    /**
     * @return array{columnas: array<string, int>, filas: list<array{fila: int, datos: array<string, mixed>}>}
     */
    public function leer(string $ruta): array
    {
        try {
            $lector = IOFactory::createReaderForFile($ruta);
        } catch (\Throwable) {
            throw new RuntimeException('No se reconoce el formato del archivo. Usa un Excel (.xlsx o .xls) o un CSV.');
        }
        if ($lector instanceof Csv) {
            // La muestra se corta en un carácter completo: si no, una "Ñ" partida haría creer que no es UTF-8
            $muestra = preg_replace('/[\xC0-\xFF][\x80-\xBF]*$/', '', (string) file_get_contents($ruta, false, null, 0, 4096));
            $lector->setInputEncoding(mb_check_encoding($muestra, 'UTF-8') ? 'UTF-8' : 'Windows-1252');
            $lector->setDelimiter(substr_count($muestra, ';') > substr_count($muestra, ',') ? ';' : ',');
        } else {
            $lector->setReadDataOnly(true);
        }

        try {
            $datos = $lector->load($ruta)->getActiveSheet()->toArray(null, true, false, false);
        } catch (\Throwable) {
            throw new RuntimeException('El archivo está dañado o protegido y no se pudo leer.');
        }

        // La fila de encabezados es la primera que trae la cédula y algún nombre
        foreach (array_slice($datos, 0, self::FILAS_BUSQUEDA_ENCABEZADO, true) as $i => $fila) {
            $columnas = $this->columnas($fila);
            if (isset($columnas['cedula']) && (isset($columnas['primer_nombre']) || isset($columnas['nombres']) || isset($columnas['nombre_completo']))) {
                $filas = [];
                foreach (array_slice($datos, $i + 1, null, true) as $j => $valores) {
                    $registro = array_map(fn (int $c) => $valores[$c] ?? null, $columnas);
                    if (collect($registro)->filter(fn ($v) => ! $this->vacio($v))->isNotEmpty()) {
                        $filas[] = ['fila' => $j + 1, 'datos' => $registro];
                    }
                }

                return ['columnas' => $columnas, 'filas' => $filas];
            }
        }

        throw new RuntimeException('No se encontró la fila de encabezados: el archivo debe tener columnas como CÉDULA, PRIMER NOMBRE (o NOMBRES) y PRIMER APELLIDO.');
    }

    /**
     * Qué pasará con cada fila, sin escribir nada.
     *
     * @param  array{columnas: array<string, int>, filas: list<array{fila: int, datos: array<string, mixed>}>}  $lectura
     * @param  array<string, int|null>  $empresasElegidas  "operación" (normalizada) => empresa (o null: sin asignación)
     * @return array{filas: list<array<string, mixed>>, operaciones: list<array{clave: string, valor: string, empresaId: int|null, sugerida: bool, personas: int}>, resumen: array<string, int>}
     */
    public function analizar(array $lectura, User $quien, array $empresasElegidas = []): array
    {
        $existentes = User::whereIn('cedula', collect($lectura['filas'])->map(fn ($f) => $this->cedula($f['datos']['cedula'] ?? null))->filter())
            ->with(['asignaciones' => fn ($q) => $q->actuales()])
            ->get()->keyBy('cedula');
        $asignables = $this->empresasAsignables($quien);
        // Correo (en minúsculas) => cédula de su dueño (null si no tiene)
        $correosTomados = User::whereNotNull('email')->get(['email', 'cedula'])->mapWithKeys(fn (User $u) => [mb_strtolower($u->email) => $u->cedula]);
        $empresas = Empresa::where('activo', true)->get(['id', 'nombre']);
        $puedeEditar = $quien->puede('usuarios.editar');

        $operaciones = [];
        $vistas = [];
        $correosArchivo = [];
        $filas = [];
        foreach ($lectura['filas'] as ['fila' => $numero, 'datos' => $d]) {
            $errores = [];
            $avisos = [];

            $cedula = $this->cedula($d['cedula'] ?? null);
            if (! $cedula) {
                $errores[] = 'Sin cédula válida (solo números, entre 5 y 12).';
            } elseif (isset($vistas[$cedula])) {
                $errores[] = "Cédula repetida: ya está en la fila {$vistas[$cedula]}.";
            } else {
                $vistas[$cedula] = $numero;
            }

            [$nombres, $primerApellido, $segundoApellido] = $this->nombre($d);
            if (! $nombres) {
                $errores[] = 'Sin nombre.';
            }
            if (! $primerApellido) {
                $errores[] = 'Sin primer apellido.';
            }

            $email = $this->texto($d['email'] ?? null);
            $email = $email !== null ? mb_strtolower($email) : null;
            if ($email !== null && ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $avisos[] = "El correo «{$email}» no es válido: se omite.";
                $email = null;
            } elseif ($email !== null && (($correosTomados->has($email) && $correosTomados[$email] !== $cedula)
                || (isset($correosArchivo[$email]) && $correosArchivo[$email] !== $cedula))) {
                $avisos[] = "El correo {$email} ya es de otra persona: se omite.";
                $email = null;
            } elseif ($email !== null) {
                $correosArchivo[$email] = $cedula;
            }

            $nacimiento = $this->fecha($d['fecha_nacimiento'] ?? null, 'nacimiento', $avisos);
            if ($nacimiento && $nacimiento->gt(today()->subYears(14))) {
                $avisos[] = 'La fecha de nacimiento no es válida (menos de 14 años): se omite.';
                $nacimiento = null;
            }
            $ingreso = $this->fecha($d['fecha_ingreso'] ?? null, 'ingreso', $avisos);
            if ($ingreso && $ingreso->gt(today()->addMonth())) {
                $avisos[] = 'La fecha de ingreso está muy adelante: se omite.';
                $ingreso = null;
            }

            $telefono = $this->telefono($d['telefono'] ?? null, $avisos);

            $operacion = $this->texto($d['operacion'] ?? null);
            $empresaId = null;
            if ($operacion !== null) {
                $clave = MapeoColumnas::normalizar($operacion);
                $operaciones[$clave] ??= ['valor' => $operacion, 'sugerida' => $this->empresaParecida($operacion, $empresas), 'personas' => 0];
                $operaciones[$clave]['personas']++;
                $empresaId = array_key_exists($clave, $empresasElegidas) ? $empresasElegidas[$clave] : $operaciones[$clave]['sugerida'];
            }

            $datos = [
                'cedula' => $cedula,
                'nombres' => $nombres,
                'primer_apellido' => $primerApellido,
                'segundo_apellido' => $segundoApellido,
                'cargo' => $this->cargo($d['cargo'] ?? null),
                'ciudad' => ($c = $this->texto($d['ciudad'] ?? null)) ? $this->titulo($c) : null,
                'telefono' => $telefono,
                'email' => $email,
                'fecha_nacimiento' => $nacimiento?->toDateString(),
                'fecha_ingreso' => $ingreso?->toDateString(),
            ];

            $persona = $cedula ? ($existentes[$cedula] ?? null) : null;
            // Alguien que quien importa no puede editar: ni su nombre se muestra
            if ($persona && ! $quien->cubreA($persona)) {
                $errores[] = 'Esta cédula ya está registrada en una persona que no puedes editar.';
                $persona = null;
                $ajena = true;
            }
            $completa = $persona ? $this->completar($persona, $datos) : [];
            if ($completa !== [] && ! $puedeEditar) {
                $avisos[] = 'Tu rol no edita usuarios: sus datos no se completan.';
                $completa = [];
            }
            // Ya está en Usuarios y el archivo la pone en una empresa donde aún no trabaja: una asignación más, sin duplicarla
            $asignar = $persona !== null && $errores === [] && $empresaId !== null && in_array($empresaId, $asignables, true)
                && ! $persona->asignaciones->contains('empresa_id', $empresaId);
            if ($asignar) {
                $avisos[] = 'Ya está registrada: se le agrega la asignación en '.$empresas->firstWhere('id', $empresaId)?->nombre.'.';
            }
            $accion = match (true) {
                $errores !== [] => 'error',
                $persona === null => 'nueva',
                $completa !== [] || $asignar => 'completa',
                default => 'igual',
            };

            $filas[] = [
                'fila' => $numero,
                'accion' => $accion,
                'usuarioId' => $persona?->id,
                'nombre' => isset($ajena) ? 'Persona ya registrada' : ($persona?->name ?? User::nombreCompleto($nombres, $primerApellido, $segundoApellido)),
                ...$datos,
                'operacion' => $operacion,
                'empresaId' => $empresaId,
                'completa' => array_keys($completa),
                'asignar' => $asignar,
                'errores' => $errores,
                'avisos' => $avisos,
            ];
            unset($ajena);
        }

        return [
            'filas' => $filas,
            'operaciones' => collect($operaciones)->map(fn ($o, $clave) => [
                'clave' => (string) $clave,
                'valor' => $o['valor'],
                'empresaId' => array_key_exists($clave, $empresasElegidas) ? $empresasElegidas[$clave] : $o['sugerida'],
                'sugerida' => $o['sugerida'] !== null,
                'personas' => $o['personas'],
            ])->values()->all(),
            'resumen' => collect($filas)->countBy('accion')->all() + ['nueva' => 0, 'completa' => 0, 'igual' => 0, 'error' => 0],
        ];
    }

    /**
     * Las empresas a las que quien importa puede asignar personas: tiene permiso y están dentro de lo que ve.
     *
     * @return list<int>
     */
    public function empresasAsignables(User $quien): array
    {
        if (! $quien->puede('asignaciones.crear')) {
            return [];
        }

        return Empresa::where('activo', true)->with('lineas:id')->get()
            ->filter(fn (Empresa $e) => $e->lineas->isNotEmpty() && $quien->motivoFueraDeAlcance($e->id, null, null, $e->lineas->pluck('id')->all()) === null)
            ->pluck('id')->values()->all();
    }

    /**
     * Registra las personas nuevas (sin acceso, con el rol elegido) y completa los datos de las que ya estaban. Quien
     * importa con permiso de asignar deja a cada persona nueva asignada a su empresa, con sus líneas, desde su ingreso.
     *
     * @return array{nuevas: int, completadas: int, asignadas: int, sinAsignar: int, otraEmpresa: int}
     */
    /** @param  bool  $acceso  si las personas nuevas entran a la plataforma (con su cédula como contraseña inicial) */
    public function importar(array $analisis, RolUsuario $rol, User $quien, bool $acceso = true): array
    {
        $asignables = $this->empresasAsignables($quien);
        $empresas = Empresa::with('lineas:id')->whereIn('id', $asignables)->get()->keyBy('id');

        return DB::transaction(function () use ($analisis, $rol, $quien, $empresas, $acceso) {
            $resultado = ['nuevas' => 0, 'completadas' => 0, 'asignadas' => 0, 'sinAsignar' => 0, 'otraEmpresa' => 0];

            foreach ($analisis['filas'] as $f) {
                $datos = collect($f)->only(['cedula', 'nombres', 'primer_apellido', 'segundo_apellido', 'cargo', 'ciudad', 'telefono', 'email', 'fecha_nacimiento', 'fecha_ingreso'])->all();

                if ($f['accion'] === 'nueva') {
                    $persona = User::create([
                        ...$datos,
                        'cargo' => $datos['cargo'] ?? $rol->nombre,
                        'rol_id' => $rol->id,
                        'activo' => true,
                        'acceso' => $acceso,
                        // Entra con su cédula y su cédula como contraseña inicial, que cambia al ingresar
                        ...($acceso ? ['password' => $datos['cedula'], 'debe_cambiar_contrasena' => true] : []),
                    ]);
                    $resultado['nuevas']++;

                    $empresa = $f['empresaId'] ? $empresas->get($f['empresaId']) : null;
                    if ($empresa) {
                        $asignacion = $persona->asignaciones()->create([
                            'empresa_id' => $empresa->id,
                            'fecha_inicio' => $f['fecha_ingreso'] ?? today()->toDateString(),
                            'duracion' => 'indefinida',
                            'creada_por' => $quien->id,
                        ]);
                        $asignacion->lineas()->sync($empresa->lineas->pluck('id')->all());
                        $resultado['asignadas']++;
                    } else {
                        $resultado['sinAsignar']++;
                    }
                } elseif ($f['accion'] === 'completa' && ($persona = User::find($f['usuarioId'])) && $quien->cubreA($persona)) {
                    if ($f['completa'] !== [] && $quien->puede('usuarios.editar')) {
                        $persona->update($this->completar($persona, $datos));
                        $resultado['completadas']++;
                    }
                    $empresa = $f['asignar'] ? $empresas->get($f['empresaId']) : null;
                    if ($empresa) {
                        $asignacion = $persona->asignaciones()->create([
                            'empresa_id' => $empresa->id,
                            'fecha_inicio' => today()->toDateString(),
                            'duracion' => 'indefinida',
                            'creada_por' => $quien->id,
                        ]);
                        $asignacion->lineas()->sync($empresa->lineas->pluck('id')->all());
                        $resultado['otraEmpresa']++;
                    }
                }
            }

            return $resultado;
        });
    }

    /** @return array<string, mixed> Los datos del archivo que la persona aún no tiene. */
    private function completar(User $persona, array $datos): array
    {
        $faltan = [];
        foreach (['cargo', 'ciudad', 'telefono', 'email', 'fecha_nacimiento', 'fecha_ingreso', 'segundo_apellido'] as $campo) {
            if (blank($persona->{$campo}) && filled($datos[$campo] ?? null)) {
                $faltan[$campo] = $datos[$campo];
            }
        }

        return $faltan;
    }

    /**
     * Qué columna es cada campo: primero los encabezados idénticos a un alias y después los que empiezan por uno
     * ("TELÉFONO CELULAR", "FECHA DE INGRESO A LA EMPRESA").
     *
     * @param  array<int, mixed>  $fila
     * @return array<string, int>
     */
    private function columnas(array $fila): array
    {
        $norm = array_map(fn ($e) => MapeoColumnas::normalizar((string) $e), $fila);
        $columnas = [];
        foreach ([true, false] as $exacta) {
            foreach (self::COLUMNAS as $campo => $alias) {
                if (isset($columnas[$campo])) {
                    continue;
                }
                foreach ($norm as $i => $h) {
                    if ($h === '' || in_array($i, $columnas, true)) {
                        continue;
                    }
                    foreach ($alias as $a) {
                        if ($exacta ? $h === $a : str_starts_with($h, $a.' ')) {
                            $columnas[$campo] = $i;

                            continue 3;
                        }
                    }
                }
            }
        }

        return $columnas;
    }

    /** @return array{0: string|null, 1: string|null, 2: string|null} nombres, primer apellido, segundo apellido */
    private function nombre(array $d): array
    {
        // Una sola columna con el nombre completo: las dos últimas palabras son los apellidos ("Juan Fernando Plaza Benavides")
        if (! isset($d['primer_nombre']) && ! isset($d['nombres']) && ($completo = $this->texto($d['nombre_completo'] ?? null)) !== null) {
            $palabras = preg_split('/\s+/u', trim($completo));
            $apellidos = count($palabras) >= 3 ? array_splice($palabras, -2) : array_splice($palabras, -1);

            return [$palabras ? $this->titulo(implode(' ', $palabras)) : null, $this->titulo($apellidos[0]), isset($apellidos[1]) ? $this->titulo($apellidos[1]) : null];
        }

        $nombres = isset($d['primer_nombre'])
            ? trim(implode(' ', array_filter([$this->texto($d['primer_nombre']), $this->texto($d['segundo_nombre'] ?? null)])))
            : (string) $this->texto($d['nombres'] ?? null);
        $primero = $this->texto($d['primer_apellido'] ?? null);
        $segundo = $this->texto($d['segundo_apellido'] ?? null);
        // Una sola columna de apellidos: "Plaza Benavides"
        if ($primero === null && ($apellidos = $this->texto($d['apellidos'] ?? null)) !== null) {
            [$primero, $segundo] = array_pad(preg_split('/\s+/u', $apellidos, 2), 2, null);
        }

        return [$nombres !== '' ? $this->titulo($nombres) : null, $primero ? $this->titulo($primero) : null, $segundo ? $this->titulo($segundo) : null];
    }

    private function cedula(mixed $valor): ?string
    {
        $limpia = preg_replace('/[\s.,-]/', '', is_float($valor) ? number_format($valor, 0, '', '') : (string) $valor);

        return preg_match('/^\d{5,12}$/', (string) $limpia) ? $limpia : null;
    }

    /** El primer número de la celda ("313 714 7757 / 300 123 4567" → "3137147757"). */
    private function telefono(mixed $valor, array &$avisos): ?string
    {
        $texto = $this->texto($valor);
        if ($texto === null) {
            return null;
        }
        foreach (preg_split('/\s*(?:[\/,;|]|\so\s|\sy\s)\s*/iu', $texto) as $parte) {
            $numero = preg_replace('/[^0-9+]/', '', $parte);
            if (preg_match('/^\+?\d{7,15}$/', $numero)) {
                return $numero;
            }
        }
        $avisos[] = "El teléfono «{$texto}» no es válido: se omite.";

        return null;
    }

    /** "AUXILIAR LOGISTICO" → "Auxiliar logístico". */
    private function cargo(mixed $valor): ?string
    {
        $texto = $this->texto($valor);
        if ($texto === null) {
            return null;
        }
        $frase = implode(' ', array_map(fn ($p) => self::TILDES[$p] ?? $p, explode(' ', mb_strtolower(preg_replace('/\s+/u', ' ', $texto)))));

        return mb_substr(mb_strtoupper(mb_substr($frase, 0, 1)).mb_substr($frase, 1), 0, 60);
    }

    /** "JUAN  FERNANDO" → "Juan Fernando". */
    private function titulo(string $texto): string
    {
        return mb_convert_case(mb_strtolower(preg_replace('/\s+/u', ' ', trim($texto))), MB_CASE_TITLE);
    }

    private function texto(mixed $valor): ?string
    {
        if ($valor === null) {
            return null;
        }
        $texto = trim(is_float($valor) && floor($valor) === $valor ? number_format($valor, 0, '', '') : (string) $valor);

        return $this->vacio($texto) ? null : $texto;
    }

    private function vacio(mixed $valor): bool
    {
        return $valor === null || in_array(MapeoColumnas::normalizar((string) $valor), self::VACIOS, true);
    }

    /** Una fecha de Excel (número de serie) o escrita (15/05/2026, 5/3/1990, 2026-05-15); si no se entiende, un aviso. */
    private function fecha(mixed $valor, string $cual, array &$avisos): ?Carbon
    {
        if ($valor === null || trim((string) $valor) === '') {
            return null;
        }
        if (is_numeric($valor)) {
            try {
                return Carbon::instance(FechaExcel::excelToDateTimeObject((float) $valor))->startOfDay();
            } catch (\Throwable) {
                $avisos[] = "No se entiende la fecha de {$cual} «{$valor}»: se omite.";

                return null;
            }
        }

        $texto = trim((string) $valor);
        foreach (['d/m/Y', 'd-m-Y', 'Y-m-d', 'd/m/y'] as $formato) {
            $fecha = \DateTime::createFromFormat('!'.$formato, $texto);
            $problemas = \DateTime::getLastErrors();
            // Sin desbordes (31/02) ni texto de sobra; acepta días y meses sin cero inicial
            if ($fecha && ($problemas === false || ($problemas['warning_count'] === 0 && $problemas['error_count'] === 0))) {
                return Carbon::instance($fecha);
            }
        }
        $avisos[] = "No se entiende la fecha de {$cual} «{$texto}»: se omite.";

        return null;
    }

    /**
     * La empresa que corresponde al texto de "operación": el mismo nombre, o uno casi igual ("DITRANSA" y
     * "Ditransa"), si solo hay una así.
     *
     * @param  Collection<int, Empresa>  $empresas
     */
    private function empresaParecida(string $operacion, Collection $empresas): ?int
    {
        $buscado = MapeoColumnas::normalizar($operacion);
        $exacta = $empresas->first(fn (Empresa $e) => MapeoColumnas::normalizar($e->nombre) === $buscado);
        if ($exacta) {
            return $exacta->id;
        }

        $parecidas = $empresas->filter(fn (Empresa $e) => strlen($buscado) >= 5 && levenshtein($buscado, MapeoColumnas::normalizar($e->nombre)) <= 2);

        return $parecidas->count() === 1 ? $parecidas->first()->id : null;
    }
}
