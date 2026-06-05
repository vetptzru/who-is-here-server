import type { GameMap, GhostTypeDefinition, NavGrid } from "./models.js";
import type { GhostEventType, HuntEndReason, Vector3 } from "./types.js";

export interface Clock {
  nowMs(): number;
}

export interface RandomSource {
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  pickMany<T>(items: readonly T[], count: number): T[];
}

export interface MapRepository {
  getById(mapId: string): Promise<GameMap>;
}

export interface GhostTypeRepository {
  getAll(): Promise<GhostTypeDefinition[]>;
}

export interface NavGridRepository {
  getByMapId(mapId: string): Promise<NavGrid | null>;
}

export interface GameEventPublisher {
  ghostEvent(event: {
    eventId: string;
    eventType: GhostEventType;
    roomId: string;
    intensity: number;
    position?: Vector3;
  }): void;
  huntStarted(event: { targetPlayerId: string; durationSec: number }): void;
  huntEnded(event: { reason: HuntEndReason }): void;
  playerDead(event: { playerId: string; reason: "ghost_contact" }): void;
  evidenceFound(event: { evidenceType: string; roomId: string }): void;
  missionFinished(event: {
    success: boolean;
    correctEvidence: boolean;
    survivedPlayers: string[];
    reward: number;
  }): void;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
