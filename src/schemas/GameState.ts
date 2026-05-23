import { MapSchema, Schema, type } from "@colyseus/schema";
import { DoorState } from "./DoorState.js";
import { GhostState } from "./GhostState.js";
import { LightState } from "./LightState.js";
import { PlayerState } from "./PlayerState.js";
import { WorldItemState } from "./WorldItemState.js";

export class GameState extends Schema {
  @type({ map: PlayerState }) public players = new MapSchema<PlayerState>();
  @type(GhostState) public ghost = new GhostState();
  @type({ map: DoorState }) public doors = new MapSchema<DoorState>();
  @type({ map: LightState }) public lights = new MapSchema<LightState>();
  @type({ map: WorldItemState }) public worldItems = new MapSchema<WorldItemState>();
  @type("string") public matchPhase = "waiting";
  @type("number") public matchTimeSec = 0;
  @type("string") public mapId = "house_01";
}
