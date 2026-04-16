type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners: {
    [K in keyof EventMap]?: Set<Listener<EventMap[K]>>;
  } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const listenerSet = this.listeners[event];
    if (!listenerSet) {
      this.listeners[event] = new Set([listener]);
      return;
    }

    listenerSet.add(listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners[event]?.forEach((listener) => listener(payload));
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const wrapper: Listener<EventMap[K]> = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };

    this.on(event, wrapper);
  }

  clear(event?: keyof EventMap): void {
    if (event) {
      delete this.listeners[event];
      return;
    }

    this.listeners = {};
  }
}
