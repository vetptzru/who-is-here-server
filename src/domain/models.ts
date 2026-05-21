import type {
  EvidenceType,
  GhostMode,
  ItemId,
  MatchPhase,
  ObjectKind,
  Vector3,
} from "./types.js";

export type Player = {
  id: string;
  name: string;
  position: Vector3;
  rotY: number;
  /** Градусы, наклон «вверх/вниз» взгляда (как pitch камеры). */
  lookPitch: number;
  sanity: number;
  isAlive: boolean;
  isReady: boolean;
  isInHouse: boolean;
  inventory: ItemId[];
  flashlightOn: boolean;
};

export type Ghost = {
  ghostType: string;
  state: GhostMode;
  roomId: string;
  aggression: number;
  activity: number;
  huntSanityThreshold: number;
  position: Vector3;
  targetPlayerId: string;
  evidence: EvidenceType[];
};

export type Door = {
  id: string;
  roomA: string;
  roomB: string;
  isOpen: boolean;
  isLocked: boolean;
  isLockedDuringHunt: boolean;
};

export type Light = {
  id: string;
  roomId: string;
  switchId: string;
  isOn: boolean;
};

export type MapRoom = {
  id: string;
  name: string;
  center: Vector3;
  radius: number;
};

export type SanityZone = {
  id: string;
  center: Vector3;
  radius: number;
  drainPerSec: number;
};

export type HidingSpot = {
  id: string;
  roomId: string;
  position: Vector3;
};

export type EvidenceSpot = {
  id: string;
  roomId: string;
  evidenceType: EvidenceType;
  position: Vector3;
};

export type MapObject = {
  id: string;
  kind: ObjectKind;
  roomId?: string;
  position?: Vector3;
};

export type GameMap = {
  id: string;
  name: string;
  spawnPoints: Array<{ id: string; position: Vector3 }>;
  rooms: MapRoom[];
  sanityZones: SanityZone[];
  doors: Door[];
  lights: Light[];
  hidingSpots: HidingSpot[];
  evidenceSpots: EvidenceSpot[];
  exitZone: { id: string; position: Vector3; radius: number };
};

export type GhostTypeDefinition = {
  id: string;
  name: string;
  evidencePool: EvidenceType[];
  aggression: number;
  activity: number;
  huntSanityThreshold: number;
};

export type GameModel = {
  players: Map<string, Player>;
  ghost: Ghost;
  doors: Map<string, Door>;
  lights: Map<string, Light>;
  matchPhase: MatchPhase;
  matchTimeSec: number;
  mapId: string;
  map?: GameMap;
  discoveredEvidence: EvidenceType[];
  activeHuntUntilMs: number;
  huntCooldownUntilMs: number;
};
