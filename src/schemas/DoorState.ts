import { Schema, type } from "@colyseus/schema";

export class DoorState extends Schema {
  @type("string") public id = "";
  @type("string") public roomA = "";
  @type("string") public roomB = "";
  @type("boolean") public isOpen = false;
  @type("boolean") public isLocked = false;
}
