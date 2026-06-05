import { performance } from "node:perf_hooks";
import type { NavGrid } from "../domain/models.js";
import type { Vector3 } from "../domain/types.js";

type GridPoint = { x: number; z: number };

export type NavigationStats = {
  iterations: number;
  durationMs: number;
  expandedNodes: number;
};

export type NavigationPathResult = {
  found: boolean;
  worldPath: Vector3[];
  gridPath: GridPoint[];
  stats?: NavigationStats;
  reason?: "no_navgrid" | "invalid_start" | "invalid_goal" | "iteration_limit" | "no_path";
};

export type NavigationFindPathOptions = {
  maxIterations?: number;
  allowBlockedStart?: boolean;
  allowBlockedGoal?: boolean;
};

const DEFAULT_MAX_ITERATIONS = 25_000;

export class NavigationService {
  private readonly blockedSet: Set<number>;
  private readonly dynamicBlockedSet: Set<number>;

  public constructor(private readonly navGrid: NavGrid | null | undefined) {
    this.blockedSet = new Set(navGrid?.blocked ?? []);
    this.dynamicBlockedSet = new Set<number>();
  }

  public setDoorBlockedCells(doorId: string, blocked: boolean): void {
    if (!this.navGrid) {
      return;
    }
    const cells = this.navGrid.doorCells[doorId] ?? [];
    for (const cellId of cells) {
      if (blocked) {
        this.dynamicBlockedSet.add(cellId);
      } else {
        this.dynamicBlockedSet.delete(cellId);
      }
    }
  }

  public worldToGrid(point: Vector3): GridPoint | null {
    if (!this.navGrid) {
      return null;
    }
    return this.worldToGridInternal(point);
  }

  public gridToWorld(cell: GridPoint, y = 1): Vector3 | null {
    if (!this.navGrid) {
      return null;
    }
    if (!this.inBounds(cell)) {
      return null;
    }
    return this.gridToWorldInternal(cell, y);
  }

  public findPath(startWorld: Vector3, goalWorld: Vector3, options: NavigationFindPathOptions = {}): NavigationPathResult {
    const startedAt = performance.now();
    if (!this.navGrid) {
      return { found: false, worldPath: [], gridPath: [], reason: "no_navgrid", stats: { iterations: 0, durationMs: 0, expandedNodes: 0 } };
    }

    const start = this.worldToGridInternal(startWorld);
    const goal = this.worldToGridInternal(goalWorld);
    if (!this.inBounds(start)) {
      return this.failResult("invalid_start", startedAt, 0, 0);
    }
    if (!this.inBounds(goal)) {
      return this.failResult("invalid_goal", startedAt, 0, 0);
    }

    const allowBlockedStart = options.allowBlockedStart ?? true;
    const allowBlockedGoal = options.allowBlockedGoal ?? true;
    if (!allowBlockedStart && this.isBlocked(start)) {
      return this.failResult("invalid_start", startedAt, 0, 0);
    }
    if (!allowBlockedGoal && this.isBlocked(goal)) {
      return this.failResult("invalid_goal", startedAt, 0, 0);
    }

    const searchResult = this.aStar(start, goal, options.maxIterations ?? DEFAULT_MAX_ITERATIONS);
    if (!searchResult.path) {
      return this.failResult(searchResult.reason, startedAt, searchResult.iterations, searchResult.expandedNodes);
    }

    const y = startWorld.y;
    return {
      found: true,
      gridPath: searchResult.path,
      worldPath: searchResult.path.map((cell) => this.gridToWorldInternal(cell, y)),
      stats: {
        iterations: searchResult.iterations,
        expandedNodes: searchResult.expandedNodes,
        durationMs: performance.now() - startedAt,
      },
    };
  }

  private aStar(
    start: GridPoint,
    goal: GridPoint,
    maxIterations: number,
  ): { path: GridPoint[] | null; reason: "iteration_limit" | "no_path"; iterations: number; expandedNodes: number } {
    const open = new Set<number>();
    const closed = new Set<number>();
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();

    const startId = this.toCellId(start);
    const goalId = this.toCellId(goal);
    open.add(startId);
    gScore.set(startId, 0);
    fScore.set(startId, this.heuristic(start, goal));

    let iterations = 0;
    let expandedNodes = 0;
    while (open.size > 0) {
      iterations += 1;
      if (iterations > maxIterations) {
        return { path: null, reason: "iteration_limit", iterations, expandedNodes };
      }

      let currentId = -1;
      let bestF = Number.POSITIVE_INFINITY;
      for (const candidate of open) {
        const score = fScore.get(candidate) ?? Number.POSITIVE_INFINITY;
        if (score < bestF) {
          bestF = score;
          currentId = candidate;
        }
      }
      if (currentId < 0) {
        return { path: null, reason: "no_path", iterations, expandedNodes };
      }

      if (currentId === goalId) {
        return { path: this.reconstructPath(cameFrom, currentId), reason: "no_path", iterations, expandedNodes };
      }

      open.delete(currentId);
      closed.add(currentId);
      expandedNodes += 1;
      const current = this.fromCellId(currentId);

      for (const neighbor of this.getNeighbors(current)) {
        const neighborId = this.toCellId(neighbor);
        if (closed.has(neighborId)) {
          continue;
        }
        if (this.isBlocked(neighbor) && neighborId !== goalId) {
          continue;
        }

        const tentativeG = (gScore.get(currentId) ?? Number.POSITIVE_INFINITY) + 1;
        if (tentativeG >= (gScore.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
          continue;
        }

        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + this.heuristic(neighbor, goal));
        open.add(neighborId);
      }
    }

    return { path: null, reason: "no_path", iterations, expandedNodes };
  }

  private failResult(
    reason: "no_navgrid" | "invalid_start" | "invalid_goal" | "iteration_limit" | "no_path",
    startedAt: number,
    iterations: number,
    expandedNodes: number,
  ): NavigationPathResult {
    return {
      found: false,
      worldPath: [],
      gridPath: [],
      reason,
      stats: {
        iterations,
        expandedNodes,
        durationMs: performance.now() - startedAt,
      },
    };
  }

  private getNeighbors(cell: GridPoint): GridPoint[] {
    const candidates: GridPoint[] = [
      { x: cell.x + 1, z: cell.z },
      { x: cell.x - 1, z: cell.z },
      { x: cell.x, z: cell.z + 1 },
      { x: cell.x, z: cell.z - 1 },
    ];
    return candidates.filter((candidate) => this.inBounds(candidate));
  }

  private reconstructPath(cameFrom: Map<number, number>, currentId: number): GridPoint[] {
    const path: GridPoint[] = [this.fromCellId(currentId)];
    let cursor = currentId;
    while (cameFrom.has(cursor)) {
      cursor = cameFrom.get(cursor)!;
      path.push(this.fromCellId(cursor));
    }
    path.reverse();
    return path;
  }

  private heuristic(a: GridPoint, b: GridPoint): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  private isBlocked(cell: GridPoint): boolean {
    if (!this.navGrid) {
      return false;
    }
    const id = this.toCellId(cell);
    return this.blockedSet.has(id) || this.dynamicBlockedSet.has(id);
  }

  private inBounds(cell: GridPoint): boolean {
    if (!this.navGrid) {
      return false;
    }
    return cell.x >= 0 && cell.z >= 0 && cell.x < this.navGrid.width && cell.z < this.navGrid.height;
  }

  private worldToGridInternal(point: Vector3): GridPoint {
    return {
      x: Math.floor((point.x - this.navGrid!.origin.x) / this.navGrid!.cellSize),
      z: Math.floor((point.z - this.navGrid!.origin.z) / this.navGrid!.cellSize),
    };
  }

  private gridToWorldInternal(cell: GridPoint, y: number): Vector3 {
    return {
      x: this.navGrid!.origin.x + (cell.x + 0.5) * this.navGrid!.cellSize,
      y,
      z: this.navGrid!.origin.z + (cell.z + 0.5) * this.navGrid!.cellSize,
    };
  }

  private toCellId(cell: GridPoint): number {
    return cell.z * this.navGrid!.width + cell.x;
  }

  private fromCellId(id: number): GridPoint {
    return {
      x: id % this.navGrid!.width,
      z: Math.floor(id / this.navGrid!.width),
    };
  }
}
