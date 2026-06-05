import type { GameModel } from "../domain/models.js";
import type { Clock, GameEventPublisher, Logger, RandomSource } from "../domain/ports.js";
import type { GhostEventType, Vector3 } from "../domain/types.js";
import { isWithinDistance, moveTowards } from "../domain/geometry.js";
import { NavigationService } from "./NavigationService.js";
import { HuntSystem } from "./HuntSystem.js";
import { SanitySystem } from "./SanitySystem.js";

export type GhostDirectorConfig = {
  ghostEventIntervalMs: number;
  repathIntervalMs?: number;
  chaseRange?: number;
  searchDurationMs?: number;
};

type AiState = "roam" | "investigate" | "chase" | "search";

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
  private nextRepathAtMs = 0;
  private aiState: AiState = "roam";
  private moveTarget: Vector3 | null = null;
  private movePath: Vector3[] = [];
  private pathIndex = 0;
  private chaseTargetPlayerId = "";
  private lastKnownTargetPos: Vector3 | null = null;
  private searchUntilMs = 0;
  private readonly lastDoorOpenState = new Map<string, boolean>();
  private readonly navigation: NavigationService;
  private repathCount = 0;
  private noPathCount = 0;
  private cumulativePathMs = 0;
  private cumulativePathLen = 0;
  private lastMetricsLogAtMs = 0;

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
    this.nextRepathAtMs = this.clock.nowMs();
    this.navigation = new NavigationService(this.state.navGrid ?? null);
  }

  public tick(dtSec: number): void {
    if (this.state.matchPhase !== "active") {
      return;
    }

    const doorStateChanged = this.syncDoorBlockers();
    if (doorStateChanged) {
      this.rebuildPath();
    }

    this.tickBrain();
    this.tickMovement(dtSec);

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

  private tickBrain(): void {
    if (!this.state.map || this.state.ghost.state === "hunt") {
      return;
    }

    const chaseCandidate = this.pickChaseCandidate();
    if (chaseCandidate) {
      this.chaseTargetPlayerId = chaseCandidate.id;
      this.state.ghost.targetPlayerId = chaseCandidate.id;
      this.lastKnownTargetPos = { ...chaseCandidate.position };
      this.aiState = "chase";
      this.moveTarget = { ...chaseCandidate.position };
      return;
    }

    if (this.aiState === "chase" && this.lastKnownTargetPos) {
      this.aiState = "search";
      this.searchUntilMs = this.clock.nowMs() + (this.config.searchDurationMs ?? 4000);
      this.moveTarget = { ...this.lastKnownTargetPos };
      return;
    }

    if (this.aiState === "search" && this.clock.nowMs() < this.searchUntilMs && this.lastKnownTargetPos) {
      this.moveTarget = { ...this.lastKnownTargetPos };
      return;
    }

    if (this.aiState === "investigate" && this.moveTarget) {
      return;
    }

    this.aiState = "roam";
    this.state.ghost.targetPlayerId = "";
    if (!this.moveTarget) {
      this.moveTarget = this.pickRoamingTarget();
    }
  }

  private syncDoorBlockers(): boolean {
    if (!this.state.navGrid) {
      return false;
    }

    let changed = false;
    for (const [doorId, door] of this.state.doors.entries()) {
      const isOpen = door.isOpen;
      const prev = this.lastDoorOpenState.get(doorId);
      if (prev === undefined || prev !== isOpen) {
        this.navigation.setDoorBlockedCells(doorId, !isOpen);
        this.lastDoorOpenState.set(doorId, isOpen);
        changed = true;
      }
    }
    return changed;
  }

  private tickMovement(dtSec: number): void {
    if (!this.state.map || this.state.ghost.state === "hunt") {
      return;
    }

    if (!this.moveTarget) {
      this.moveTarget = this.pickRoamingTarget();
      this.rebuildPath();
    }

    this.applyGhostModeByAiState();

    if (this.clock.nowMs() >= this.nextRepathAtMs) {
      this.rebuildPath();
      const repathInterval = this.config.repathIntervalMs ?? 350;
      this.nextRepathAtMs = this.clock.nowMs() + repathInterval;
    }

    const baseSpeedPerSec = 0.7 + this.state.ghost.activity * 0.12;
    const speedPerSec = this.aiState === "chase" ? baseSpeedPerSec * 1.35 : baseSpeedPerSec;
    const waypoint = this.getCurrentWaypoint() ?? this.moveTarget;
    this.state.ghost.position = moveTowards(this.state.ghost.position, waypoint, speedPerSec * dtSec);

    if (this.getCurrentWaypoint()) {
      const reachedWaypoint = this.isReached(this.state.ghost.position, this.getCurrentWaypoint()!, 0.25);
      if (reachedWaypoint) {
        this.pathIndex += 1;
      }
    }

    const reachedTarget = this.isReached(this.state.ghost.position, this.moveTarget, 0.3);
    if (reachedTarget) {
      if (this.aiState === "roam") {
        this.moveTarget = this.pickRoamingTarget();
      } else if (this.aiState === "investigate") {
        this.aiState = "search";
        this.searchUntilMs = this.clock.nowMs() + (this.config.searchDurationMs ?? 4000);
      } else if (this.aiState === "search") {
        this.aiState = "roam";
        this.moveTarget = this.pickRoamingTarget();
      }
      this.rebuildPath();
    }
  }

  private rebuildPath(): void {
    if (!this.moveTarget) {
      this.movePath = [];
      this.pathIndex = 0;
      return;
    }

    const path = this.navigation.findPath(this.state.ghost.position, this.moveTarget, {
      maxIterations: 25_000,
      allowBlockedStart: true,
      allowBlockedGoal: true,
    });
    this.repathCount += 1;
    this.cumulativePathMs += path.stats?.durationMs ?? 0;

    if (this.clock.nowMs() - this.lastMetricsLogAtMs >= 5000) {
      this.lastMetricsLogAtMs = this.clock.nowMs();
      const avgMs = this.repathCount > 0 ? this.cumulativePathMs / this.repathCount : 0;
      const avgLen = this.repathCount > 0 ? this.cumulativePathLen / this.repathCount : 0;
      this.logger.info("Ghost path metrics", {
        repathCount: this.repathCount,
        noPathCount: this.noPathCount,
        avgPathMs: Number(avgMs.toFixed(3)),
        avgPathLen: Number(avgLen.toFixed(2)),
        state: this.aiState,
      });
    }

    if (!path.found || path.worldPath.length === 0) {
      this.noPathCount += 1;
      this.movePath = [];
      this.state.ghost.debugPath = [];
      this.pathIndex = 0;
      return;
    }

    this.movePath = path.worldPath;
    this.state.ghost.debugPath = path.worldPath.map((point) => ({ ...point }));
    this.cumulativePathLen += path.worldPath.length;
    if (this.movePath.length > 1 && this.isReached(this.state.ghost.position, this.movePath[0], 0.35)) {
      this.pathIndex = 1;
      return;
    }
    this.pathIndex = 0;
  }

  private getCurrentWaypoint(): { x: number; y: number; z: number } | null {
    if (this.pathIndex < 0 || this.pathIndex >= this.movePath.length) {
      return null;
    }
    return this.movePath[this.pathIndex] ?? null;
  }

  private isReached(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, threshold: number): boolean {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return dx * dx + dz * dz <= threshold * threshold;
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

  private pickChaseCandidate(): { id: string; position: Vector3 } | null {
    const chaseRange = this.config.chaseRange ?? 8;
    const alivePlayers = Array.from(this.state.players.values()).filter((player) => player.isAlive && player.isInHouse);
    if (alivePlayers.length === 0) {
      return null;
    }

    let best: { id: string; position: Vector3; distSq: number } | null = null;
    for (const player of alivePlayers) {
      if (!isWithinDistance(this.state.ghost.position, player.position, chaseRange)) {
        continue;
      }
      const dx = this.state.ghost.position.x - player.position.x;
      const dz = this.state.ghost.position.z - player.position.z;
      const distSq = dx * dx + dz * dz;
      if (!best || distSq < best.distSq) {
        best = { id: player.id, position: { ...player.position }, distSq };
      }
    }

    return best ? { id: best.id, position: best.position } : null;
  }

  private applyGhostModeByAiState(): void {
    switch (this.aiState) {
      case "roam":
        this.state.ghost.state = "idle";
        break;
      case "investigate":
        this.state.ghost.state = "interaction";
        break;
      case "chase":
        this.state.ghost.state = "manifest";
        break;
      case "search":
        this.state.ghost.state = "light_activity";
        break;
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

    if (eventType === "door_touch" || eventType === "object_move" || eventType === "sound") {
      this.aiState = "investigate";
      this.moveTarget = { ...room.center };
      this.searchUntilMs = this.clock.nowMs() + (this.config.searchDurationMs ?? 4000);
      this.rebuildPath();
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
