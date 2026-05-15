export type MatchPhase = "waiting" | "preparing" | "active" | "hunt" | "finished";

export type GhostMode =
  | "idle"
  | "light_activity"
  | "interaction"
  | "manifest"
  | "hunt"
  | "cooldown";

export type EvidenceType = "emf" | "freezing" | "fingerprints";

export type ItemId = "flashlight" | "emf" | "thermometer" | "camera";

export type InteractionType = "use" | "open" | "close" | "toggle" | "pickup";

export type ObjectKind =
  | "door"
  | "light_switch"
  | "generator"
  | "item"
  | "evidence_spot"
  | "exit_zone"
  | "hiding_spot";

export type HuntEndReason = "timeout" | "all_players_dead" | "manual";

export type GhostEventType =
  | "sound"
  | "flicker_light"
  | "door_touch"
  | "object_move"
  | "emf_spike"
  | "manifest";

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};
