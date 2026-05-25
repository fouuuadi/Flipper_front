import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageLeaderboardStore } from "./leaderboardStore";

/** Mock minimal de l'interface DOM `Storage` (vitest tourne en env node). */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

let storage: MemoryStorage;
let store: LocalStorageLeaderboardStore;

beforeEach(() => {
  storage = new MemoryStorage();
  store = new LocalStorageLeaderboardStore(storage, "test:lb");
});

describe("LocalStorageLeaderboardStore — list", () => {
  it("retourne un tableau vide quand rien n'a été sauvegardé", async () => {
    const entries = await store.list({ mode: "solo" });
    expect(entries).toEqual([]);
  });

  it("filtre par mode", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "A#X", score: 100 });
    await store.save({ mode: "1v1", playerId: null, pseudo: "B#Y", score: 999 });
    const solo = await store.list({ mode: "solo" });
    expect(solo).toHaveLength(1);
    expect(solo[0].pseudo).toBe("A#X");
  });

  it("trie par score décroissant", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "LOW#1", score: 10 });
    await store.save({ mode: "solo", playerId: null, pseudo: "HIGH#2", score: 999 });
    await store.save({ mode: "solo", playerId: null, pseudo: "MID#3", score: 100 });
    const list = await store.list({ mode: "solo" });
    expect(list.map((e) => e.pseudo)).toEqual(["HIGH#2", "MID#3", "LOW#1"]);
  });

  it("attribue un rank 1-based contigu", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "A#1", score: 100 });
    await store.save({ mode: "solo", playerId: null, pseudo: "B#2", score: 50 });
    const list = await store.list({ mode: "solo" });
    expect(list[0].rank).toBe(1);
    expect(list[1].rank).toBe(2);
  });

  it("applique la limit", async () => {
    for (let i = 0; i < 15; i += 1) {
      await store.save({ mode: "solo", playerId: null, pseudo: `P#${i}`, score: i });
    }
    const top3 = await store.list({ mode: "solo", limit: 3 });
    expect(top3).toHaveLength(3);
    expect(top3[0].score).toBe(14);
  });

  it("par défaut limite à 10 entrées", async () => {
    for (let i = 0; i < 15; i += 1) {
      await store.save({ mode: "solo", playerId: null, pseudo: `P#${i}`, score: i });
    }
    const list = await store.list({ mode: "solo" });
    expect(list).toHaveLength(10);
  });

  it("départage les scores égaux par ordre d'insertion (FIFO)", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "FIRST#1", score: 100 });
    await store.save({ mode: "solo", playerId: null, pseudo: "SECOND#2", score: 100 });
    const list = await store.list({ mode: "solo" });
    expect(list[0].pseudo).toBe("FIRST#1");
  });
});

describe("LocalStorageLeaderboardStore — save & clear", () => {
  it("persiste entre instances (lit depuis Storage)", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "ABC#HETIC", score: 42 });
    const fresh = new LocalStorageLeaderboardStore(storage, "test:lb");
    const list = await fresh.list({ mode: "solo" });
    expect(list).toHaveLength(1);
    expect(list[0].score).toBe(42);
  });

  it("clear() supprime toutes les entrées", async () => {
    await store.save({ mode: "solo", playerId: null, pseudo: "A#1", score: 1 });
    await store.save({ mode: "1v1", playerId: null, pseudo: "B#2", score: 2 });
    await store.clear();
    expect(await store.list({ mode: "solo" })).toEqual([]);
    expect(await store.list({ mode: "1v1" })).toEqual([]);
  });

  it("retourne [] si la valeur stockée est corrompue (JSON invalide)", async () => {
    storage.setItem("test:lb", "{not json");
    const list = await store.list({ mode: "solo" });
    expect(list).toEqual([]);
  });

  it("retourne [] si la valeur stockée n'est pas un tableau", async () => {
    storage.setItem("test:lb", JSON.stringify({ foo: "bar" }));
    const list = await store.list({ mode: "solo" });
    expect(list).toEqual([]);
  });
});
