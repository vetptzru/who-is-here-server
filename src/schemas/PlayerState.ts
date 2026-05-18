import { ArraySchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") public id = "";
  @type("string") public name = "";
  @type("number") public x = 0;
  @type("number") public y = 0;
  @type("number") public z = 0;
  @type("number") public rotY = 0;
  @type("number") public lookPitch = 0;
  @type("number") public sanity = 100;
  @type("boolean") public isAlive = true;
  @type("boolean") public isReady = false;
  @type("boolean") public isInHouse = false;
  @type("boolean") public flashlightOn = false;
  @type(["string"]) public inventory = new ArraySchema<string>();
}
