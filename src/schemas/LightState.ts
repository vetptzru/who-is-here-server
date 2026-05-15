import { Schema, type } from "@colyseus/schema";

export class LightState extends Schema {
  @type("string") public id = "";
  @type("string") public roomId = "";
  @type("string") public switchId = "";
  @type("boolean") public isOn = true;
}
