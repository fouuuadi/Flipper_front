import { env } from "@config/env";
import { ApiError, parseApiError } from "@services/apiError";

/**
 * Endpoint POST /scores — flush atomique de la session Redis → DB.
 * Aligné sur Flipper_back/docs/FRONTEND_INTEGRATION.md §4 (/scores) + §3 #78.
 *
 * Le payload utilise camelCase côté client (contrat back explicite).
 */

export interface FinishSessionRequest {
  readonly sessionId: string;
}

export interface FinishSessionResponse {
  readonly ok: boolean;
  readonly finalScore: number;
  readonly playerId: number;
  readonly gameId: number;
  readonly eventCount: number;
  /** null en 1v1 (pas de notion de record perso). */
  readonly improved: boolean | null;
  readonly previousBest: number | null;
}

export { ApiError };

export async function finishScore(sessionId: string): Promise<FinishSessionResponse> {
  const response = await fetch(`${env.apiBaseUrl}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId } satisfies FinishSessionRequest),
  });
  if (!response.ok) throw await parseApiError(response);
  return (await response.json()) as FinishSessionResponse;
}
