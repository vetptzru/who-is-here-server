import type { GameModel } from "../domain/models.js";
import type { GameEventPublisher, Logger } from "../domain/ports.js";
import type { EvidenceType } from "../domain/types.js";

export class MatchController {
  public constructor(
    private readonly state: GameModel,
    private readonly events: GameEventPublisher,
    private readonly logger: Logger,
  ) {}

  public canStart(): boolean {
    const players = Array.from(this.state.players.values());
    return players.length > 0 && players.every((player) => player.isReady);
  }

  public startPreparing(): void {
    if (this.state.matchPhase !== "waiting") {
      return;
    }

    this.state.matchPhase = "preparing";
    this.logger.info("Match preparing", { mapId: this.state.mapId });
  }

  public startActive(): void {
    if (this.state.matchPhase !== "preparing" && this.state.matchPhase !== "waiting") {
      return;
    }

    this.state.matchPhase = "active";
    this.logger.info("Match active", { mapId: this.state.mapId });
  }

  public enterHunt(): void {
    if (this.state.matchPhase === "active") {
      this.state.matchPhase = "hunt";
    }
  }

  public leaveHunt(): void {
    if (this.state.matchPhase === "hunt") {
      this.state.matchPhase = "active";
    }
  }

  public finishMission(submittedEvidence: EvidenceType[]): void {
    if (this.state.matchPhase === "finished") {
      return;
    }

    this.state.matchPhase = "finished";
    const survivedPlayers = Array.from(this.state.players.values())
      .filter((player) => player.isAlive)
      .map((player) => player.id);
    const correctEvidence = this.hasCorrectEvidence(submittedEvidence);
    const success = correctEvidence && survivedPlayers.length > 0;

    this.events.missionFinished({
      success,
      correctEvidence,
      survivedPlayers,
      reward: success ? 100 : 20,
    });
    this.logger.info("Mission finished", { success, correctEvidence });
  }

  public tick(dtSec: number): void {
    if (this.state.matchPhase !== "waiting" && this.state.matchPhase !== "finished") {
      this.state.matchTimeSec += dtSec;
    }
  }

  private hasCorrectEvidence(submittedEvidence: EvidenceType[]): boolean {
    const required = new Set(this.state.ghost.evidence);
    return submittedEvidence.length === required.size && submittedEvidence.every((item) => required.has(item));
  }
}
