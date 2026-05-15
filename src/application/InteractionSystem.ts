import type { GameModel, MapObject, Player } from "../domain/models.js";
import { isWithinDistance } from "../domain/geometry.js";
import type { Logger } from "../domain/ports.js";
import type { InteractionType } from "../domain/types.js";

export class InteractionSystem {
  private readonly maxDistance = 3;

  public constructor(
    private readonly state: GameModel,
    private readonly logger: Logger,
  ) {}

  public interact(playerId: string, objectId: string, interactionType: InteractionType): boolean {
    const player = this.state.players.get(playerId);
    if (!player || !this.canInteract(player)) {
      return false;
    }

    if (this.tryDoor(player, objectId, interactionType)) {
      return true;
    }

    if (this.tryLight(player, objectId, interactionType)) {
      return true;
    }

    if (this.tryExit(player, objectId)) {
      return true;
    }

    return this.tryMapObject(player, objectId, interactionType);
  }

  private canInteract(player: Player): boolean {
    return player.isAlive && this.state.matchPhase !== "waiting" && this.state.matchPhase !== "finished";
  }

  private tryDoor(player: Player, objectId: string, interactionType: InteractionType): boolean {
    const door = this.state.doors.get(objectId);
    if (!door || !this.state.map || !["open", "close", "toggle", "use"].includes(interactionType)) {
      return false;
    }

    const room = this.state.map.rooms.find((item) => item.id === door.roomB || item.id === door.roomA);
    if (room && !isWithinDistance(player.position, room.center, room.radius + this.maxDistance)) {
      return false;
    }

    if (door.isLocked) {
      return false;
    }

    door.isOpen = interactionType === "toggle" || interactionType === "use" ? !door.isOpen : interactionType === "open";
    this.logger.info("Door interaction", { playerId: player.id, doorId: door.id, isOpen: door.isOpen });
    return true;
  }

  private tryLight(player: Player, objectId: string, interactionType: InteractionType): boolean {
    const light = Array.from(this.state.lights.values()).find(
      (item) => item.id === objectId || item.switchId === objectId,
    );
    if (!light || !this.state.map || !["toggle", "use"].includes(interactionType)) {
      return false;
    }

    const room = this.state.map.rooms.find((item) => item.id === light.roomId);
    if (room && !isWithinDistance(player.position, room.center, room.radius + this.maxDistance)) {
      return false;
    }

    light.isOn = !light.isOn;
    this.logger.info("Light interaction", { playerId: player.id, lightId: light.id, isOn: light.isOn });
    return true;
  }

  private tryExit(player: Player, objectId: string): boolean {
    if (!this.state.map || objectId !== this.state.map.exitZone.id) {
      return false;
    }

    return isWithinDistance(player.position, this.state.map.exitZone.position, this.state.map.exitZone.radius);
  }

  private tryMapObject(player: Player, objectId: string, interactionType: InteractionType): boolean {
    const object = this.getMapObject(objectId);
    if (!object || (object.position && !isWithinDistance(player.position, object.position, this.maxDistance))) {
      return false;
    }

    if (object.kind === "item" && interactionType === "pickup") {
      this.logger.info("Item pickup placeholder", { playerId: player.id, objectId });
      return true;
    }

    if (object.kind === "hiding_spot" && interactionType === "use") {
      this.logger.info("Hiding spot used", { playerId: player.id, objectId });
      return true;
    }

    return object.kind === "generator" && interactionType === "use";
  }

  private getMapObject(objectId: string): MapObject | undefined {
    const map = this.state.map;
    if (!map) {
      return undefined;
    }

    const hidingSpot = map.hidingSpots.find((item) => item.id === objectId);
    if (hidingSpot) {
      return { id: hidingSpot.id, kind: "hiding_spot", roomId: hidingSpot.roomId, position: hidingSpot.position };
    }

    const evidenceSpot = map.evidenceSpots.find((item) => item.id === objectId);
    if (evidenceSpot) {
      return { id: evidenceSpot.id, kind: "evidence_spot", roomId: evidenceSpot.roomId, position: evidenceSpot.position };
    }

    return undefined;
  }
}
