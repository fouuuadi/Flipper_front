import { env } from "@config/env";
import { ApiError, parseApiError } from "@services/apiError";
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

export { ApiError };

export async function createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(`${env.apiBaseUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseApiError(response);
  return (await response.json()) as CreateSessionResponse;
}

export async function readySession(sessionId: string): Promise<ReadyUpResponse> {
  const response = await fetch(`${env.apiBaseUrl}/sessions/${sessionId}/ready`, {
    method: "POST",
  });
  if (!response.ok) throw await parseApiError(response);
  return (await response.json()) as ReadyUpResponse;
}
