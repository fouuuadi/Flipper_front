export { MatchSyncAdapter } from "./MatchSyncAdapter";
export { bindMatchSyncToGameStore } from "./bindToGameStore";
export type {
  ClientCommand,
  CountdownTickEvent,
  CountdownValue,
  MatchStateEvent,
  MatchStatus,
  ScoreUpdateEvent,
  BallLostEvent,
  GameOverEvent,
  WsServerEvent,
} from "./protocol";
export { isServerEvent } from "./protocol";

import { MatchSyncAdapter } from "./MatchSyncAdapter";

/**
 * Instance singleton — partagée par l'app playfield.
 * Le backglass et le DMD instancient leur propre adapter dans leurs entries.
 */
export const matchSync = new MatchSyncAdapter();
