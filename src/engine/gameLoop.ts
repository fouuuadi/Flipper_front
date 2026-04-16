import type { AppEventBus } from "@core/events";

type FixedUpdateHandler = (fixedDelta: number, tick: number, elapsedTime: number) => void;
type RenderHandler = (alpha: number, frameDelta: number, elapsedTime: number) => void;

export type SystemPhase = "pre" | "simulation" | "post";

export interface SystemRegistrationOptions {
  phase?: SystemPhase;
  priority?: number;
}

interface RegisteredSystem<Handler> {
  id: number;
  phase: SystemPhase;
  priority: number;
  handler: Handler;
}

export interface GameLoopOptions {
  fixedTimeStep?: number;
  maxSubSteps?: number;
  maxFrameDelta?: number;
  maxAccumulatedTime?: number;
  eventBus?: AppEventBus;
}

export class GameLoop {
  private static readonly phaseOrder: Record<SystemPhase, number> = {
    pre: 0,
    simulation: 1,
    post: 2,
  };

  private readonly fixedTimeStep: number;
  private readonly maxSubSteps: number;
  private readonly maxFrameDelta: number;
  private readonly maxAccumulatedTime: number;
  private readonly eventBus?: AppEventBus;

  private readonly fixedSystems: RegisteredSystem<FixedUpdateHandler>[] = [];
  private readonly renderSystems: RegisteredSystem<RenderHandler>[] = [];

  private animationFrameId: number | null = null;
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private elapsedTime = 0;
  private tickCount = 0;
  private nextSystemId = 0;

  constructor(options: GameLoopOptions = {}) {
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.maxSubSteps = options.maxSubSteps ?? 8;
    this.maxFrameDelta = options.maxFrameDelta ?? 0.1;
    this.maxAccumulatedTime =
      options.maxAccumulatedTime ?? this.fixedTimeStep * this.maxSubSteps * 2;
    this.eventBus = options.eventBus;
  }

  start(): void {
    if (this.running) return;

    this.running = true;
    this.accumulator = 0;
    this.elapsedTime = 0;
    this.tickCount = 0;
    this.lastTime = performance.now() / 1000;

    this.eventBus?.emit("system.loop.started", {
      fixedDelta: this.fixedTimeStep,
    });

    this.animationFrameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.eventBus?.emit("system.loop.stopped", {
      elapsedTime: this.elapsedTime,
    });
  }

  registerFixedSystem(
    handler: FixedUpdateHandler,
    options: SystemRegistrationOptions = {},
  ): () => void {
    const system: RegisteredSystem<FixedUpdateHandler> = {
      id: this.nextSystemId++,
      phase: options.phase ?? "simulation",
      priority: options.priority ?? 0,
      handler,
    };

    this.fixedSystems.push(system);
    this.fixedSystems.sort(this.compareSystems);

    return () => {
      const index = this.fixedSystems.findIndex((entry) => entry.id === system.id);
      if (index >= 0) {
        this.fixedSystems.splice(index, 1);
      }
    };
  }

  registerRenderSystem(
    handler: RenderHandler,
    options: SystemRegistrationOptions = {},
  ): () => void {
    const system: RegisteredSystem<RenderHandler> = {
      id: this.nextSystemId++,
      phase: options.phase ?? "post",
      priority: options.priority ?? 0,
      handler,
    };

    this.renderSystems.push(system);
    this.renderSystems.sort(this.compareSystems);

    return () => {
      const index = this.renderSystems.findIndex((entry) => entry.id === system.id);
      if (index >= 0) {
        this.renderSystems.splice(index, 1);
      }
    };
  }

  onFixedUpdate(
    handler: FixedUpdateHandler,
    options: SystemRegistrationOptions = {},
  ): () => void {
    return this.registerFixedSystem(handler, options);
  }

  onRender(handler: RenderHandler, options: SystemRegistrationOptions = {}): () => void {
    return this.registerRenderSystem(handler, options);
  }

  private frame = (timestampMs: number): void => {
    if (!this.running) return;

    const now = timestampMs / 1000;
    const unclampedDelta = now - this.lastTime;
    const frameDelta = Math.min(Math.max(unclampedDelta, 0), this.maxFrameDelta);
    this.lastTime = now;

    const nextAccumulator = this.accumulator + frameDelta;
    this.accumulator = Math.min(nextAccumulator, this.maxAccumulatedTime);

    let subSteps = 0;
    while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
      this.tickCount += 1;
      this.elapsedTime += this.fixedTimeStep;

      for (const system of this.fixedSystems) {
        system.handler(this.fixedTimeStep, this.tickCount, this.elapsedTime);
      }

      this.eventBus?.emit("system.loop.fixedTick", {
        dt: this.fixedTimeStep,
        tick: this.tickCount,
        elapsedTime: this.elapsedTime,
      });

      this.accumulator -= this.fixedTimeStep;
      subSteps += 1;
    }

    const alpha = this.accumulator / this.fixedTimeStep;

    for (const system of this.renderSystems) {
      system.handler(alpha, frameDelta, this.elapsedTime);
    }

    this.eventBus?.emit("system.loop.renderTick", {
      alpha,
      frameDelta,
      elapsedTime: this.elapsedTime,
    });

    this.animationFrameId = requestAnimationFrame(this.frame);
  };

  private compareSystems<Handler>(
    left: RegisteredSystem<Handler>,
    right: RegisteredSystem<Handler>,
  ): number {
    const phaseDiff = GameLoop.phaseOrder[left.phase] - GameLoop.phaseOrder[right.phase];
    if (phaseDiff !== 0) return phaseDiff;

    return left.priority - right.priority;
  }
}
