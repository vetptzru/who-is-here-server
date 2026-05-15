import house01 from "../data/maps/house_01.json" with { type: "json" };
import type { GameMap } from "../domain/models.js";
import type { MapRepository } from "../domain/ports.js";
import type { EvidenceType } from "../domain/types.js";

type RawMap = typeof house01;

export class JsonMapRepository implements MapRepository {
  private readonly maps = new Map<string, RawMap>([[house01.id, house01]]);

  public async getById(mapId: string): Promise<GameMap> {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error(`Map ${mapId} not found`);
    }

    return {
      id: map.id,
      name: map.name,
      spawnPoints: map.spawnPoints.map((spawn) => ({ id: spawn.id, position: spawn.position })),
      rooms: map.rooms,
      doors: map.doors.map((door) => ({ ...door, isOpen: false, isLocked: false })),
      lights: map.lights.map((light) => ({ ...light, isOn: true })),
      hidingSpots: map.hidingSpots,
      evidenceSpots: map.evidenceSpots.map((spot) => ({
        ...spot,
        evidenceType: spot.evidenceType as EvidenceType,
      })),
      exitZone: map.exitZone,
    };
  }
}
