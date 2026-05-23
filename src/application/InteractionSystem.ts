import type { GameModel, MapObject, Player, WorldItem } from "../domain/models.js";
import { isWithinDistance } from "../domain/geometry.js";
import type { Logger } from "../domain/ports.js";
import type { InteractionType, Vector3 } from "../domain/types.js";

export class InteractionSystem {
  private readonly maxDistance = 3;
  private readonly inventoryCapacity = 4;
  private readonly minHorizontalSurfaceY = 0.85;

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

  public dropActiveItem(playerId: string, slotIndex?: number): boolean {
    const player = this.state.players.get(playerId);
    if (!player || !this.canInteract(player) || player.inventory.length === 0) {
      return false;
    }

    const index = this.resolveSlotIndex(player, slotIndex);
    if (index < 0) {
      return false;
    }
    const itemId = player.inventory[index];
    const worldItem = this.findHeldItem(player.id, itemId);
    if (!worldItem) {
      return false;
    }

    const position = this.calculateDropPosition(player);
    player.inventory.splice(index, 1);
    this.putWorldItem(worldItem, position, player.rotY);
    this.logger.info("Item dropped", { playerId, worldItemId: worldItem.id, itemId: worldItem.itemId });
    return true;
  }

  public placeItem(
    playerId: string,
    payload: { x: number; y: number; z: number; rotY: number; normalY: number; slotIndex?: number },
  ): boolean {
    const player = this.state.players.get(playerId);
    if (!player || !this.canInteract(player) || player.inventory.length === 0) {
      return false;
    }
    if (payload.normalY < this.minHorizontalSurfaceY) {
      return false;
    }

    const placePosition: Vector3 = { x: payload.x, y: payload.y, z: payload.z };
    if (!isWithinDistance(player.position, placePosition, this.maxDistance + 0.5)) {
      return false;
    }

    const slotIndex = this.resolveSlotIndex(player, payload.slotIndex);
    if (slotIndex < 0) {
      return false;
    }
    const itemId = player.inventory[slotIndex];
    const worldItem = this.findHeldItem(player.id, itemId);
    if (!worldItem) {
      return false;
    }

    player.inventory.splice(slotIndex, 1);
    this.putWorldItem(worldItem, placePosition, payload.rotY);
    this.logger.info("Item placed", { playerId, worldItemId: worldItem.id, itemId: worldItem.itemId });
    return true;
  }

  private canInteract(player: Player): boolean {
    return player.isAlive && this.state.matchPhase !== "waiting" && this.state.matchPhase !== "finished";
  }

  private tryDoor(player: Player, objectId: string, interactionType: InteractionType): boolean {
    const door = this.state.doors.get(objectId);
    if (!door || !this.state.map || !["open", "close", "toggle", "use"].includes(interactionType)) {
      return false;
    }

    // TODO: make this better
    // const room = this.state.map.rooms.find((item) => item.id === door.roomB || item.id === door.roomA);
    // if (room && !isWithinDistance(player.position, room.center, room.radius + this.maxDistance)) {
    //   return false;
    // }

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

    // TODO: make this better
    // const room = this.state.map.rooms.find((item) => item.id === light.roomId);
    // if (room && !isWithinDistance(player.position, room.center, room.radius + this.maxDistance)) {
    //   return false;
    // }

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
      return this.tryPickupItem(player, objectId);
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

    const worldItem = this.state.worldItems.get(objectId);
    if (worldItem && worldItem.state === "world") {
      return { id: worldItem.id, kind: "item", position: worldItem.position };
    }

    return undefined;
  }

  private tryPickupItem(player: Player, objectId: string): boolean {
    const worldItem = this.state.worldItems.get(objectId);
    if (!worldItem || worldItem.state !== "world") {
      return false;
    }
    if (!isWithinDistance(player.position, worldItem.position, this.maxDistance)) {
      return false;
    }
    if (player.inventory.length >= this.inventoryCapacity) {
      this.logger.info("Pickup blocked: inventory full", { playerId: player.id, objectId });
      return false;
    }

    player.inventory.push(worldItem.itemId);
    worldItem.state = "held";
    worldItem.holderPlayerId = player.id;
    this.logger.info("Item picked up", { playerId: player.id, worldItemId: worldItem.id, itemId: worldItem.itemId });
    return true;
  }

  private findHeldItem(playerId: string, itemId: string): WorldItem | undefined {
    return Array.from(this.state.worldItems.values()).find(
      (item) => item.state === "held" && item.holderPlayerId === playerId && item.itemId === itemId,
    );
  }

  private calculateDropPosition(player: Player): Vector3 {
    const yaw = (player.rotY * Math.PI) / 180;
    const offset = 1.15;
    return {
      x: player.position.x + Math.sin(yaw) * offset,
      y: player.position.y,
      z: player.position.z + Math.cos(yaw) * offset,
    };
  }

  private putWorldItem(item: WorldItem, position: Vector3, rotationY: number): void {
    item.state = "world";
    item.holderPlayerId = undefined;
    item.position = { ...position };
    item.rotationY = rotationY;
  }

  private resolveSlotIndex(player: Player, slotIndex?: number): number {
    if (player.inventory.length === 0) {
      return -1;
    }
    if (slotIndex == null) {
      return player.inventory.length - 1;
    }
    if (slotIndex < 0 || slotIndex >= player.inventory.length) {
      return -1;
    }
    return slotIndex;
  }
}
