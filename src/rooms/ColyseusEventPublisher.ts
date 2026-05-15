import type { Room } from "colyseus";
import type { GameEventPublisher } from "../domain/ports.js";
import type {
  ServerEvidenceFoundMessage,
  ServerGhostEventMessage,
  ServerHuntEndedMessage,
  ServerHuntStartedMessage,
  ServerMissionFinishedMessage,
  ServerPlayerDeadMessage,
} from "../messages/serverMessages.js";

export class ColyseusEventPublisher implements GameEventPublisher {
  public constructor(private readonly room: Room) {}

  public ghostEvent(event: ServerGhostEventMessage): void {
    this.room.broadcast("ghost_event", event);
  }

  public huntStarted(event: ServerHuntStartedMessage): void {
    this.room.broadcast("hunt_started", event);
  }

  public huntEnded(event: ServerHuntEndedMessage): void {
    this.room.broadcast("hunt_ended", event);
  }

  public playerDead(event: ServerPlayerDeadMessage): void {
    this.room.broadcast("player_dead", event);
  }

  public evidenceFound(event: ServerEvidenceFoundMessage): void {
    this.room.broadcast("evidence_found", event);
  }

  public missionFinished(event: ServerMissionFinishedMessage): void {
    this.room.broadcast("mission_finished", event);
  }
}
