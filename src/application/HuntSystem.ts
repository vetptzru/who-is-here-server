import type { GameModel, Player } from "../domain/models.js";
import { isWithinDistance, moveTowards } from "../domain/geometry.js";
import type { Clock, GameEventPublisher, Logger, RandomSource } from "../domain/ports.js";
import type { HuntEndReason } from "../domain/types.js";
import { MatchController } from "./MatchController.js";

export type HuntSystemConfig = {
  durationSec: number;
  cooldownSec: number;
};

export class HuntSystem {
  private readonly ghostSpeedPerSec = 3;
  private readonly contactDistance = 1.2;

  public constructor(
    private readonly state: GameModel,
    private readonly matchController: MatchController,
    private readonly events: GameEventPublisher,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly logger: Logger,
    private readonly config: HuntSystemConfig,
  ) {}

  public canStart(avgSanity: number): boolean {
    return (
      this.state.matchPhase === "active" &&
      this.state.ghost.state !== "hunt" &&
      avgSanity < this.state.ghost.huntSanityThreshold &&
      this.clock.nowMs() >= this.state.huntCooldownUntilMs &&
      this.livingPlayersInHouse().length > 0
    );
  }

  public start(): boolean {
    const targets = this.livingPlayersInHouse();
    if (targets.length === 0) {
      return false;
    }

    const target = this.random.pick(targets);
    const now = this.clock.nowMs();
    this.state.ghost.state = "hunt";
    this.state.ghost.targetPlayerId = target.id;
    this.state.activeHuntUntilMs = now + this.config.durationSec * 1000;
    this.lockHuntDoors();
    this.disableSomeLights();
    this.matchController.enterHunt();
    this.events.huntStarted({ targetPlayerId: target.id, durationSec: this.config.durationSec });
    this.logger.info("Hunt started", { targetPlayerId: target.id });
    return true;
  }

  public tick(dtSec: number): void {
    if (this.state.ghost.state !== "hunt") {
      return;
    }

    if (this.clock.nowMs() >= this.state.activeHuntUntilMs) {
      this.end("timeout");
      return;
    }

    if (this.livingPlayersInHouse().length === 0) {
      this.end("all_players_dead");
      return;
    }

    const target = this.currentTarget() ?? this.retarget();
    if (!target) {
      this.end("all_players_dead");
      return;
    }

    this.state.ghost.position = moveTowards(
      this.state.ghost.position,
      target.position,
      this.ghostSpeedPerSec * dtSec,
    );

    if (isWithinDistance(this.state.ghost.position, target.position, this.contactDistance)) {
      target.isAlive = false;
      this.events.playerDead({ playerId: target.id, reason: "ghost_contact" });
      this.logger.info("Player killed by ghost", { playerId: target.id });
      this.retarget();
    }
  }

  public end(reason: HuntEndReason): void {
    if (this.state.ghost.state !== "hunt") {
      return;
    }

    this.state.ghost.state = "cooldown";
    this.state.ghost.targetPlayerId = "";
    this.state.activeHuntUntilMs = 0;
    this.state.huntCooldownUntilMs = this.clock.nowMs() + this.config.cooldownSec * 1000;
    this.unlockHuntDoors();
    this.matchController.leaveHunt();
    this.events.huntEnded({ reason });
    this.logger.info("Hunt ended", { reason });
  }

  private livingPlayersInHouse(): Player[] {
    return Array.from(this.state.players.values()).filter((player) => player.isAlive && player.isInHouse);
  }

  private currentTarget(): Player | undefined {
    const target = this.state.players.get(this.state.ghost.targetPlayerId);
    return target && target.isAlive && target.isInHouse ? target : undefined;
  }

  private retarget(): Player | undefined {
    const candidates = this.livingPlayersInHouse();
    const target = candidates.length > 0 ? this.random.pick(candidates) : undefined;
    this.state.ghost.targetPlayerId = target?.id ?? "";
    return target;
  }

  private lockHuntDoors(): void {
    for (const door of this.state.doors.values()) {
      if (door.isLockedDuringHunt) {
        door.isLocked = true;
        door.isOpen = false;
      }
    }
  }

  private unlockHuntDoors(): void {
    for (const door of this.state.doors.values()) {
      if (door.isLockedDuringHunt) {
        door.isLocked = false;
      }
    }
  }

  private disableSomeLights(): void {
    for (const [index, light] of Array.from(this.state.lights.values()).entries()) {
      if (index % 2 === 0) {
        light.isOn = false;
      }
    }
  }
}
