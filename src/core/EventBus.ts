type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  private static instance: EventBus<any>;

  static getInstance<EventMap extends Record<string, unknown>>(): EventBus<EventMap> {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus<EventMap>();
    }
    return EventBus.instance as EventBus<EventMap>;
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<never>);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((listener) => (listener as Listener<EventMap[K]>)(payload));
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const wrapper = ((payload: EventMap[K]): void => {
      this.off(event, wrapper);
      listener(payload);
    }) as Listener<EventMap[K]>;
    this.on(event, wrapper);
  }

  clear(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
