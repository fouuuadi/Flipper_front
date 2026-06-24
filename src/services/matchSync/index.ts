export { MatchSyncAdapter } from "./MatchSyncAdapter";
export { bindMatchSyncToGameStore } from "./bindToGameStore";
export { onPauseChange } from "./onPauseChange";
export type {
  BorneNav,
  ClientCommand,
  CountdownTickEvent,
  CountdownValue,
  IntentCommand,
  ControlNavEvent,
  MatchStateEvent,
  MatchStatus,
  NavAction,
  NavButton,
  NavStateEvent,
  ScoreUpdateEvent,
  BallLostEvent,
  GameOverEvent,
  GameEventCommand,
  SessionSnapshotEvent,
  WsServerEvent,
} from "./protocol";
export { isServerEvent } from "./protocol";

import { MatchSyncAdapter } from "./MatchSyncAdapter";

/**
 * Instance singleton du bus borne — partagée par tous les écrans (chaque app
 * est un process séparé, mais chacune n'ouvre qu'une connexion via ce
 * singleton). Connectée au boot via `connectBorne()`.
 */
export const matchSync = new MatchSyncAdapter();
