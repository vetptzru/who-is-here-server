import type { GameModel } from "../domain/models.js";
import type { Clock, GameEventPublisher, Logger, RandomSource } from "../domain/ports.js";
import type { GhostEventType } from "../domain/types.js";
import { HuntSystem } from "./HuntSystem.js";
import { SanitySystem } from "./SanitySystem.js";

export type GhostDirectorConfig = {
  ghostEventIntervalMs: number;
};

const eventTypes: GhostEventType[] = [
  "sound",
  "flicker_light",
  "door_touch",
  "object_move",
  "emf_spike",
  "manifest",
];

export class GhostDirector {
  private nextEventAtMs = 0;

  public constructor(
    private readonly state: GameModel,
    private readonly sanitySystem: SanitySystem,
    private readonly huntSystem: HuntSystem,
    private readonly events: GameEventPublisher,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly logger: Logger,
    private readonly config: GhostDirectorConfig,
  ) {
    this.nextEventAtMs = this.clock.nowMs() + this.config.ghostEventIntervalMs;
  }

  public tick(): void {
    if (this.state.matchPhase !== "active") {
      return;
    }

    const avgSanity = this.sanitySystem.averageSanity();
    if (avgSanity < 70) {
      this.state.ghost.activity = Math.min(10, this.state.ghost.activity + 0.1);
      this.state.ghost.state = "light_activity";
    }

    if (this.clock.nowMs() >= this.nextEventAtMs) {
      this.triggerGhostEvent(avgSanity);
      this.nextEventAtMs = this.clock.nowMs() + this.config.ghostEventIntervalMs;
    }

    if (this.huntSystem.canStart(avgSanity)) {
      this.huntSystem.start();
    }
  }

  private triggerGhostEvent(avgSanity: number): void {
    if (!this.state.map) {
      return;
    }

    const eventType = this.random.pick(eventTypes);
    const room = this.state.map.rooms.find((item) => item.id === this.state.ghost.roomId) ?? this.random.pick(this.state.map.rooms);
    const intensity = Math.min(10, Math.max(1, Math.round(this.state.ghost.activity + (100 - avgSanity) / 20)));

    if (eventType === "manifest") {
      this.state.ghost.state = "manifest";
    } else if (eventType === "door_touch") {
      this.state.ghost.state = "interaction";
    }

    this.events.ghostEvent({
      eventId: `${this.clock.nowMs()}-${eventType}`,
      eventType,
      roomId: room.id,
      intensity,
      position: room.center,
    });
    this.logger.info("Ghost event", { eventType, roomId: room.id, intensity });
  }
}
