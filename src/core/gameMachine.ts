/**
 * State machine du jeu — définition pure (transitions, contexte initial).
 * Aucun état mutable ici : chaque transition retourne une nouvelle snapshot.
 */

import type {
  GameContext,
  GameEvent,
  GameStateValue,
  MachineSnapshot,
  Player,
  PlayerTag,
} from "./gameMachine.types";

const DEFAULT_BALLS_PER_PLAYER = 3;

export const initialContext: GameContext = {
  mode: null,
  players: [],
  currentBall: 1,
  startedAt: null,
  sessionId: null,
};

export const initialState: GameStateValue = "splash";

const freshPlayer = (tag: PlayerTag): Player => ({
  tag,
  score: 0,
  ballsRemaining: DEFAULT_BALLS_PER_PLAYER,
});

type TransitionHandler = (context: GameContext, event: GameEvent) => Partial<MachineSnapshot>;

type TransitionTable = {
  [State in GameStateValue]?: {
    [EventType in GameEvent["type"]]?: TransitionHandler;
  };
};

const transitions: TransitionTable = {
  splash: {
    PRESS_A: () => ({ value: "menu" }),
  },
  menu: {
    START_GAME: () => ({ value: "identification" }),
    OPEN_LEADERBOARD: () => ({ value: "leaderboard" }),
  },
  identification: {
    PLAYERS_VALIDATED: (_ctx, event) => {
      // Type narrowing : ce handler n'est appelé que pour PLAYERS_VALIDATED
      if (event.type !== "PLAYERS_VALIDATED") return {};
      return {
        value: "playing",
        context: {
          mode: event.mode,
          players: event.players.map(freshPlayer),
          currentBall: 1,
          startedAt: Date.now(),
          sessionId: event.sessionId,
        },
      };
    },
    BACK_TO_MENU: () => ({
      value: "menu",
      context: { ...initialContext },
    }),
  },
  playing: {
    PAUSE: () => ({ value: "paused" }),
    GAME_OVER: () => ({ value: "gameOver" }),
  },
  paused: {
    RESUME: () => ({ value: "playing" }),
    ABANDON: () => ({
      value: "menu",
      context: { ...initialContext },
    }),
    // Cas où le back broadcast match:state: over en réponse à cmd:abandon
    // (cf. MATCH_SYNC) : on atterrit sur gameOver pour persister le score
    // courant via POST /scores, plutôt que de rentrer au menu silencieusement.
    GAME_OVER: () => ({ value: "gameOver" }),
  },
  gameOver: {
    REPLAY: (ctx) => ({
      // Rejoue avec les mêmes joueurs, scores et balles remis à zéro.
      // La sessionId est reset : l'écran identification recréera une nouvelle
      // session via POST /sessions.
      value: "identification",
      context: {
        mode: ctx.mode,
        players: ctx.players.map((p) => freshPlayer(p.tag)),
        currentBall: 1,
        startedAt: null,
        sessionId: null,
      },
    }),
    BACK_TO_MENU: () => ({
      value: "menu",
      context: { ...initialContext },
    }),
    OPEN_LEADERBOARD: () => ({ value: "leaderboard" }),
  },
  leaderboard: {
    BACK_TO_MENU: () => ({
      value: "menu",
      context: { ...initialContext },
    }),
  },
};

/**
 * Calcule la prochaine snapshot à partir d'un événement.
 * @returns `null` si la transition n'est pas autorisée pour l'état courant.
 */
export function transition(snapshot: MachineSnapshot, event: GameEvent): MachineSnapshot | null {
  const handler = transitions[snapshot.value]?.[event.type];
  if (!handler) return null;

  const patch = handler(snapshot.context, event);
  return {
    value: patch.value ?? snapshot.value,
    context: patch.context ?? snapshot.context,
  };
}
