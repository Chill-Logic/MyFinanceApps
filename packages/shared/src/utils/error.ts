const DEFAULT_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/**
 * Extrai a mensagem de erro que o backend envia no corpo da resposta
 * (ex: `{ "message": "Senha inválida." }`), caindo pro `fallback` quando
 * a resposta não traz nada aproveitável. Recebe `unknown` de propósito —
 * não depende dos tipos do axios, só cava o formato de forma defensiva.
 */
export const getApiErrorMessage = (error: unknown, fallback: string = DEFAULT_MESSAGE): string => {
	const response_data = (error as { response?: { data?: unknown } } | null)?.response?.data;

	if (typeof response_data === 'string' && response_data.trim()) {
		return response_data;
	}

	if (response_data && typeof response_data === 'object' && 'message' in response_data) {
		const { message } = response_data as { message?: unknown };

		if (typeof message === 'string' && message.trim()) {
			return message;
		}
	}

	return fallback;
};
