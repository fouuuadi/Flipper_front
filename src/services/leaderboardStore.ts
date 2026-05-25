import { env } from "@config/env";
import { parseApiError } from "./apiError";
import type { GameMode } from "@core/gameMachine.types";

/**
 * Couche d'accès aux classements.
 * Aligné sur Flipper_back/docs/FRONTEND_INTEGRATION.md §4 (/leaderboard) + §3 #81.
 *
 * Deux implémentations interchangeables :
 *   - `HttpLeaderboardStore` : lit via `GET /leaderboard`. La sauvegarde côté back
 *     passe par `POST /scores` (cf. issue #78), donc `save()` est inutilisable ici.
 *   - `LocalStorageLeaderboardStore` : mock dev offline / tests, persistance JSON.
 *
 * Le consommateur (écran leaderboard, gameOver) dépend de l'interface, pas de l'impl.
 */

export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerId: number | null;
  readonly pseudo: string;
  readonly score: number;
}

export interface NewLeaderboardEntry {
  readonly mode: GameMode;
  readonly playerId: number | null;
  readonly pseudo: string;
  readonly score: number;
}

export interface ListOptions {
  readonly mode: GameMode;
  readonly limit?: number;
}

export interface LeaderboardStore {
  list(opts: ListOptions): Promise<LeaderboardEntry[]>;
  save(entry: NewLeaderboardEntry): Promise<void>;
  clear(): Promise<void>;
}

// ─── HTTP impl ──────────────────────────────────────────────────────────

interface LeaderboardEntryDTO {
  readonly rank: number;
  readonly player_id: number;
  readonly pseudo: string;
  readonly score: number;
}

interface LeaderboardResponseDTO {
  readonly mode: string | null;
  readonly limit: number;
  readonly entries: ReadonlyArray<LeaderboardEntryDTO>;
}

export class HttpLeaderboardStore implements LeaderboardStore {
  constructor(private readonly baseUrl: string = env.apiBaseUrl) {}

  async list({ mode, limit = 10 }: ListOptions): Promise<LeaderboardEntry[]> {
    const url = `${this.baseUrl}/leaderboard?mode=${mode}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw await parseApiError(response);
    const body = (await response.json()) as LeaderboardResponseDTO;
    return body.entries.map((e) => ({
      rank: e.rank,
      playerId: e.player_id,
      pseudo: e.pseudo,
      score: e.score,
    }));
  }

  save(): Promise<void> {
    // La sauvegarde côté back passe par POST /scores (cf. issue #78 et la doc
    // back §3 #78). HttpLeaderboardStore n'expose volontairement pas ce flow.
    return Promise.reject(
      new Error("HttpLeaderboardStore.save: use POST /scores via gameOver flow"),
    );
  }

  clear(): Promise<void> {
    return Promise.reject(new Error("HttpLeaderboardStore.clear: not supported by backend"));
  }
}

// ─── localStorage impl ──────────────────────────────────────────────────

const STORAGE_KEY = "flipper:leaderboard:v1";

interface PersistedEntry {
  readonly mode: GameMode;
  readonly playerId: number | null;
  readonly pseudo: string;
  readonly score: number;
  readonly createdAt: number;
}

export class LocalStorageLeaderboardStore implements LeaderboardStore {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly key: string = STORAGE_KEY,
  ) {}

  async list({ mode, limit = 10 }: ListOptions): Promise<LeaderboardEntry[]> {
    const all = this.readAll();
    return all
      .filter((e) => e.mode === mode)
      .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((e, i) => ({
        rank: i + 1,
        playerId: e.playerId,
        pseudo: e.pseudo,
        score: e.score,
      }));
  }

  async save(entry: NewLeaderboardEntry): Promise<void> {
    const all = this.readAll();
    all.push({ ...entry, createdAt: Date.now() });
    this.storage.setItem(this.key, JSON.stringify(all));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key);
  }

  private readAll(): PersistedEntry[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as PersistedEntry[];
    } catch {
      return [];
    }
  }
}
