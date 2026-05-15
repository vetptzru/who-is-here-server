import type { GameModel } from "../domain/models.js";
import { isWithinDistance } from "../domain/geometry.js";
import type { GameEventPublisher, Logger } from "../domain/ports.js";
import type { EvidenceType, ItemId } from "../domain/types.js";

const itemEvidenceMap: Partial<Record<ItemId, EvidenceType>> = {
  emf: "emf",
  thermometer: "freezing",
  camera: "fingerprints",
};

export class EvidenceSystem {
  public constructor(
    private readonly state: GameModel,
    private readonly events: GameEventPublisher,
    private readonly logger: Logger,
  ) {}

  public useItem(playerId: string, itemId: ItemId): boolean {
    const player = this.state.players.get(playerId);
    const evidenceType = itemEvidenceMap[itemId];
    if (!player || !evidenceType || !player.isAlive || !player.inventory.includes(itemId) || !this.state.map) {
      return false;
    }

    if (!this.state.ghost.evidence.includes(evidenceType)) {
      return false;
    }

    const spot = this.state.map.evidenceSpots.find(
      (item) =>
        item.evidenceType === evidenceType &&
        item.roomId === this.state.ghost.roomId &&
        isWithinDistance(player.position, item.position, 3),
    );
    if (!spot) {
      return false;
    }

    if (!this.state.discoveredEvidence.includes(evidenceType)) {
      this.state.discoveredEvidence.push(evidenceType);
    }

    this.events.evidenceFound({ evidenceType, roomId: spot.roomId });
    this.logger.info("Evidence found", { playerId, evidenceType, roomId: spot.roomId });
    return true;
  }
}
