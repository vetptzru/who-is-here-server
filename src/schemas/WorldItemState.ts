import { Schema, type } from "@colyseus/schema";

export class WorldItemState extends Schema {
  @type("string") public id = "";
  @type("string") public itemId = "";
  @type("number") public x = 0;
  @type("number") public y = 0;
  @type("number") public z = 0;
  @type("number") public rotationY = 0;
  @type("string") public state = "world";
  @type("string") public holderPlayerId = "";
}
