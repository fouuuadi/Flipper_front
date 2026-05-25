import { env } from "@config/env";
import type { GameMode } from "@core/gameMachine.types";

/**
 * Couche d'accès isolée pour les endpoints liés à l'identification.
 * Contrat aligné sur Flipper_back/docs/FRONTEND_INTEGRATION.md §4 (sessions).
 */

export interface CreateSessionRequest {
  readonly pseudo: string;
  readonly mode: GameMode;
  readonly room_code: string | null;
}

export interface CreateSessionResponse {
  readonly session_id: string;
  readonly pseudo: string;
  readonly status: string;
  readonly mode: string;
  readonly room_code: string | null;
}

export interface ReadyUpResponse {
  readonly session_id: string;
  readonly status: string;
}

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

async function parseError(response: Response): Promise<ApiError> {
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

export async function createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(`${env.apiBaseUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as CreateSessionResponse;
}

export async function readySession(sessionId: string): Promise<ReadyUpResponse> {
  const response = await fetch(`${env.apiBaseUrl}/sessions/${sessionId}/ready`, {
    method: "POST",
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ReadyUpResponse;
}
