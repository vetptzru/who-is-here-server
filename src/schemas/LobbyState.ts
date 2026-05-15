import { MapSchema, Schema, type } from "@colyseus/schema";

export class LobbyPlayerState extends Schema {
  @type("string") public id = "";
  @type("string") public name = "";
  @type("boolean") public isReady = false;
  @type("boolean") public isHost = false;
}

export class LobbyState extends Schema {
  @type({ map: LobbyPlayerState }) public players = new MapSchema<LobbyPlayerState>();
  @type("string") public status = "waiting";
}
