import type { EvidenceType, GhostEventType, HuntEndReason, Vector3 } from "../domain/types.js";

export type ServerGhostEventMessage = {
  eventId: string;
  eventType: GhostEventType;
  roomId: string;
  intensity: number;
  position?: Vector3;
};

export type ServerHuntStartedMessage = {
  targetPlayerId: string;
  durationSec: number;
};

export type ServerHuntEndedMessage = {
  reason: HuntEndReason;
};

export type ServerPlayerDeadMessage = {
  playerId: string;
  reason: "ghost_contact";
};

export type ServerEvidenceFoundMessage = {
  evidenceType: EvidenceType | string;
  roomId: string;
};

export type ServerMissionFinishedMessage = {
  success: boolean;
  correctEvidence: boolean;
  survivedPlayers: string[];
  reward: number;
};
