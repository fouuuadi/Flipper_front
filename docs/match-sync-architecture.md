# Architecture de synchronisation des écrans

> Comment les 3 apps Docker (playfield, backglass, DMD) restent cohérentes pendant une partie, sans dupliquer la logique métier.

---

## Le problème en 1 phrase

Les 3 apps front tournent dans des process JavaScript isolés (ports `:8081`, `:8082`, `:8083`). Elles ne partagent **aucune mémoire**. Pour qu'un événement comme "pause" s'affiche **simultanément** sur les 3 écrans, il faut un canal de synchronisation.

---

## La règle d'or

**2 phases dans la vie d'une app**. Chacune suit une logique différente.

### Phase 1 — Hors partie · navigation **locale** au front

Quand **aucune partie n'est en cours** :

- Splash "PRESS A"
- Menu principal
- Identification (saisie pseudo)
- Leaderboard

Ces écrans sont **strictement locaux** à chaque app. Le menu du playfield n'a aucune raison d'être synchronisé avec le backglass. Le back n'a rien à savoir non plus.

➡ **Aucun WS, aucune sync.** Chaque app navigue de son côté via sa state machine locale (`@core/gameStore`).

### Phase 2 — Pendant la partie · **back source de vérité**, broadcast via WS

Dès que la session est créée (`POST /sessions`) et que le WS est ouvert :

- Le **back devient le chef d'orchestre**
- Les 3 apps **écoutent le même WS** (`ws/?session_id=...`)
- Toutes les transitions de partie (start, pause, resume, abandon, game over) passent par le back
- Le back **broadcast l'état nouveau** à tous les clients connectés à la session
- Chaque app décide ce qu'elle **affiche** pour chaque message

```
[playfield] --cmd:pause---> [back]
                           [back] applique la transition côté SessionStatus
                           [back] broadcast match:state paused
                                  ↓             ↓             ↓
                              [playfield] [backglass]   [dmd]
                              (overlay)   (illustration)(pixel art "PAUSED")
```

➡ **Le front ne décide jamais lui-même** "je suis en pause maintenant". Il envoie une **intention** (`cmd:pause`) au back, attend la confirmation broadcast, et alors seulement bascule. Garantie : les 3 apps changent en même temps.

---

## Frontière exacte entre les 2 phases

| État SM front | Phase | Pilotage |
|---|---|---|
| `splash` | 1 | Local à chaque app |
| `menu` | 1 | Local à chaque app |
| `identification` | 1 | Local à chaque app |
| `playing` | **2** | Back (broadcast `match:state: playing`) |
| `paused` | **2** | Back (broadcast `match:state: paused`) |
| `gameOver` | **2** | Back (broadcast `match:state: over`) |
| `leaderboard` | 1 | Local à chaque app |

La transition `identification → playing` est le **point de bascule** : c'est elle qui ouvre la WS, démarre le countdown, et passe la main au back.

---

## Messages WS — contrat

> Spec détaillée côté back : `Flipper_back/docs/MATCH_SYNC.md`.
> Vu d'ici : ce que le front consomme / émet.

### Server → Client (le front écoute)

```ts
// Statut courant de la partie
// Émis à chaque transition côté back
{
  type: 'match:state';
  status: 'waiting' | 'ready' | 'playing' | 'paused' | 'over';
  sessionId: string;
}

// Countdown pré-partie (3 → 2 → 1 → 0 = GO)
{ type: 'countdown:tick'; value: 3 | 2 | 1 | 0; }

// Events existants (inchangés, déjà dans FRONTEND_INTEGRATION.md §5)
{ type: 'score:update';  score; combo; bumperId?; bonusType?; }
{ type: 'ball:lost';     livesRemaining; }
{ type: 'game:over';     finalScore; }
```

### Client → Server (le front pousse une intention)

```ts
{ type: 'cmd:pause';   }
{ type: 'cmd:resume';  }
{ type: 'cmd:abandon'; }
```

Le back valide la commande contre l'état courant de la session, applique la transition, broadcast `match:state`. Si la commande est invalide (ex: `cmd:pause` alors qu'on est déjà en `paused`), elle est ignorée silencieusement côté back.

---

## Architecture front correspondante

```
┌──────────────────────────────────────────────────────────┐
│              UN écran (Pause, GameOver, etc.)            │
│  bouton "Reprendre"                                       │
└────────────────────────┬─────────────────────────────────┘
                         │ envoie une intention
                         ▼
┌──────────────────────────────────────────────────────────┐
│              MatchSyncAdapter (nouveau)                  │
│   - reçoit les events WS et applique au gameStore local  │
│   - envoie les cmd:* au back                             │
└────────────────────────┬─────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       ┌─────────────┐      ┌───────────────┐
       │  gameStore  │      │   WebSocket   │
       │  (lecture   │      │   /ws/?sid=…  │
       │  seule)     │      │               │
       └──────┬──────┘      └───────────────┘
              │
              ▼
        ScreenRouter (monte/démonte les écrans selon snapshot.value)
```

**Pendant la phase 1** :
- L'écran appelle directement `gameStore.send({ type: 'START_GAME' })`
- Le `MatchSyncAdapter` n'est pas encore connecté

**Pendant la phase 2** :
- L'écran appelle `matchSync.dispatch({ type: 'cmd:pause' })`
- Le `gameStore` ne reçoit l'event `PAUSE` que **quand le back confirme**
- L'overlay pause s'affiche au même moment sur les 3 apps

---

## Conséquences pour les écrans déjà mergés

| Écran | Phase | Refactor nécessaire ? |
|---|---|---|
| Splash | 1 | Non — utilise `gameStore` localement |
| Menu (#76) | 1 | Non |
| Identification (#75) | 1 → 2 | **Oui** — déclenche la création WS, attache `MatchSyncAdapter` |
| Pause (#77) | **2** | **Oui** — boutons doivent envoyer `cmd:resume` / `cmd:abandon` au lieu de `gameStore.send` |
| GameOver (#78) | **2** | **Oui** — l'entrée dans `gameOver` est désormais déclenchée par `match:state: over` reçu, pas par l'event local. Le `POST /scores` reste un appel HTTP séparé. |
| Leaderboard (#79) | 1 | Non |

Ces refactors sont l'objet de l'issue **front#E**.

---

## Hors scope de cette doc

- Le routage à l'intérieur des apps (= rôle du `ScreenRouter`, déjà planifié)
- Le contrat HTTP (cf. `Flipper_back/docs/FRONTEND_INTEGRATION.md`)
- Les events MQTT (transparents pour le front, cf. §6 de la doc back)
- Les écrans backglass et DMD (à concevoir dans #82 et #83 — ils consomment ce contrat WS étendu)

---

## Issues associées

### Côté back (`Flipper_back`)
- **#A** — Étend `SessionStatus` avec `paused`, broadcast `match:state` à chaque transition, accepte `cmd:*` côté WS
- **#B** — Countdown pré-partie (`countdown:tick`) avant `match:state: playing` effectif
- **#C** — Émission de `match:state: ready` et `match:state: playing` (aujourd'hui seul `over` est broadcasté)

### Côté front (`Flipper_front`)
- **#D** — `MatchSyncAdapter` : pont WS ↔ `gameStore` (interface + impl WebSocket)
- **#E** — Refactor `pause` + `gameOver` pour passer par les `cmd:*` au lieu de muter directement
- **#F** — Routeurs backglass + DMD branchés sur le même contrat WS
