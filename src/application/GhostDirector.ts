import type { GameModel } from "../domain/models.js";
import type { Clock, GameEventPublisher, Logger, RandomSource } from "../domain/ports.js";
import type { GhostEventType } from "../domain/types.js";
import { moveTowards } from "../domain/geometry.js";
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
  private roamingTarget: { x: number; y: number; z: number } | null = null;

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

  public tick(dtSec: number): void {
    if (this.state.matchPhase !== "active") {
      return;
    }

    this.tickRoaming(dtSec);

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

  private tickRoaming(dtSec: number): void {
    if (!this.state.map || this.state.ghost.state === "hunt") {
      return;
    }

    if (!this.roamingTarget) {
      this.roamingTarget = this.pickRoamingTarget();
    }

    const speedPerSec = 0.7 + this.state.ghost.activity * 0.12;
    this.state.ghost.position = moveTowards(this.state.ghost.position, this.roamingTarget, speedPerSec * dtSec);

    const dx = this.state.ghost.position.x - this.roamingTarget.x;
    const dz = this.state.ghost.position.z - this.roamingTarget.z;
    const reached = dx * dx + dz * dz <= 0.3 * 0.3;
    if (reached) {
      this.roamingTarget = this.pickRoamingTarget();
    }
  }

  private pickRoamingTarget(): { x: number; y: number; z: number } {
    if (!this.state.map || this.state.map.rooms.length === 0) {
      return { ...this.state.ghost.position };
    }

    const useCurrentRoom = this.random.nextInt(100) < 75;
    const room = useCurrentRoom
      ? this.state.map.rooms.find((item) => item.id === this.state.ghost.roomId) ?? this.random.pick(this.state.map.rooms)
      : this.random.pick(this.state.map.rooms);
    this.state.ghost.roomId = room.id;

    const angle = (this.random.nextInt(3600) / 3600) * Math.PI * 2;
    const distance = (this.random.nextInt(1000) / 1000) * room.radius * 0.85;
    return {
      x: room.center.x + Math.cos(angle) * distance,
      y: room.center.y,
      z: room.center.z + Math.sin(angle) * distance,
    };
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
