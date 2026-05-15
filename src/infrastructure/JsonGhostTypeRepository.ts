import ghostTypes from "../data/ghostTypes.json" with { type: "json" };
import type { GhostTypeDefinition } from "../domain/models.js";
import type { GhostTypeRepository } from "../domain/ports.js";

export class JsonGhostTypeRepository implements GhostTypeRepository {
  public async getAll(): Promise<GhostTypeDefinition[]> {
    return ghostTypes as GhostTypeDefinition[];
  }
}
