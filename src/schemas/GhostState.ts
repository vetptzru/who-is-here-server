import { ArraySchema, Schema, type } from "@colyseus/schema";

export class GhostState extends Schema {
  @type("string") public ghostType = "default";
  @type("string") public state = "idle";
  @type("string") public roomId = "";
  @type("number") public aggression = 1;
  @type("number") public activity = 1;
  @type("number") public x = 0;
  @type("number") public y = 0;
  @type("number") public z = 0;
  @type("string") public targetPlayerId = "";
  @type(["string"]) public discoveredEvidence = new ArraySchema<string>();
  @type(["number"]) public debugPathX = new ArraySchema<number>();
  @type(["number"]) public debugPathY = new ArraySchema<number>();
  @type(["number"]) public debugPathZ = new ArraySchema<number>();
}
