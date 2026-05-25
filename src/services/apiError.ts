/**
 * Erreurs HTTP partagées par les couches d'accès au backend.
 * Aligné sur Flipper_back/docs/FRONTEND_INTEGRATION.md §8 (format d'erreur).
 */

export interface ApiErrorBody {
  readonly error: string;
  readonly detail: string;
}

interface PydanticValidationBody {
  readonly detail: ReadonlyArray<{
    readonly loc: ReadonlyArray<string | number>;
    readonly msg: string;
    readonly type: string;
  }>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parse le body d'une `Response` non-OK et construit un `ApiError`.
 * Distingue ApiError (detail: string) vs validation Pydantic (detail: array).
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("x-request-id");
  let code = "UnknownError";
  let message = `HTTP ${response.status}`;

  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") {
        const { error, detail: msg } = body as ApiErrorBody;
        code = error;
        message = msg;
      } else if (Array.isArray(detail)) {
        const first = (body as PydanticValidationBody).detail[0];
        code = "ValidationError";
        message = first ? `${first.loc.join(".")}: ${first.msg}` : "Validation failed";
      }
    }
  } catch {
    // body non-JSON — on garde le message HTTP générique
  }

  return new ApiError(response.status, code, message, requestId);
}
