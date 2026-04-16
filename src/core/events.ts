import { EventBus } from "./EventBus";

export type FlipperSide = "left" | "right";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export interface NetworkEnvelope<T extends JsonValue = JsonValue> {
  channel: string;
  payload: T;
  sentAt: number;
}

export interface DomainEventMap {
  "domain.flipper.setActive": {
    side: FlipperSide;
    active: boolean;
    source: "input" | "network";
  };
}

export interface SystemEventMap {
  "system.loop.started": { fixedDelta: number };
  "system.loop.fixedTick": {
    dt: number;
    tick: number;
    elapsedTime: number;
  };
  "system.loop.renderTick": {
    alpha: number;
    frameDelta: number;
    elapsedTime: number;
  };
  "system.loop.stopped": { elapsedTime: number };
}

export interface NetworkEventMap {
  "network.connection.opened": { url: string };
  "network.connection.closed": {
    url: string;
    code: number;
    reason: string;
    wasClean: boolean;
  };
  "network.connection.error": {
    url: string;
    message: string;
  };
  "network.message.inbound": NetworkEnvelope;
  "network.message.outbound": NetworkEnvelope;
}

export interface AppEventMap
  extends Record<string, unknown>,
    DomainEventMap,
    SystemEventMap,
    NetworkEventMap {}

export type AppEventBus = EventBus<AppEventMap>;

export const appEventBus = new EventBus<AppEventMap>();
