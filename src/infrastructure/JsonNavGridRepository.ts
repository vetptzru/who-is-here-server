import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NavGrid } from "../domain/models.js";
import type { NavGridRepository } from "../domain/ports.js";

type RawNavGrid = {
  mapId?: unknown;
  version?: unknown;
  origin?: { x?: unknown; z?: unknown };
  cellSize?: unknown;
  width?: unknown;
  height?: unknown;
  blocked?: unknown;
  doorCells?: unknown;
  meta?: { generatedAt?: unknown; generatorVersion?: unknown; sceneName?: unknown };
};

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const defaultDataDir = path.resolve(currentDirPath, "../data/maps/generated");

export class JsonNavGridRepository implements NavGridRepository {
  public constructor(private readonly dataDir = defaultDataDir) {}

  public async getByMapId(mapId: string): Promise<NavGrid | null> {
    const filePath = path.join(this.dataDir, `navgrid_${mapId}.json`);

    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf-8");
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "ENOENT") {
        return null;
      }
      throw error;
    }

    const parsed = JSON.parse(raw) as RawNavGrid;
    return this.validate(parsed, filePath);
  }

  private validate(raw: RawNavGrid, sourcePath: string): NavGrid {
    if (typeof raw.mapId !== "string" || raw.mapId.length === 0) {
      throw new Error(`Invalid navgrid mapId in ${sourcePath}`);
    }
    if (!Number.isInteger(raw.version)) {
      throw new Error(`Invalid navgrid version in ${sourcePath}`);
    }
    if (!raw.origin || typeof raw.origin.x !== "number" || typeof raw.origin.z !== "number") {
      throw new Error(`Invalid navgrid origin in ${sourcePath}`);
    }
    if (typeof raw.cellSize !== "number" || raw.cellSize <= 0) {
      throw new Error(`Invalid navgrid cellSize in ${sourcePath}`);
    }
    if (typeof raw.width !== "number" || !Number.isInteger(raw.width) || raw.width <= 0) {
      throw new Error(`Invalid navgrid width in ${sourcePath}`);
    }
    if (typeof raw.height !== "number" || !Number.isInteger(raw.height) || raw.height <= 0) {
      throw new Error(`Invalid navgrid height in ${sourcePath}`);
    }
    const version = raw.version as number;
    const width = raw.width as number;
    const height = raw.height as number;
    const cellSize = raw.cellSize as number;
    const origin = raw.origin as { x: number; z: number };
    if (!Array.isArray(raw.blocked) || !raw.blocked.every((value) => Number.isInteger(value))) {
      throw new Error(`Invalid navgrid blocked array in ${sourcePath}`);
    }

    const totalCells = width * height;
    const blocked = raw.blocked as number[];
    if (blocked.some((index) => index < 0 || index >= totalCells)) {
      throw new Error(`Blocked cell index out of range in ${sourcePath}`);
    }

    if (!raw.doorCells || typeof raw.doorCells !== "object" || Array.isArray(raw.doorCells)) {
      throw new Error(`Invalid navgrid doorCells in ${sourcePath}`);
    }

    const validatedDoorCells: Record<string, number[]> = {};
    for (const [doorId, cells] of Object.entries(raw.doorCells as Record<string, unknown>)) {
      if (!Array.isArray(cells) || !cells.every((value) => Number.isInteger(value))) {
        throw new Error(`Invalid doorCells entry for ${doorId} in ${sourcePath}`);
      }
      const indices = cells as number[];
      if (indices.some((index) => index < 0 || index >= totalCells)) {
        throw new Error(`Door cell index out of range for ${doorId} in ${sourcePath}`);
      }
      validatedDoorCells[doorId] = indices;
    }

    if (
      !raw.meta ||
      typeof raw.meta.generatedAt !== "string" ||
      !Number.isInteger(raw.meta.generatorVersion) ||
      typeof raw.meta.sceneName !== "string"
    ) {
      throw new Error(`Invalid navgrid meta in ${sourcePath}`);
    }

    const meta = raw.meta as { generatedAt: string; generatorVersion: number; sceneName: string };

    return {
      mapId: raw.mapId,
      version,
      origin: { x: origin.x, z: origin.z },
      cellSize,
      width,
      height,
      blocked,
      doorCells: validatedDoorCells,
      meta: {
        generatedAt: meta.generatedAt,
        generatorVersion: meta.generatorVersion,
        sceneName: meta.sceneName,
      },
    };
  }
}
