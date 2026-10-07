<?php

namespace App\Http\Requests\Settings;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['nombres', 'primer_apellido', 'segundo_apellido'] as $campo) {
            if (is_string($valor = $this->input($campo))) {
                $this->merge([$campo => trim($valor) ?: null]);
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nombres' => ['required', 'string', 'max:80'],
            'primer_apellido' => ['required', 'string', 'max:80'],
            'segundo_apellido' => ['nullable', 'string', 'max:80'],

            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
        ];
    }

    public function attributes(): array
    {
        return ['nombres' => 'los nombres', 'primer_apellido' => 'el primer apellido', 'segundo_apellido' => 'el segundo apellido'];
    }
}
